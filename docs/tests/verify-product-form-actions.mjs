import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const productFormPath = path.join(repoRoot, "src/features/admin/inventory/components/product-form.tsx");
const legacyFilePath = path.join(repoRoot, "src/features/admin/admin-inventory-view.tsx");
const filePath = existsSync(productFormPath) ? productFormPath : legacyFilePath;
const source = readFileSync(filePath, "utf8");

const productFormStart = source.indexOf("function ProductForm({");
const productFormSource = productFormStart === -1 ? "" : source.slice(productFormStart);
const failures = [];

if (productFormStart === -1) {
  failures.push("Could not find ProductForm.");
}

if (!productFormSource.includes("product-form-actions-footer")) {
  failures.push("Product form does not have a sticky actions footer marker.");
}

if (!/product-form-actions-footer[\s\S]*type="button"[\s\S]*aria-label=\{t\('common\.cancel'\)\}/.test(productFormSource)) {
  failures.push("Product form footer does not expose a visible cancel action.");
}

if (!/product-form-actions-footer[\s\S]*type="submit"[\s\S]*aria-label=\{t\('inventory\.saveProduct'\)\}/.test(productFormSource)) {
  failures.push("Product form footer does not expose a visible save action.");
}

if (!/className="[\s\S]*sticky[\s\S]*bottom/.test(productFormSource)) {
  failures.push("Product form actions are not sticky at the bottom of the modal.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Product form actions static checks passed.");
