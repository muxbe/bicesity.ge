import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  isStaffRole,
  readAppRoleFromMetadata,
  type AppRole,
  type StaffRole,
} from "@/lib/auth/app-role";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export type StaffProfile = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

type ProfileLookup =
  | { ok: true; profile: StaffProfile | null }
  | { ok: false; tableMissing: true };

export type RequestAuth = {
  user: User;
  profile: StaffProfile | null;
  role: AppRole;
};

export function bearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export function canUseDevRoleHeader(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_INSECURE_ROLE_HEADER === "true";
}

export function readDevRoleHeader(request: NextRequest): StaffRole | null {
  const role = request.headers.get("x-app-role");
  return role === "admin" || role === "seller" ? role : null;
}

function isMissingProfilesTable(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    Boolean(error?.message?.toLowerCase().includes("profiles"))
  );
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

export async function getProfileByUserId(userId: string): Promise<ProfileLookup> {
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,user_id,email,full_name,role,is_active,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingProfilesTable(error)) {
      return { ok: false, tableMissing: true };
    }
    throw error;
  }

  return {
    ok: true,
    profile: data ? mapProfile(data as ProfileRow) : null,
  };
}

export async function getRequestAuth(request: NextRequest): Promise<RequestAuth | null> {
  const token = bearerToken(request);
  if (!token) {
    return null;
  }

  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  const lookup = await getProfileByUserId(data.user.id);
  if (lookup.ok) {
    if (lookup.profile) {
      return {
        user: data.user,
        profile: lookup.profile,
        role: lookup.profile.isActive ? lookup.profile.role : "user",
      };
    }

    return {
      user: data.user,
      profile: null,
      role: "user",
    };
  }

  const metadataRole = readAppRoleFromMetadata(data.user.app_metadata, data.user.user_metadata);
  return {
    user: data.user,
    profile: null,
    role: isStaffRole(metadataRole) ? metadataRole : "user",
  };
}

export async function getRequestStaffRole(request: NextRequest): Promise<StaffRole | null> {
  const auth = await getRequestAuth(request);
  if (auth && isStaffRole(auth.role)) {
    return auth.role;
  }

  return canUseDevRoleHeader() ? readDevRoleHeader(request) : null;
}
