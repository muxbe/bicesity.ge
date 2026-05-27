import { lineCount, pathExists, failIfAny, listFiles } from "./structure-test-helpers.mjs";

const trackedFiles = [
  { path: "src/features/admin/admin-inventory-view.tsx", max: 2101, reason: "legacy file before admin inventory split" },
  { path: "src/app/admin/fields/page.tsx", max: 1250, reason: "legacy file before fields split" },
  { path: "src/app/page.tsx", max: 1050, reason: "legacy file before public shop split" },
  { path: "src/app/shop/[id]/page.tsx", max: 650, reason: "legacy file before product detail split" },
  { path: "src/lib/i18n/dictionaries.ts", max: 1600, reason: "legacy file before i18n split" },
  { path: "src/app/api/catalog/catalog-service.ts", max: 1050, reason: "legacy file before backend service split" },
  { path: "src/app/api/fields/field-service.ts", max: 700, reason: "legacy file before backend service split" },
  { path: "src/app/api/reservations/reservation-service.ts", max: 520, reason: "legacy file before backend service split" },
];

const futureFolderLimits = [
  { dir: "src/components/ui", max: 220 },
  { dir: "src/features/admin/inventory/components", max: 360 },
  { dir: "src/features/admin/inventory/hooks", max: 260 },
  { dir: "src/server", max: 420 },
];

const failures = [];

for (const item of trackedFiles) {
  if (!pathExists(item.path)) {
    continue;
  }
  const count = lineCount(item.path);
  if (count > item.max) {
    failures.push(`${item.path}: ${count} lines exceeds ${item.max} (${item.reason})`);
  }
}

for (const group of futureFolderLimits) {
  for (const file of listFiles(group.dir, [".ts", ".tsx"])) {
    const count = lineCount(file);
    if (count > group.max) {
      failures.push(`${file}: ${count} lines exceeds ${group.max}`);
    }
  }
}

failIfAny(failures, "Max file line checks passed.");
