import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const hookPath = path.join(
  repoRoot,
  "src/features/reservations/repositories/use-reservation-data.ts"
);
const controllerPath = path.join(
  repoRoot,
  "src/features/admin/inventory/hooks/use-admin-inventory-controller.ts"
);
const hookSource = readFileSync(hookPath, "utf8");
const controllerSource = readFileSync(controllerPath, "utf8");
const failures = [];

if (!/type\s+UseReservationDataOptions\s*=/.test(hookSource)) {
  failures.push("useReservationData must expose an options type for optional loading.");
}

if (!/enabled\s*=\s*options\.enabled\s*\?\?\s*true/.test(hookSource)) {
  failures.push("useReservationData must default enabled to true.");
}

if (!/if\s*\(\s*!enabled\s*\)\s*\{[\s\S]*setIsLoading\s*\(\s*false\s*\)/.test(hookSource)) {
  failures.push("useReservationData must skip loading and clear loading state when disabled.");
}

if (!/useFocusFreshness\s*\(\s*\{[\s\S]*enabled\s*,[\s\S]*\}\s*\)/.test(hookSource)) {
  failures.push("useReservationData must disable focus freshness when disabled.");
}

if (!/reload:\s*\(\)\s*=>\s*enabled\s*\?[\s\S]*load\s*\(\s*\{[\s\S]*background:\s*hasLoadedOnceRef\.current[\s\S]*\}[\s\S]*Promise\.resolve\s*\(\s*\)/.test(hookSource)) {
  failures.push("useReservationData reload must be a no-op when disabled.");
}

if (
  !/useReservationData\s*\(\s*['"]active['"]\s*,\s*\{\s*enabled:\s*statusView\s*===\s*['"]reserved['"]\s*\}\s*\)/.test(
    controllerSource
  )
) {
  failures.push("Admin inventory must only enable reservation comments on the reserved view.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Reservation comment loading gate checks passed.");
