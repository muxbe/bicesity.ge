import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const hookPath = path.join(
  repoRoot,
  "src/features/admin/inventory/hooks/use-inventory-product-actions.ts"
);
const source = readFileSync(hookPath, "utf8");
const failures = [];

function functionSource(name) {
  const start = source.indexOf(`const ${name} =`);
  if (start === -1) {
    failures.push(`Could not find ${name}.`);
    return "";
  }

  const nextFunction = source.indexOf("\n  const ", start + 1);
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

const openCreate = functionSource("openCreate");
const openEdit = functionSource("openEdit");

if (/await\s+reload\s*\(/.test(openCreate)) {
  failures.push("openCreate must open the create modal without awaiting catalog reload.");
}

if (/await\s+reload\s*\(/.test(openEdit)) {
  failures.push("openEdit must open the edit modal without awaiting catalog reload.");
}

if (!/setCreateOpen\s*\(\s*true\s*\)/.test(openCreate)) {
  failures.push("openCreate must still open the create modal.");
}

if (!/openEditDraft\s*\(\s*product\s*\)/.test(openEdit)) {
  failures.push("openEdit must still open the edit modal draft.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Inventory modal open speed checks passed.");
