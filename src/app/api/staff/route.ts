import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, type StaffProfile } from "@/lib/auth/server";
import type { StaffRole } from "@/lib/auth/app-role";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type CreateStaffPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  role?: StaffRole;
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

function parseRole(value: unknown): StaffRole {
  return value === "admin" ? "admin" : "seller";
}

function parseString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (auth?.role !== "admin") {
      return forbidden();
    }

    const supabase = getServerSupabaseAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load staff profiles.", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: ((data ?? []) as ProfileRow[]).map(mapProfile) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected staff error.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null;

  try {
    const auth = await getRequestAuth(request);
    if (auth?.role !== "admin") {
      return forbidden();
    }

    const payload = (await request.json()) as CreateStaffPayload;
    const email = parseString(payload.email).toLowerCase();
    const password = parseString(payload.password);
    const fullName = parseString(payload.fullName);
    const role = parseRole(payload.role);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdminClient();
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { app_role: role },
    });

    if (createError || !created.user) {
      return NextResponse.json(
        {
          error: createError?.message ?? "Failed to create staff user.",
          details: createError ?? null,
        },
        { status: 400 }
      );
    }

    createdUserId = created.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: created.user.id,
          email: created.user.email ?? email,
          full_name: fullName,
          role,
          is_active: true,
          created_by_actor_id: auth.user.id,
          updated_by_actor_id: auth.user.id,
        },
        { onConflict: "user_id" }
      )
      .select(PROFILE_SELECT)
      .single();

    if (profileError || !profile) {
      await supabase.auth.admin.deleteUser(created.user.id);
      createdUserId = null;
      return NextResponse.json(
        {
          error: "Staff user was created but profile setup failed.",
          details: profileError ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: mapProfile(profile as ProfileRow) }, { status: 201 });
  } catch (error) {
    if (createdUserId) {
      await getServerSupabaseAdminClient().auth.admin.deleteUser(createdUserId);
    }

    return NextResponse.json(
      {
        error: "Unexpected staff creation error.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
