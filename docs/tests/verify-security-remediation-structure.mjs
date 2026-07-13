import { failIfAny, listFiles, pathExists, readText } from "./structure-test-helpers.mjs";

const failures = [];

function requireFile(relativePath, message) {
  if (!pathExists(relativePath)) {
    failures.push(`${relativePath}: ${message}`);
    return null;
  }
  return readText(relativePath);
}

requireFile(
  "src/app/api/fields/field-layout-service.ts",
  "shared server-backed field layout service is required"
);

const layoutRoute = requireFile(
  "src/app/api/fields/layout/route.ts",
  "staff-readable, admin-writable field layout route is required"
);
if (layoutRoute && (!/PATCH/.test(layoutRoute) || !/requireAdmin|role\s*!==\s*["']admin["']/.test(layoutRoute))) {
  failures.push("Field layout PATCH must enforce the administrator role.");
}

const expiryRoute = requireFile(
  "src/app/api/reservations/expire/route.ts",
  "reservation expiry route is required"
);
if (expiryRoute && /referenceTimeIso/.test(expiryRoute)) {
  failures.push("Reservation expiry must not accept caller-controlled referenceTimeIso.");
}

const bulkRoute = requireFile("src/app/api/catalog/bulk/route.ts", "bulk route is required");
if (bulkRoute && (!/MAX_BULK_ITEMS\s*=\s*100/.test(bulkRoute) || !/itemIds\.length\s*>\s*MAX_BULK_ITEMS/.test(bulkRoute))) {
  failures.push("Bulk catalog input must be rejected above MAX_BULK_ITEMS = 100 before work begins.");
}

const nextConfig = requireFile("next.config.mjs", "Next.js configuration is required");
if (nextConfig) {
  if (!/poweredByHeader\s*:\s*false/.test(nextConfig)) {
    failures.push("Next.js must disable the powered-by header.");
  }
  if (!/Content-Security-Policy-Report-Only/.test(nextConfig) || !/headers\s*\(/.test(nextConfig)) {
    failures.push("Static report-only CSP and security headers are required.");
  }
}

const passwordPolicy = requireFile(
  "src/lib/auth/password-policy.ts",
  "one shared password policy is required"
);
if (passwordPolicy && !/MIN_PASSWORD_LENGTH\s*=\s*12/.test(passwordPolicy)) {
  failures.push("Shared password minimum must be 12.");
}

requireFile("src/app/mfa/page.tsx", "administrator MFA enrollment/challenge page is required");

const imageRoute = requireFile("src/app/api/catalog/images/route.ts", "image route is required");
if (imageRoute) {
  if (!/25_?000_?000|MAX_IMAGE_PIXELS/.test(imageRoute) || !/6000|MAX_IMAGE_SIDE/.test(imageRoute)) {
    failures.push("Image upload must enforce 25 MP and 6000 px side limits.");
  }
  if (!/sharp|magic|signature|file-type|metadata\s*\(/i.test(imageRoute)) {
    failures.push("Image upload must verify actual content through signature inspection or decoding.");
  }
  const roleCheck = imageRoute.search(/role\s*!==\s*["']admin["']/);
  const formRead = imageRoute.search(/request\.formData\s*\(/);
  if (roleCheck < 0 || formRead < 0 || roleCheck > formRead) {
    failures.push("Image upload must deny non-admins before parsing multipart data.");
  }
}

for (const file of listFiles("src/app/api", [".ts", ".tsx"])) {
  if (!file.endsWith("route.ts") && !file.endsWith("error-response.ts")) {
    continue;
  }
  if (/\bdetails\s*:/.test(readText(file))) {
    failures.push(`${file}: API responses must not serialize raw details.`);
  }
}

const grantMigration = listFiles("supabase/migrations", [".sql"]).find((file) =>
  file.includes("revoke_browser_table_grants")
);
if (!grantMigration) {
  failures.push("A staged revoke_browser_table_grants migration is required.");
}

failIfAny(failures, "Security remediation structure checks passed.");
