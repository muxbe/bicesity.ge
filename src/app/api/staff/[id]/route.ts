import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, type StaffProfile } from "@/lib/auth/server";
import type { StaffRole } from "@/lib/auth/app-role";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type UpdateStaffPayload = {
  fullName?: string;
  role?: StaffRole;
  isActive?: boolean;
  password?: string;
};

type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const PROFILE_SELECT = "id,user_id,email,full_name,role,is_active,created_at,updated_at";

function forbidden() {
  return NextResponse.json({ error: "Only admins can manage staff." }, { status: 403 });
}

function mapProfile(row: ProfileRow): StaffProfile {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name ?? "",
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseRole(value: unknown): StaffRole | null {
  return value === "admin" || value === "seller" ? value : null;
}

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getRequestAuth(request);
    if (auth?.role !== "admin") {
      return forbidden();
    }

    const payload = (await request.json()) as UpdateStaffPayload;
    const supabase = getServerSupabaseAdminClient();

    const { data: currentProfile, error: currentError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", params.id)
      .single();

    if (currentError || !currentProfile) {
      return NextResponse.json(
        { error: "Staff profile not found.", details: currentError ?? null },
        { status: 404 }
      );
    }

    const current = currentProfile as ProfileRow;
    const patch: Record<string, unknown> = {
      updated_by_actor_id: auth.user.id,
    };
    const fullName = parseString(payload.fullName);
    const password = parseString(payload.password);
    const nextRole = parseRole(payload.role);

    if (password !== null && password.length > 0 && password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (fullName !== null) {
      patch.full_name = fullName;
    }
    if (nextRole) {
      patch.role = nextRole;
    }
    if (typeof payload.isActive === "boolean") {
      patch.is_active = payload.isActive;
    }

    if (current.user_id === auth.user.id) {
      if (typeof payload.isActive === "boolean" && payload.isActive === false) {
        return NextResponse.json(
          { error: "You cannot deactivate your own admin account." },
          { status: 400 }
        );
      }
      if (nextRole && nextRole !== "admin") {
        return NextResponse.json(
          { error: "You cannot remove admin access from your own account." },
          { status: 400 }
        );
      }
      if (password) {
        return NextResponse.json(
          { error: "Use verified password reset for your own account." },
          { status: 400 }
        );
      }
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", params.id)
      .select(PROFILE_SELECT)
      .single();

    if (updateError || !updatedProfile) {
      return NextResponse.json(
        { error: "Failed to update staff profile.", details: updateError ?? null },
        { status: 500 }
      );
    }

    const updated = updatedProfile as ProfileRow;
    const userUpdate: {
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
      password?: string;
    } = {};
    if (nextRole) {
      userUpdate.app_metadata = { app_role: nextRole };
    }
    if (fullName !== null) {
      userUpdate.user_metadata = { full_name: fullName };
    }
    if (password) {
      userUpdate.password = password;
    }
    if (Object.keys(userUpdate).length > 0) {
      const { error: userError } = await supabase.auth.admin.updateUserById(
        updated.user_id,
        userUpdate
      );
      if (userError) {
        return NextResponse.json(
          { error: "Staff profile was updated but Auth user update failed.", details: userError },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ data: mapProfile(updated) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected staff update error.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
