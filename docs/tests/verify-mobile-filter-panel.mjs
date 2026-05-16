import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = readFileSync(join(root, "src", "app", "page.tsx"), "utf8");

const navStart = source.indexOf('<nav className="sticky top-0 z-50');
const navClose = source.indexOf("</nav>", navStart);
const panel = source.indexOf('className="brand-filter-panel', navStart);
const closeLabel = source.indexOf("aria-label={t('common.close')}");
const closeButtonBlock =
  closeLabel === -1 ? "" : source.slice(Math.max(0, closeLabel - 300), closeLabel + 300);
const basicSearch = source.match(/const handleBasicSearch = \(event: FormEvent\) => \{\s*event\.preventDefault\(\);\s*applyFilters\(true\);\s*\};/);

const failures = [];

if (navStart === -1 || navClose === -1) {
  failures.push("Could not find the sticky nav boundaries.");
}

if (panel === -1) {
  failures.push("Could not find the detailed filter panel.");
}

if (panel !== -1 && navClose !== -1 && panel < navClose) {
  failures.push("Detailed filter panel is still inside the sticky nav.");
}

if (closeLabel === -1 || !closeButtonBlock.includes("onClick={() => setIsDetailedOpen(false)}")) {
  failures.push("Detailed filter panel is missing an in-panel close button.");
}

if (!basicSearch) {
  failures.push("Basic search does not collapse detailed filters.");
}

if (failures.length > 0) {
  console.error("mobile filter panel structure failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("mobile filter panel structure verified.");
