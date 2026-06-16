# Reservations Lifecycle Page Spec

## Status

Draft for review. Do not implement until approved.

## Problem

The reservations page is DB-backed, but it is still mostly a raw history list. Staff need a clearer workflow for reservation lifecycle management:

1. See active, completed, cancelled, and expired reservations separately.
2. Quickly find reservations by customer, product, serial, phone, or source.
3. Handle expired reservations with an operational decision: release the product back to active inventory or mark it sold.
4. Keep reservation records locked after completion/cancellation/expiry, except for the explicit expired-outcome workflow.
5. Preserve the existing admin/seller permissions and freshness behavior.

## Current State

Relevant files:

1. `src/app/admin/reservations/page.tsx`
2. `src/features/reservations/repositories/use-reservation-data.ts`
3. `src/features/reservations/repositories/reservation-repository.ts`
4. `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`
5. `src/app/api/reservations/reservation-service.ts`
6. `src/app/api/reservations/expire/route.ts`
7. `src/app/api/reservations/product/[productId]/cancel/route.ts`
8. `src/app/api/reservations/product/[productId]/complete/route.ts`
9. `src/lib/i18n/dictionaries.ts`

Existing behavior:

1. `useReservationData('all')` loads reservations and calls `expirePastReservations()` before listing.
2. `/api/reservations/expire` marks past active reservations as `expired`.
3. `/admin/reservations` lists all reservations sorted by `reservedForAt`.
4. Active reservations can be cancelled from the page.
5. Seller comments can be edited from the page.
6. The page shows one active-count card, not lifecycle counts.

Important gap:

When a reservation expires, the reservation status becomes `expired`, but the page does not guide staff to decide what happens to the product next. Step 9 requires an operational follow-up prompt to mark outcome as sold/release.

## Locked Requirements From Product Plan

Source: `docs/whole-product-plan.md`, Step 9.

1. Lifecycle statuses are `active -> completed/cancelled/expired`.
2. Expiration is automatic when reservation datetime passes.
3. One active reservation per product remains enforced.
4. Reservations are admin/seller-managed in v1.
5. Times are stored UTC and rendered in user locale/timezone.
6. Selling an item closes the active reservation.
7. Reservations are editable while active and locked after completion/cancellation/expiry.
8. Cancellation requires a reason code plus optional note.
9. Notifications are later; v1 keeps in-app status flow.
10. Reservation KPIs must support reporting later.
11. Admin/seller manage reservations; only admin gets full analytics.
12. Acceptance requires persistence, lifecycle, conflict, and RBAC tests.

## Proposed UX

### Header

Show:

1. Page title: `Reservations`
2. Description: `Reserved items and lifecycle history.`
3. Refresh/stale indicators already used in the app.
4. Manual reload button.

### Summary Cards

Replace the single active-count card with four cards:

1. Active
2. Completed
3. Cancelled
4. Expired

Counts are derived from the currently loaded reservation list for this slice. If the list becomes paginated later, add a count endpoint then.

### Filters

Add client-side filters:

1. Status tab: `All`, `Active`, `Completed`, `Cancelled`, `Expired`
2. Search input across:
   - product name
   - serial
   - customer name
   - customer phone
   - messenger profile URL
   - source
3. Date filter:
   - `All`
   - `Today`
   - `Upcoming`
   - `Past`

Default filter:

1. Status: `Active`
2. Date: `All`
3. Search: empty

### Reservation Card Behavior

For every reservation card:

1. Show product image, product name, serial, category, price, status, customer summary, seller comment, meeting time, and expiry time.
2. Use localized date/time rendering.
3. Keep seller comment editable only for `active` reservations.
4. For non-active reservations, render seller comment as read-only text.

### Active Reservation Actions

For active reservations:

1. `Cancel`
   - Requires a reason selector.
   - Reason options: customer cancelled, seller cancelled, no-show, other.
   - Optional note.
   - Uses existing cancel endpoint after adding reason UI.
2. `Complete`
   - Confirms the reservation was completed without sale.
   - Uses existing complete endpoint.
   - Completion without sale releases the product back to `active`.
   - If the item was sold, staff must use `Mark Sold` instead.
3. `Mark Sold`
   - Reuse existing sold flow shape from inventory.
   - Should close the reservation and mark the product sold in one server-side operation.

### Expired Reservation Actions

For expired reservations:

1. Show an operational prompt: `Reservation expired. Choose product outcome.`
2. `Release Product`
   - Product returns to active inventory if it is still reserved.
   - Reservation remains `expired`.
   - Add audit/cancellation note: `Product released after reservation expiry.`
3. `Mark Sold`
   - Product becomes sold.
   - Reservation remains `expired` or becomes `completed_after_expiry` only if schema changes. Since schema is locked to four statuses, recommended: keep reservation `expired`, create sale record, and include audit note linking sale to expired reservation.

No schema change is required for v1 if we keep the four locked statuses.

## API Plan

### Existing APIs To Keep

1. `GET /api/reservations?status=...`
2. `POST /api/reservations/expire`
3. `POST /api/reservations/product/[productId]/cancel`
4. `POST /api/reservations/product/[productId]/complete`
5. `PATCH /api/reservations/[id]/seller-comment`

### New API Needed

Create:

`POST /api/reservations/[id]/resolve-expired`

Payload:

```ts
type ResolveExpiredReservationPayload =
  | {
      outcome: "release";
      note?: string;
    }
  | {
      outcome: "sold";
      soldPrice: number;
      saleChannel: "online" | "in_store" | "as_is";
      note?: string;
    };
```

Behavior:

1. Require `admin` or `seller`.
2. Load reservation by ID.
3. Require reservation status to be `expired`.
4. For `release`:
   - If the linked product status is `reserved`, update it to `active`.
   - Keep reservation status `expired`.
   - Update cancellation note / audit note with operator note.
5. For `sold`:
   - Insert sale record.
   - Update linked product to `sold`, `stock_count = 0`.
   - Keep reservation status `expired`.
   - Store audit note from payload.
6. Publish critical invalidation tags on the client after success:
   - reservations
   - catalog
   - reports KPI

## Repository Plan

Modify `ReservationRepository`:

```ts
resolveExpiredReservation(
  reservationId: string,
  input: ResolveExpiredReservationDTO
): Promise<void>;
```

Add DTOs:

```ts
export type ResolveExpiredReservationDTO =
  | {
      outcome: "release";
      note?: string;
    }
  | {
      outcome: "sold";
      soldPrice: number;
      saleChannel: "online" | "in_store" | "as_is";
      note?: string;
    };
```

## Component Plan

Split `src/app/admin/reservations/page.tsx` before adding more behavior.

Create:

1. `src/features/reservations/admin/reservation-summary-cards.tsx`
2. `src/features/reservations/admin/reservation-filters.tsx`
3. `src/features/reservations/admin/reservation-card.tsx`
4. `src/features/reservations/admin/reservation-actions.tsx`
5. `src/features/reservations/admin/resolve-expired-reservation-modal.tsx`
6. `src/features/reservations/admin/use-admin-reservations-controller.ts`

Keep page file thin:

```tsx
export default function ReservationsPage() {
  return <AdminReservationsView />;
}
```

## Implementation Tasks

### Task 1: Add Static Verifier And Page Split

Goal:

Create guardrails before changing behavior.

Files:

1. Create `docs/tests/verify-admin-reservations-lifecycle-page.mjs`
2. Modify `src/app/admin/reservations/page.tsx`
3. Create reservation admin component files listed above.

Verifier checks:

1. `page.tsx` imports and renders `AdminReservationsView`.
2. Controller file exists.
3. Filters component exists.
4. Summary cards component exists.
5. Reservation card component exists.
6. Expired resolution modal exists.

Run:

```powershell
node docs\tests\verify-admin-reservations-lifecycle-page.mjs
```

Expected before implementation:

```text
Reservations lifecycle page checks failed.
```

Expected after implementation:

```text
Reservations lifecycle page checks passed.
```

### Task 2: Add Filters And Counts

Goal:

Make the page usable as lifecycle history.

Behavior:

1. Default visible status is `active`.
2. Status tabs filter by status.
3. Search filters across product/customer/serial/source.
4. Date filter supports all/today/upcoming/past.
5. Summary cards show counts for all loaded statuses.

No API change yet.

### Task 3: Lock Non-Active Records

Goal:

Preserve Step 9 edit policy.

Behavior:

1. Active reservations keep editable seller comment.
2. Completed/cancelled/expired reservations show read-only comment.
3. Cancel/complete/sell actions only show on active reservations.
4. Expired reservations show only expired-outcome actions.

### Task 4: Add Cancel Reason Modal

Goal:

Make cancellation compliant with the locked cancellation policy.

Behavior:

1. Cancel button opens a modal.
2. Reason is required.
3. Note is optional.
4. Submit calls existing `cancelReservationByProductId(productId, reason, note)`.

### Task 5: Add Expired Resolution API

Goal:

Support release/sold operational outcome after automatic expiry.

Files:

1. Modify `src/features/reservations/dto/reservation-dto.ts`
2. Modify `src/features/reservations/repositories/reservation-repository.ts`
3. Modify `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`
4. Modify `src/app/api/reservations/reservation-service.ts`
5. Create `src/app/api/reservations/[id]/resolve-expired/route.ts`

Rules:

1. Only `admin` and `seller`.
2. Only expired reservations can be resolved.
3. Release only changes product status back to active when product is still reserved.
4. Sold inserts a sale and marks product sold.
5. Reservation status stays `expired`.

### Task 6: Add Expired Resolution Modal

Goal:

Give staff a clear workflow for expired reservations.

Behavior:

1. Expired card shows `Release Product` and `Mark Sold`.
2. `Release Product` asks for optional note.
3. `Mark Sold` asks for sold price, sale channel, optional note.
4. Success reloads reservations and publishes invalidation tags.

### Task 7: Add I18n Keys

Goal:

Keep page localized in English, Russian, and Georgian.

Add keys for:

1. Status tabs
2. Search placeholder
3. Date filter labels
4. Cancel reason modal
5. Expired outcome prompt
6. Release product
7. Mark sold after expiry
8. Read-only comment label
9. Validation/errors

### Task 8: Verification

Run:

```powershell
node docs\tests\verify-admin-reservations-lifecycle-page.mjs
node docs\tests\verify-reservation-api-refactor.mjs
node docs\tests\verify-reservation-service-ownership.mjs
node docs\tests\verify-i18n-dictionaries.mjs
npm run build
```

Done only when all pass.

## Definition Of Done

1. Page remains accessible at `/admin/reservations`.
2. Existing active reservation cancellation still works.
3. Staff can filter reservation history by status, date, and search text.
4. Active reservations can be cancelled with required reason.
5. Active reservations can be completed.
6. Expired reservations show an outcome prompt.
7. Staff can release product after expiry.
8. Staff can mark product sold after expiry.
9. Non-active reservation comments are read-only.
10. RBAC blocks non-staff users from mutation endpoints.
11. Reservation, catalog, and report invalidation tags fire after lifecycle actions.
12. Build and verification commands pass.

## Locked Decision

When an active reservation is marked `completed` without sale, the product returns to active inventory. Completion means the meeting happened but the item was not sold; if it was sold, staff must use `Mark Sold`.
