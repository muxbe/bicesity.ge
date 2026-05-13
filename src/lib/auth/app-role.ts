export type AppRole = "admin" | "seller" | "user";
export type StaffRole = Extract<AppRole, "admin" | "seller">;

type Metadata = Record<string, unknown> | null | undefined;

function readString(value: unknown): string | null {
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function normalizeRole(value: unknown): AppRole | null {
  const role = readString(value);
  return role === "admin" || role === "seller" || role === "user" ? role : null;
}

function readMetadataRole(metadata: Metadata): AppRole | null {
  if (!metadata) {
    return null;
  }
  return normalizeRole(metadata.app_role) ?? normalizeRole(metadata.role);
}

export function readAppRoleFromMetadata(
  appMetadata: Metadata,
  _userMetadata?: Metadata
): AppRole {
  return readMetadataRole(appMetadata) ?? "user";
}

export function isStaffRole(role: AppRole | null | undefined): role is StaffRole {
  return role === "admin" || role === "seller";
}
