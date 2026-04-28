import { NextRequest, NextResponse } from "next/server";
import type { StaffRole } from "@/lib/auth/app-role";
import { getRequestStaffRole } from "@/lib/auth/server";

export type CatalogRole = StaffRole;

export async function getCatalogRole(request: NextRequest): Promise<CatalogRole | null> {
  return getRequestStaffRole(request);
}

export function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  return (await getCatalogRole(request)) === "admin"
    ? null
    : forbidden("Only admins can run this catalog action.");
}
