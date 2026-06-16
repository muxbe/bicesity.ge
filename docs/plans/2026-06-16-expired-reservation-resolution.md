# Expired Reservation Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff resolve expired reservations by either releasing the product back to active inventory or marking it sold while keeping the reservation record expired.

**Architecture:** Add a reservation-owned API route at `POST /api/reservations/[id]/resolve-expired`, expose it through the reservation repository, then wire an expired-only modal into `/admin/reservations`. The server owns all persistence rules; the client only collects outcome inputs and publishes invalidation after success.

**Tech Stack:** Next.js App Router route handlers, Supabase admin client, reservation repository adapters, React client components, existing i18n dictionaries, static verifier scripts.

---

## Status

Draft for approval. Do not implement until approved.

## Current Findings

1. Existing spec source:
   - `docs/plans/2026-06-11-reservations-lifecycle-page.md`, Task 5 and Task 6.
2. Current expired behavior:
   - `src/app/api/reservations/expire/route.ts` marks past active reservations as `expired`.
   - It sets `cancellation_reason_code = "expired"` and `cancellation_note = "Automatically expired."`.
   - It does not guide staff to decide the linked product outcome.
3. Current UI:
   - `src/features/reservations/admin/resolve-expired-reservation-modal.tsx` is only a hidden placeholder.
   - `src/features/reservations/admin/reservation-actions.tsx` returns `null` for every non-active reservation, so expired cards have no action yet.
4. Sales behavior:
   - `public.sales` already has `reservation_id`, `sale_channel`, `sale_price_cents`, `currency_code`, `sold_at`, and `audit_note`.
   - Existing `src/app/api/catalog/catalog-service.ts` `markAsSold` inserts a sale but does not pass `reservation_id`.
   - The database sale trigger only auto-links an active reservation when `reservation_id` is null, so expired-resolution sold must insert `reservation_id` explicitly.
5. No Supabase migration is needed for this slice.

## Locked Behavior

1. Only `admin` and `seller` can resolve expired reservations.
2. Only `expired` reservations can be resolved.
3. Reservation status stays `expired` for both outcomes.
4. Release outcome:
   - If linked product status is still `reserved`, change it to `active`.
   - If product is already `active`, leave it active.
   - Reject if product is `sold` or `archived`.
   - Update `cancellation_note` with an audit-style note.
5. Sold outcome:
   - Insert a `sales` row with `reservation_id` set to the expired reservation id.
   - Mark linked product `sold` with `stock_count = 0`.
   - Update `cancellation_note` with an audit-style note.
6. Client success publishes:
   - `RESERVATIONS_CRITICAL`
   - `CATALOG_CRITICAL`
   - `REPORTS_KPI`

## Files To Modify

1. `docs/tests/verify-admin-reservations-lifecycle-page.mjs`
   - Add static checks for expired resolution route, DTO, repository method, modal, actions, and i18n keys.
2. `src/features/reservations/dto/reservation-dto.ts`
   - Add `ResolveExpiredReservationDTO`.
3. `src/features/reservations/repositories/reservation-repository.ts`
   - Add `resolveExpiredReservation(reservationId, input): Promise<void>`.
4. `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`
   - Add fetch wrapper for `/api/reservations/${id}/resolve-expired`.
5. `src/features/reservations/adapters/mock/reservation-repository.mock.ts`
   - Mirror release and sold behavior in mock runtime data.
6. `src/app/api/reservations/reservation-service.ts`
   - Add server function `resolveExpiredReservation(reservationId, input, actorUserId)`.
7. `src/app/api/reservations/[id]/resolve-expired/route.ts`
   - Create route handler with staff RBAC, payload parsing, and domain error responses.
8. `src/features/reservations/admin/use-admin-reservations-controller.ts`
   - Add modal state and submit handlers for expired release/sold.
9. `src/features/reservations/admin/reservation-actions.tsx`
   - Show expired-only `Release Product` and `Mark Sold` buttons.
10. `src/features/reservations/admin/reservation-card.tsx`
   - Pass expired action handlers to `ReservationActions`.
11. `src/features/reservations/admin/resolve-expired-reservation-modal.tsx`
   - Replace placeholder with real modal.
12. `src/features/reservations/admin/admin-reservations-view.tsx`
   - Render modal with controller state and handlers.
13. `src/lib/i18n/dictionaries.ts`
   - Add EN/RU/KA labels, validation, and error keys.

## Implementation Tasks

### Task 1: Add Failing Static Verifier

- [ ] Update `docs/tests/verify-admin-reservations-lifecycle-page.mjs`.
- [ ] Check for:
  - `ResolveExpiredReservationDTO`.
  - `resolveExpiredReservation` in repository interface and Supabase adapter.
  - `src/app/api/reservations/[id]/resolve-expired/route.ts`.
  - `ResolveExpiredReservationModal` no longer being hidden-only.
  - Expired actions in `reservation-actions.tsx`.
  - Required i18n keys.
- [ ] Run:

```powershell
node docs\tests\verify-admin-reservations-lifecycle-page.mjs
```

- [ ] Expected RED result: verifier fails for missing expired resolution implementation.

### Task 2: Add DTO And Repository Contract

- [ ] Add this DTO in `src/features/reservations/dto/reservation-dto.ts`:

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

- [ ] Export it from `src/features/reservations/index.ts`.
- [ ] Add repository method:

```ts
resolveExpiredReservation(
  reservationId: string,
  input: ResolveExpiredReservationDTO
): Promise<void>;
```

### Task 3: Add Server Resolve Function And Route

- [ ] Create route: `src/app/api/reservations/[id]/resolve-expired/route.ts`.
- [ ] Route behavior:
  - Require `admin` or `seller`.
  - Read JSON payload.
  - Call `resolveExpiredReservation(params.id, payload, auth?.user.id)`.
  - Return `{ data: { ok: true } }`.
- [ ] Service behavior:
  - Load reservation by id with linked `catalog_items`.
  - Require reservation status `expired`.
  - Release:
    - Reject linked product status `sold` or `archived`.
    - If linked product status `reserved`, update it to `active`.
    - Update reservation `cancellation_note`.
  - Sold:
    - Require `soldPrice >= 0`.
    - Insert `sales` row with explicit `reservation_id`.
    - Update linked product to `{ status: "sold", stock_count: 0 }`.
    - Update reservation `cancellation_note`.

### Task 4: Add Repository Adapter Implementations

- [ ] Supabase adapter:
  - POST to `/api/reservations/${reservationId}/resolve-expired`.
  - Use `getJsonAuthHeaders("seller")`.
  - Surface API error messages using existing `apiErrorMessage`.
- [ ] Mock adapter:
  - Find expired reservation.
  - Release sets product status to active unless sold/archived.
  - Sold inserts a `mockRuntimeStore.sales` row and marks product sold.
  - Update reservation cancellation note for both paths.

### Task 5: Add Expired Resolution UI

- [ ] Controller:
  - Add selected expired reservation state.
  - Add selected outcome state: `release` or `sold`.
  - Add note, sold price, sale channel, error, and submitting state.
  - On success, publish invalidation tags and reload reservations.
- [ ] Actions:
  - Active reservations keep cancel action.
  - Expired reservations show `Release Product` and `Mark Sold`.
  - Completed/cancelled reservations still show no mutating actions.
- [ ] Modal:
  - Release form: optional note only.
  - Sold form: sold price, sale channel, optional note.
  - Validate sold price client-side before submit.

### Task 6: Add I18n Keys

- [ ] Add matching keys to all dictionaries:
  - `reservations.expiredOutcomeTitle`
  - `reservations.expiredOutcomeDescription`
  - `reservations.releaseProduct`
  - `reservations.markSoldAfterExpiry`
  - `reservations.resolveExpiredNote`
  - `reservations.resolveExpiredSoldPrice`
  - `reservations.resolveExpiredSaleChannel`
  - `reservations.resolveExpiredSubmit`
  - `reservations.resolveExpiredPriceRequired`
  - `reservations.resolveExpiredFailed`

### Task 7: Verification

- [ ] Run:

```powershell
node docs\tests\verify-admin-reservations-lifecycle-page.mjs
node docs\tests\verify-reservation-api-refactor.mjs
node docs\tests\verify-reservation-service-ownership.mjs
node docs\tests\verify-i18n-dictionaries.mjs
node docs\tests\verify-max-file-lines.mjs
git diff --check
npm run build
```

- [ ] Expected result: all pass.

## Deployment Plan

After implementation and verification:

1. Commit the slice.
2. Push `main`.
3. Deploy production with Vercel.
4. Verify:
   - `/admin/reservations` returns 200.
   - `/admin` returns 200.

## Approval Question

Implement this exact expired reservation resolution slice now?
