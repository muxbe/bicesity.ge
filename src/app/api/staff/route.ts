import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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

function readMetadataName(user: User | null): string {
  const value = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  return typeof value === "string" ? value.trim() : "";
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const users = data.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) {
      return match;
    }
    if (users.length < perPage) {
      return null;
    }
    page += 1;
  }

  return null;
}

async function updateAuthUserForStaff(
  supabase: SupabaseClient,
  user: User,
  role: StaffRole,
  fullName: string,
  password: string
) {
  const userMetadata = {
    ...(user.user_metadata ?? {}),
    full_name: fullName || readMetadataName(user),
  };
  const appMetadata = {
    ...(user.app_metadata ?? {}),
    app_role: role,
  };
  const attributes: {
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
    password?: string;
  } = {
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  };

  if (password) {
    attributes.password = password;
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, attributes);
  if (error) {
    throw error;
  }
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
    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdminClient();
    let staffUser = await findAuthUserByEmail(supabase, email);
    const existingName = readMetadataName(staffUser);
    const profileFullName = fullName || existingName;

    if (!staffUser) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password is required for new staff users and must be at least 6 characters." },
          { status: 400 }
        );
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: profileFullName },
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

      staffUser = created.user;
      createdUserId = created.user.id;
    } else {
      await updateAuthUserForStaff(supabase, staffUser, role, profileFullName, password);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: staffUser.id,
          email: staffUser.email ?? email,
          full_name: profileFullName,
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
      const wasCreated = Boolean(createdUserId);
      if (createdUserId) {
        await supabase.auth.admin.deleteUser(createdUserId);
      }
      createdUserId = null;
      return NextResponse.json(
        {
          error: wasCreated
            ? "Staff user was created but profile setup failed."
            : "Staff profile setup failed.",
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
