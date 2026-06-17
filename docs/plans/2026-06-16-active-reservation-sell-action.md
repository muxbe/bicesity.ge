# Active Reservation Sell Action Plan

## Status

Approved for implementation.

## Goal

Let staff mark an active reservation sold from `/admin/reservations`, closing the active reservation and marking the linked product sold in one server-owned mutation.

## Current Findings

1. The existing catalog sell route is admin-only:
   - `src/app/api/catalog/[id]/sold/route.ts` uses `requireAdmin`.
   - The reservations lifecycle page should continue to work for both `admin` and `seller`.
2. The database sale trigger closes active reservations when a sale is inserted, but this slice should still set `reservation_id` explicitly for audit clarity.
3. Existing sales schema already supports:
   - `reservation_id`
   - `sale_channel`
   - `sale_price_cents`
   - `currency_code`
   - `sold_at`
   - `audit_note`
4. No Supabase migration is needed.

## Locked Behavior

1. Only active reservations show the active `Mark Sold` action.
2. Clicking `Mark Sold` opens a modal with:
   - sold price
   - sale channel
   - optional audit note
3. Submit requires a valid non-negative sold price.
4. Server route requires `admin` or `seller`.
5. Server route requires reservation status `active`.
6. Server inserts a sale with explicit `reservation_id`.
7. Server marks the linked product `sold` with `stock_count = 0`.
8. The active reservation becomes `completed` through the existing sale trigger.
9. Client success publishes:
   - `RESERVATIONS_CRITICAL`
   - `CATALOG_CRITICAL`
   - `REPORTS_KPI`

## Files To Modify

1. `docs/tests/verify-admin-reservations-lifecycle-page.mjs`
   - Add checks for active sale DTO/repository/route/service/modal/action/i18n.
2. `src/features/reservations/dto/reservation-dto.ts`
   - Add `SellActiveReservationDTO`.
3. `src/features/reservations/index.ts`
   - Export the new DTO.
4. `src/features/reservations/repositories/reservation-repository.ts`
   - Add `sellActiveReservation(reservationId, input): Promise<void>`.
5. `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`
   - POST to `/api/reservations/${reservationId}/sell`.
6. `src/features/reservations/adapters/mock/reservation-repository.mock.ts`
   - Mirror active sale behavior in mock data.
7. `src/app/api/reservations/sell-active-service.ts`
   - Add server helper for active reservation sale.
8. `src/app/api/reservations/[id]/sell/route.ts`
   - Add route with staff RBAC and domain error handling.
9. `src/app/api/reservations/reservation-service.ts`
   - Re-export helper.
10. `src/features/reservations/admin/use-admin-reservations-controller.ts`
   - Add modal state, validation, submit handler.
11. `src/features/reservations/admin/reservation-actions.tsx`
   - Add active-only mark sold button.
12. `src/features/reservations/admin/reservation-card.tsx`
   - Pass active sale props.
13. `src/features/reservations/admin/sell-active-reservation-modal.tsx`
   - Create modal.
14. `src/features/reservations/admin/admin-reservations-view.tsx`
   - Render modal.
15. `src/lib/i18n/dictionaries.ts`
   - Add EN/RU/KA active sale labels and error.

## Verification

Run:

```powershell
node docs\tests\verify-admin-reservations-lifecycle-page.mjs
node docs\tests\verify-reservation-api-refactor.mjs
node docs\tests\verify-reservation-service-ownership.mjs
node docs\tests\verify-i18n-dictionaries.mjs
node docs\tests\verify-max-file-lines.mjs
git diff --check
npm run build
```

Expected result: all pass.
