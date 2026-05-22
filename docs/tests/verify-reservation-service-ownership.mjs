import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const catalogService = readFileSync(
  path.join(repoRoot, "src/app/api/catalog/catalog-service.ts"),
  "utf8"
);
const bulkRoute = readFileSync(
  path.join(repoRoot, "src/app/api/catalog/bulk/route.ts"),
  "utf8"
);

const failures = [];
const catalogServiceImportBlock = bulkRoute.match(
  /import\s*\{[\s\S]*?\}\s*from\s*["']@\/app\/api\/catalog\/catalog-service["'];/
)?.[0] ?? "";

if (/export async function reserveProduct\(/.test(catalogService)) {
  failures.push("catalog-service still exports reserveProduct().");
}

if (/export async function cancelReservationForProduct\(/.test(catalogService)) {
  failures.push("catalog-service still exports cancelReservationForProduct().");
}

if (/\breserveProduct\b/.test(catalogServiceImportBlock)) {
  failures.push("bulk route still imports reserveProduct from catalog-service.");
}

if (/\bcancelReservationForProduct\b/.test(catalogServiceImportBlock)) {
  failures.push("bulk route still imports cancelReservationForProduct from catalog-service.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Reservation service ownership static checks passed.");
