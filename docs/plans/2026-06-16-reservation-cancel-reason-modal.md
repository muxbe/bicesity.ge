# Reservation Cancel Reason Modal Plan

## Status

Draft for approval. Do not implement until approved.

## Goal

Make active reservation cancellation on `/admin/reservations` require an explicit reason code plus optional note before the reservation is cancelled.

## Current Findings

1. The database/API model already supports cancellation metadata:
   - `ReservationCancelReason` exists in `src/features/reservations/dto/reservation-dto.ts`.
   - `ReservationDTO` already includes `cancellationReasonCode` and `cancellationNote`.
   - `ReservationRepository.cancelReservationByProductId(productId, reason, note)` already accepts reason and note.
2. The admin reservations page currently bypasses the product rule:
   - `src/features/reservations/admin/use-admin-reservations-controller.ts` hard-codes `seller_cancelled`.
   - `src/features/reservations/admin/reservation-actions.tsx` cancels immediately when staff click `Cancel`.
3. The API currently allows missing reason:
   - `src/app/api/reservations/product/[productId]/cancel/route.ts` defaults an empty/missing reason to `seller_cancelled`.
   - This means another caller can still cancel without a real reason.
4. No Supabase migration is needed for this slice.

## Product Rule

Cancellation requires:

1. Reason code: `customer_cancelled`, `seller_cancelled`, `no_show`, or `other`.
2. Optional cancellation note.
3. The automatic `expired` reason must stay internal for expiry jobs and should not appear in the manual cancel modal.

## Implementation Scope

### Files To Modify

1. `src/features/reservations/admin/use-admin-reservations-controller.ts`
   - Add modal state: selected reservation, selected reason, note, validation error.
   - Replace direct cancel handler with open/close/submit handlers.
   - Submit should call `cancelReservationByProductId(productId, reason, note)`.
2. `src/features/reservations/admin/reservation-actions.tsx`
   - Keep button behavior, but rename callback intent to open the cancel modal.
3. `src/features/reservations/admin/admin-reservations-view.tsx`
   - Render the cancel reason modal.
   - Wire modal state and submit handlers from the controller.
4. Create `src/features/reservations/admin/cancel-reservation-modal.tsx`
   - Presentational modal with reason radio/select, optional note textarea, cancel/submit buttons.
   - Submit disabled while request is in progress.
5. `src/app/api/reservations/product/[productId]/cancel/route.ts`
   - Change `parseCancelReason` so missing/empty reason returns validation error.
   - Keep `expired` accepted only if we decide internal callers still need this route; otherwise reject it for manual route.
6. `src/lib/i18n/dictionaries.ts`
   - Add modal labels, reason labels, validation text, and submit/error text in all current dictionaries.
7. `docs/tests/verify-admin-reservations-lifecycle-page.mjs`
   - Add static checks for the cancel modal and no hard-coded reservation cancellation reason in the admin controller.

### Files Not To Modify

1. Supabase migrations.
2. Reservation database schema.
3. Expired reservation resolution modal/API.
4. Inventory reserved page cancel flow, unless we later decide it must also require a modal.

## Planned Behavior

1. Staff click `Cancel` on an active reservation card.
2. A modal opens with:
   - Reservation/product name context.
   - Required reason options:
     - Customer cancelled.
     - Seller cancelled.
     - No-show.
     - Other.
   - Optional note textarea.
3. Staff cannot submit without a reason.
4. Submit calls:

```ts
await reservationRepository.cancelReservationByProductId(
  reservation.productId,
  selectedReason,
  note
);
```

5. On success:
   - Publish reservation/catalog/report invalidation tags.
   - Reload reservations.
   - Close modal.
6. On failure:
   - Keep modal open.
   - Show the error message.

## Verification Plan

Run these after implementation:

```powershell
node docs\tests\verify-admin-reservations-lifecycle-page.mjs
node docs\tests\verify-i18n-dictionaries.mjs
node docs\tests\verify-max-file-lines.mjs
npm run build
```

Expected result:

1. Static reservation lifecycle checks pass.
2. I18n dictionaries remain aligned.
3. File line-size guard passes.
4. Next.js production build succeeds.

## Deployment Plan

After approval and successful verification:

1. Commit the slice.
2. Push to `main`.
3. Deploy production with Vercel.
4. Verify `/admin/reservations` loads in production.

## Approval Question

Implement this exact slice now?
