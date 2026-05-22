# Reservation Service Ownership Spec

## Problem

Reservation writes now mostly go through `src/app/api/reservations/reservation-service.ts`, but bulk reservation actions still route through catalog code.

Current duplicate ownership:

- `src/app/api/reservations/reservation-service.ts` writes reservation rows for reservation API routes.
- `src/app/api/catalog/catalog-service.ts` also exports `reserveProduct()` and `cancelReservationForProduct()`, which write reservation rows directly.
- `src/app/api/catalog/bulk/route.ts` imports those catalog-service reservation functions for `reserve` and `cancel_reservation`.

This works today, but it leaves reservation lifecycle behavior split across two services. Future changes to reservation validation, actor tracking, fallback behavior, or catalog status sync can drift.

## Goal

Make `reservation-service.ts` the single server-side owner for reservation lifecycle writes.

The bulk catalog route may continue to expose the same `/api/catalog/bulk` API to the frontend, but reservation-specific actions inside that route should delegate to reservation-service functions.

## Current Code Shape

Bulk catalog route:

- `src/app/api/catalog/bulk/route.ts`

Duplicate reservation write functions:

- `src/app/api/catalog/catalog-service.ts`
  - `reserveProduct()`
  - `cancelReservationForProduct()`

Reservation owner service:

- `src/app/api/reservations/reservation-service.ts`
  - `upsertReservation()`
  - `cancelActiveReservationByProductId()`
  - `completeActiveReservationByProductId()`

## Target Behavior

- Single-item reservation continues to work.
- Single-item reservation cancellation continues to work.
- Bulk reservation continues to work through `/api/catalog/bulk`.
- Bulk reservation cancellation continues to work through `/api/catalog/bulk`.
- `reservation-service.ts` owns writes to `public.reservations` for reservation lifecycle actions.
- `catalog-service.ts` no longer exports duplicate reservation lifecycle functions.
- No frontend route shape changes are required.
- No database migration is required.

## Design

Move the product-status synchronization currently embedded in catalog reservation helpers into reservation-service wrappers.

Reservation-service should expose product-oriented functions for catalog flows:

```ts
export async function reserveProductForReservation(
  productId: string,
  input: UpsertReservationDTO,
  actorUserId?: string
): Promise<void>;

export async function cancelProductReservation(
  productId: string,
  note?: string,
  actorUserId?: string
): Promise<void>;
```

Those functions should:

- validate product state with `getProductById()`
- call existing reservation helpers
- update `catalog_items.status` as fallback sync, preserving current app behavior even if database triggers are unavailable

## Non-Goals

- Do not redesign `/api/catalog/bulk`.
- Do not change frontend request payloads.
- Do not change Supabase schema, RLS, policies, or triggers.
- Do not change sale flow in this pass.
- Do not remove mock repository behavior.
- Do not change reservation UI.

## Acceptance Criteria

- `src/app/api/catalog/bulk/route.ts` does not import `reserveProduct` or `cancelReservationForProduct` from catalog-service.
- `src/app/api/catalog/catalog-service.ts` no longer exports `reserveProduct()` or `cancelReservationForProduct()`.
- Existing reservation API tests still pass.
- Bulk route still supports `reserve` and `cancel_reservation`.
- `npm run build` passes.
