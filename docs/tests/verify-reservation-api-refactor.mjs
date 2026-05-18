import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const requiredFiles = [
  "src/app/api/reservations/reservation-service.ts",
  "src/app/api/reservations/product/[productId]/cancel/route.ts",
  "src/app/api/reservations/product/[productId]/complete/route.ts",
];

const missingFiles = requiredFiles.filter((file) => !existsSync(path.join(repoRoot, file)));
const repository = read(
  "src/features/reservations/adapters/supabase/reservation-repository.supabase.ts"
);

const failures = [];

if (missingFiles.length > 0) {
  failures.push(`Missing reservation API files:\n${missingFiles.map((file) => `- ${file}`).join("\n")}`);
}

if (repository.includes("getBrowserSupabaseClient")) {
  failures.push("Reservation browser adapter still imports or calls getBrowserSupabaseClient.");
}

if (/from\(["']reservations["']\)\s*\.\s*(insert|update)/.test(repository)) {
  failures.push("Reservation browser adapter still writes directly to public.reservations.");
}

if (!repository.includes("/api/reservations/product/") || !repository.includes("/cancel")) {
  failures.push("Reservation browser adapter does not call the explicit cancel route.");
}

if (!repository.includes("/api/reservations/product/") || !repository.includes("/complete")) {
  failures.push("Reservation browser adapter does not call the explicit complete route.");
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log("Reservation API refactor static checks passed.");
