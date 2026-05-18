import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const filePath = path.join(repoRoot, "src/features/admin/admin-inventory-view.tsx");
const source = readFileSync(filePath, "utf8");

const failures = [];

if (!source.includes("preventImplicitReservationSubmit")) {
  failures.push("Reservation modal does not guard against implicit Enter-key form submission.");
}

if (!source.includes("reservation-modal-footer")) {
  failures.push("Reservation modal does not have an explicit sticky footer marker.");
}

if (!/type="button"[\s\S]*aria-label=\{t\('common\.cancel'\)\}/.test(source)) {
  failures.push("Reservation modal does not expose an explicit cancel button label.");
}

if (!/aria-label=\{t\('inventory\.saveReservation'\)\}/.test(source)) {
  failures.push("Reservation save button is missing an accessible save label.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Reservation modal safety static checks passed.");
