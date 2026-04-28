"use client";

import { getBrowserSupabaseClient, hasSupabasePublicEnv } from "@/lib/supabase/client";
import type { StaffRole } from "@/lib/auth/app-role";

export async function getAuthHeaders(fallbackRole?: StaffRole): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (fallbackRole) {
    headers["x-app-role"] = fallbackRole;
  }

  if (!hasSupabasePublicEnv()) {
    return headers;
  }

  try {
    const supabase = getBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    return headers;
  }

  return headers;
}

export async function getJsonAuthHeaders(
  fallbackRole?: StaffRole
): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    ...(await getAuthHeaders(fallbackRole)),
  };
}
