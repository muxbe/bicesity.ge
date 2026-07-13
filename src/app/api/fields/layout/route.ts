import { NextRequest, NextResponse } from "next/server";
import {
  FieldLayoutStorageUnavailableError,
  readFieldLayoutState,
  writeFieldLayout,
} from "@/app/api/fields/field-layout-service";
import type { StaffRole } from "@/lib/auth/app-role";
import {
  canUseDevRoleHeader,
  getRequestAuth,
  readDevRoleHeader,
  type RequestAuth,
} from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type ResolvedAccess = {
  auth: RequestAuth | null;
  role: StaffRole | null;
};

async function resolveAccess(request: NextRequest): Promise<ResolvedAccess> {
  const auth = await getRequestAuth(request);
  const fallbackRole = auth || !canUseDevRoleHeader() ? null : readDevRoleHeader(request);
  const role = auth?.role === "admin" || auth?.role === "seller" ? auth.role : fallbackRole;
  return { auth, role };
}

export async function GET(request: NextRequest) {
  try {
    const { auth, role } = await resolveAccess(request);
    if (!auth && !role) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json({ error: "Staff access is required." }, { status: 403 });
    }

    return NextResponse.json({ data: await readFieldLayoutState() });
  } catch (error) {
    console.error("Failed to read shared field layout.", error);
    return NextResponse.json({ error: "Failed to load shared field layout." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth, role } = await resolveAccess(request);
    if (!auth && !role) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update field visibility and layout." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as { config?: unknown } | null;
    if (!body || !("config" in body)) {
      return NextResponse.json({ error: "Field layout configuration is required." }, { status: 400 });
    }

    const state = await writeFieldLayout(body.config, auth?.user.id ?? null);
    return NextResponse.json({ data: state });
  } catch (error) {
    if (error instanceof FieldLayoutStorageUnavailableError) {
      return NextResponse.json(
        { error: "Shared field layout storage requires the approved database migration." },
        { status: 503 }
      );
    }
    console.error("Failed to update shared field layout.", error);
    return NextResponse.json({ error: "Failed to save shared field layout." }, { status: 500 });
  }
}
