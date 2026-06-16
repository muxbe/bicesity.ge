import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const files = {
  page: "src/app/admin/reservations/page.tsx",
  view: "src/features/reservations/admin/admin-reservations-view.tsx",
  controller: "src/features/reservations/admin/use-admin-reservations-controller.ts",
  filters: "src/features/reservations/admin/reservation-filters.tsx",
  summaryCards: "src/features/reservations/admin/reservation-summary-cards.tsx",
  card: "src/features/reservations/admin/reservation-card.tsx",
  actions: "src/features/reservations/admin/reservation-actions.tsx",
  resolveExpiredModal:
    "src/features/reservations/admin/resolve-expired-reservation-modal.tsx",
};

const source = {};
const failures = [];

for (const [key, relativePath] of Object.entries(files)) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing ${relativePath}.`);
    source[key] = "";
    continue;
  }
  source[key] = readFileSync(absolutePath, "utf8");
}

if (
  !/import\s+\{\s*AdminReservationsView\s*\}/.test(source.page) ||
  !/<AdminReservationsView\s*\/>/.test(source.page)
) {
  failures.push("Reservations page must be a thin AdminReservationsView entry.");
}

if (!/useReservationData\s*\(\s*['"]all['"]\s*\)/.test(source.controller)) {
  failures.push("Controller must load all reservations for lifecycle filtering.");
}

if (!/statusFilter/.test(source.controller) || !/dateFilter/.test(source.controller)) {
  failures.push("Controller must expose status and date filters.");
}

if (!/visibleReservations/.test(source.controller)) {
  failures.push("Controller must expose visibleReservations.");
}

if (!/reservationCounts/.test(source.controller)) {
  failures.push("Controller must expose lifecycle reservationCounts.");
}

if (!/\['all',\s*'active',\s*'completed',\s*'cancelled',\s*'expired'\]/.test(source.filters)) {
  failures.push("Filters must expose all lifecycle status tabs.");
}

if (!/\['all',\s*'today',\s*'upcoming',\s*'past'\]/.test(source.filters)) {
  failures.push("Filters must expose all date filters.");
}

if (!/reservations\.searchPlaceholder/.test(source.filters)) {
  failures.push("Filters must include the reservations search placeholder.");
}

if (!/counts\.active/.test(source.summaryCards) || !/counts\.expired/.test(source.summaryCards)) {
  failures.push("Summary cards must render active/completed/cancelled/expired counts.");
}

if (!/reservation\.status\s*===\s*['"]active['"]/.test(source.card)) {
  failures.push("Reservation card must branch on active status.");
}

if (!/ReservationCommentEditor/.test(source.card)) {
  failures.push("Reservation card must keep editable comments for active reservations.");
}

if (!/reservations\.readOnlyComment/.test(source.card)) {
  failures.push("Reservation card must render a read-only comment label for non-active reservations.");
}

if (!/reservation\.status\s*!==\s*['"]active['"]/.test(source.actions)) {
  failures.push("Reservation actions must hide mutating actions for non-active reservations.");
}

if (!/resolve-expired-reservation-modal/.test(source.resolveExpiredModal)) {
  failures.push("Expired resolution modal placeholder must include a stable marker.");
}

if (failures.length > 0) {
  console.error(["Reservations lifecycle page checks failed.", ...failures].join("\n"));
  process.exit(1);
}

console.log("Reservations lifecycle page checks passed.");
