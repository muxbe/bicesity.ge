import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const files = {
  controller: "src/features/admin/inventory/hooks/use-admin-inventory-controller.ts",
  catalogData: "src/features/catalog/repositories/use-catalog-data.ts",
  repository: "src/features/catalog/repositories/catalog-repository.ts",
  dto: "src/features/catalog/dto/catalog-dto.ts",
  supabaseAdapter: "src/features/catalog/adapters/supabase/catalog-repository.supabase.ts",
  mockAdapter: "src/features/catalog/adapters/mock/catalog-repository.mock.ts",
  catalogService: "src/app/api/catalog/catalog-service.ts",
  countsRoute: "src/app/api/catalog/counts/route.ts",
  filtersHook: "src/features/admin/inventory/hooks/use-inventory-filters.ts",
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, relativePath]) => {
    const absolutePath = path.join(repoRoot, relativePath);
    return [key, existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : ""];
  })
);
const failures = [];

if (!/status:\s*statusView/.test(source.controller)) {
  failures.push("Admin inventory must pass the current statusView to useCatalogData.");
}

if (/statusView\s*===\s*['"]archived['"][\s\S]*['"]all['"]/.test(source.controller)) {
  failures.push("Admin inventory must not fetch all products for active/reserved/sold views.");
}

if (!/export type CatalogStatusCounts/.test(source.dto)) {
  failures.push("Catalog DTOs must expose CatalogStatusCounts.");
}

if (!/listStatusCounts\(\):\s*Promise<CatalogStatusCounts>/.test(source.repository)) {
  failures.push("CatalogRepository must expose listStatusCounts.");
}

if (!/statusCounts:\s*CatalogStatusCounts/.test(source.catalogData)) {
  failures.push("useCatalogData must return statusCounts.");
}

if (!/repository\.listStatusCounts\s*\(\s*\)/.test(source.catalogData)) {
  failures.push("useCatalogData must load status counts separately from products.");
}

if (!/statusCounts/.test(source.filtersHook)) {
  failures.push("useInventoryFilters must consume statusCounts instead of deriving global counts only from product rows.");
}

if (!/\/api\/catalog\/counts/.test(source.supabaseAdapter)) {
  failures.push("Supabase catalog adapter must fetch the lightweight counts endpoint.");
}

if (!/async listStatusCounts/.test(source.mockAdapter)) {
  failures.push("Mock catalog adapter must implement listStatusCounts.");
}

if (!/export async function countProductsByStatus/.test(source.catalogService)) {
  failures.push("Catalog service must expose countProductsByStatus.");
}

if (!source.countsRoute) {
  failures.push("Catalog counts API route must exist.");
} else {
  if (!/getCatalogRole/.test(source.countsRoute)) {
    failures.push("Catalog counts API route must require a staff catalog role.");
  }
  if (!/export const dynamic\s*=\s*["']force-dynamic["']/.test(source.countsRoute)) {
    failures.push("Catalog counts API route must be explicitly dynamic because it reads request headers.");
  }
  if (!/countProductsByStatus/.test(source.countsRoute)) {
    failures.push("Catalog counts API route must call countProductsByStatus.");
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Admin inventory status-scoped fetch checks passed.");
