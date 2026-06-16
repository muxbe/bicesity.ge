import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const files = {
  page: "src/app/admin/reservations/page.tsx",
  view: "src/features/reservations/admin/admin-reservations-view.tsx",
  controller: "src/features/reservations/admin/use-admin-reservations-controller.ts",
  dto: "src/features/reservations/dto/reservation-dto.ts",
  index: "src/features/reservations/index.ts",
  repository: "src/features/reservations/repositories/reservation-repository.ts",
  supabaseRepository:
    "src/features/reservations/adapters/supabase/reservation-repository.supabase.ts",
  mockRepository: "src/features/reservations/adapters/mock/reservation-repository.mock.ts",
  service: "src/app/api/reservations/reservation-service.ts",
  resolveExpiredService: "src/app/api/reservations/resolve-expired-service.ts",
  resolveExpiredRoute:
    "src/app/api/reservations/[id]/resolve-expired/route.ts",
  filters: "src/features/reservations/admin/reservation-filters.tsx",
  summaryCards: "src/features/reservations/admin/reservation-summary-cards.tsx",
  card: "src/features/reservations/admin/reservation-card.tsx",
  actions: "src/features/reservations/admin/reservation-actions.tsx",
  cancelModal: "src/features/reservations/admin/cancel-reservation-modal.tsx",
  cancelRoute: "src/app/api/reservations/product/[productId]/cancel/route.ts",
  dictionary: "src/lib/i18n/dictionaries.ts",
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

if (!/ResolveExpiredReservationDTO/.test(source.dto)) {
  failures.push("Reservation DTO must expose ResolveExpiredReservationDTO.");
}

if (!/ResolveExpiredReservationDTO/.test(source.index)) {
  failures.push("Reservations feature index must export ResolveExpiredReservationDTO.");
}

if (!/resolveExpiredReservation\s*\(/.test(source.repository)) {
  failures.push("Reservation repository must expose resolveExpiredReservation().");
}

if (!/resolveExpiredReservation\s*\(/.test(source.supabaseRepository)) {
  failures.push("Supabase reservation repository must implement resolveExpiredReservation().");
}

if (!/\/api\/reservations\/\$\{encodeURIComponent\(reservationId\)\}\/resolve-expired/.test(source.supabaseRepository)) {
  failures.push("Supabase repository must call the resolve-expired API route.");
}

if (!/resolveExpiredReservation\s*\(/.test(source.mockRepository)) {
  failures.push("Mock reservation repository must implement resolveExpiredReservation().");
}

if (!/resolveExpiredReservation/.test(source.service)) {
  failures.push("Reservation service must export resolveExpiredReservation().");
}

if (!/export\s+async\s+function\s+resolveExpiredReservation/.test(source.resolveExpiredService)) {
  failures.push("Expired resolution service must export resolveExpiredReservation().");
}

if (!/reservation_id/.test(source.resolveExpiredService) || !/sale_price_cents/.test(source.resolveExpiredService)) {
  failures.push("Expired sold resolution must insert a sale linked to reservation_id.");
}

if (!/resolveExpiredReservation/.test(source.resolveExpiredRoute)) {
  failures.push("Resolve-expired route must call resolveExpiredReservation().");
}

if (!/Only admins and sellers can resolve expired reservations/.test(source.resolveExpiredRoute)) {
  failures.push("Resolve-expired route must enforce staff-only RBAC.");
}

if (/cancelReservationByProductId\(\s*[^,]+,\s*['"]seller_cancelled['"]/.test(source.controller)) {
  failures.push("Admin reservations controller must not hard-code seller_cancelled.");
}

if (!/cancelModalReservation/.test(source.controller) || !/submitCancelReservation/.test(source.controller)) {
  failures.push("Controller must expose cancel modal state and submit handler.");
}

if (!/expiredResolutionReservation/.test(source.controller) || !/submitExpiredResolution/.test(source.controller)) {
  failures.push("Controller must expose expired resolution modal state and submit handler.");
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

if (!/reservation\.status\s*===\s*['"]expired['"]/.test(source.actions)) {
  failures.push("Reservation actions must expose expired-only actions.");
}

if (!/reservations\.releaseProduct/.test(source.actions) || !/reservations\.markSoldAfterExpiry/.test(source.actions)) {
  failures.push("Expired actions must render release and mark-sold buttons.");
}

if (!/CancelReservationModal/.test(source.cancelModal)) {
  failures.push("CancelReservationModal component must exist.");
}

for (const reason of ["customer_cancelled", "seller_cancelled", "no_show", "other"]) {
  if (!source.cancelModal.includes(reason)) {
    failures.push(`Cancel modal must expose ${reason} reason option.`);
  }
}

if (!/reservations\.cancelReasonRequired/.test(source.cancelModal)) {
  failures.push("Cancel modal must render required reason validation text.");
}

if (!/CancelReservationModal/.test(source.view)) {
  failures.push("Admin reservations view must render the cancel reason modal.");
}

if (/return\s+['"]seller_cancelled['"]/.test(source.cancelRoute)) {
  failures.push("Cancel API must not default missing reason to seller_cancelled.");
}

if (!/Reservation cancellation reason is required/.test(source.cancelRoute)) {
  failures.push("Cancel API must reject missing cancellation reason.");
}

if (!/ResolveExpiredReservationModal/.test(source.resolveExpiredModal)) {
  failures.push("Expired resolution modal component must exist.");
}

if (/className=["']hidden["']/.test(source.resolveExpiredModal)) {
  failures.push("Expired resolution modal must not be a hidden placeholder.");
}

if (!/outcome:\s*['"]release['"]/.test(source.resolveExpiredModal) || !/outcome:\s*['"]sold['"]/.test(source.resolveExpiredModal)) {
  failures.push("Expired resolution modal must support release and sold outcomes.");
}

if (!/ResolveExpiredReservationModal/.test(source.view)) {
  failures.push("Admin reservations view must render the expired resolution modal.");
}

for (const key of [
  "reservations.expiredOutcomeTitle",
  "reservations.expiredOutcomeDescription",
  "reservations.releaseProduct",
  "reservations.markSoldAfterExpiry",
  "reservations.resolveExpiredNote",
  "reservations.resolveExpiredSoldPrice",
  "reservations.resolveExpiredSaleChannel",
  "reservations.resolveExpiredSubmit",
  "reservations.resolveExpiredPriceRequired",
  "reservations.resolveExpiredFailed",
]) {
  if (!source.dictionary.includes(`"${key}"`)) {
    failures.push(`Dictionary must include ${key}.`);
  }
}

if (failures.length > 0) {
  console.error(["Reservations lifecycle page checks failed.", ...failures].join("\n"));
  process.exit(1);
}

console.log("Reservations lifecycle page checks passed.");
