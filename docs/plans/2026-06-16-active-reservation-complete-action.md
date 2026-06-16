# Active Reservation Complete Action Plan

## Status

Approved for implementation.

## Goal

Let staff complete an active reservation from `/admin/reservations` when the meeting happened but the item was not sold.

## Current Findings

1. Existing backend support is already present:
   - `ReservationRepository.completeReservationByProductId(productId)` exists.
   - Supabase adapter posts to `/api/reservations/product/[productId]/complete`.
   - Mock adapter marks active reservations `completed`.
   - API route requires `admin` or `seller` and calls `completeActiveReservationByProductId`.
2. Current UI gap:
   - Active reservation cards only show `Cancel`.
   - There is no confirmation modal, so staff cannot complete reservations from the lifecycle page.
3. No Supabase migration is needed.

## Locked Behavior

1. Only active reservations show `Complete`.
2. Clicking `Complete` opens a confirmation modal.
3. Submitting calls `reservationRepository.completeReservationByProductId(productId)`.
4. Success publishes:
   - `RESERVATIONS_CRITICAL`
   - `CATALOG_CRITICAL`
   - `REPORTS_KPI`
5. Success reloads reservations and closes the modal.
6. Failure keeps the modal open and shows the API/repository error.
7. Completed/cancelled/expired reservations do not show this action.

## Files To Modify

1. `docs/tests/verify-admin-reservations-lifecycle-page.mjs`
   - Add checks for complete modal, controller state/submit handler, action button, view wiring, and i18n keys.
2. `src/features/reservations/admin/use-admin-reservations-controller.ts`
   - Add selected reservation, submitting state, error state, open/close/submit handlers.
3. `src/features/reservations/admin/reservation-actions.tsx`
   - Add active-only `Complete` button beside `Cancel`.
4. `src/features/reservations/admin/reservation-card.tsx`
   - Pass complete action props to `ReservationActions`.
5. `src/features/reservations/admin/complete-reservation-modal.tsx`
   - Create confirmation modal.
6. `src/features/reservations/admin/admin-reservations-view.tsx`
   - Render and wire `CompleteReservationModal`.
7. `src/lib/i18n/dictionaries.ts`
   - Add EN/RU/KA labels and error text.

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
