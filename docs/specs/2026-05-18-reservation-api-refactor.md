# Reservation API Refactor Spec

## Problem

Reservation behavior is currently split between server API routes and direct browser Supabase table writes.

The Supabase reservation adapter already uses server routes for listing reservations, updating seller comments, and expiring old reservations. The same adapter still uses `getBrowserSupabaseClient()` to insert and update rows in `public.reservations` for reservation upsert, cancellation, and completion.

That split creates a fragile security and behavior boundary:

- Browser writes depend on Supabase RLS and JWT role claims.
- Server routes use the app's actual staff role resolution through Supabase Auth, `profiles`, and `getRequestStaffRole()`.
- Production staff access can fail or drift if JWT role claims and profile roles are not identical.
- Reservation lifecycle rules become harder to reason about because writes can bypass the API layer that the rest of the app already uses.

## Goal

Move reservation mutations behind Next.js API routes so browser code never writes directly to `public.reservations`.

The browser reservation repository should call app APIs with the current Supabase session token. Server routes should validate staff role first, then use the server Supabase admin client for database writes.

## Current Code Shape

Direct browser writes are in:

- `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`

Existing server routes are:

- `src/app/api/reservations/route.ts`
- `src/app/api/reservations/[id]/seller-comment/route.ts`
- `src/app/api/reservations/expire/route.ts`

Existing auth helpers are:

- `src/lib/auth/server.ts`
- `src/lib/auth/request-headers.ts`
- `src/lib/supabase/admin.ts`

Existing product reservation workflow helpers live in:

- `src/app/api/catalog/catalog-service.ts`

## Target Behavior

- `GET /api/reservations?status=active` continues to list reservations for admins and sellers.
- `POST /api/reservations` creates or updates the active reservation for a product.
- `POST /api/reservations/product/[productId]/cancel` cancels the active reservation for one product.
- `POST /api/reservations/product/[productId]/complete` completes the active reservation for one product.
- `PATCH /api/reservations/[id]/seller-comment` continues to update seller comments.
- `POST /api/reservations/expire` continues to expire old reservations.
- Browser code calls `fetch()` for every reservation mutation.
- No browser feature code calls `.from("reservations").insert(...)` or `.from("reservations").update(...)`.

## Proposed API Contracts

### Upsert Reservation

Route:

```http
POST /api/reservations
```

Request body:

```json
{
  "productId": "catalog-item-uuid",
  "reservedForAt": "2026-05-18T12:00:00.000Z",
  "expiresAt": "2026-05-25T12:00:00.000Z",
  "note": "optional staff note",
  "customerName": "optional customer name",
  "customerPhone": "optional phone",
  "messengerProfileUrl": "optional messenger url",
  "reservationSource": "manual",
  "sellerComment": "optional seller comment"
}
```

Response body:

```json
{
  "data": {
    "id": "reservation-uuid",
    "productId": "catalog-item-uuid",
    "status": "active"
  }
}
```

The actual response should return the full `ReservationDTO`.

### Cancel Product Reservation

Route:

```http
POST /api/reservations/product/[productId]/cancel
```

Request body:

```json
{
  "reason": "seller_cancelled",
  "note": "Cancelled from reserved items page."
}
```

Response body:

```json
{
  "data": {
    "ok": true
  }
}
```

### Complete Product Reservation

Route:

```http
POST /api/reservations/product/[productId]/complete
```

Request body:

```json
{}
```

Response body:

```json
{
  "data": {
    "ok": true
  }
}
```

## Authorization Contract

Every reservation mutation route must do this before database writes:

```ts
const role = await getRequestStaffRole(request);
if (role !== "admin" && role !== "seller") {
  return NextResponse.json(
    { error: "Only admins and sellers can manage reservations." },
    { status: 403 }
  );
}
```

After the role check passes, the route may use `getServerSupabaseAdminClient()`.

The service role key must remain server-only. It must never appear in browser code or `NEXT_PUBLIC_*` environment variables.

## Non-Goals

- Do not redesign the whole catalog service in this pass.
- Do not change live database schema in this pass.
- Do not change RLS policies in this pass unless implementation proves a policy blocks an intentional API read.
- Do not remove mock reservation behavior in this pass.
- Do not change reservation UI design in this pass.
- Do not implement sale creation from reservation completion in this pass. Completion should preserve the current repository contract unless a separate sales workflow decision is made.

## Acceptance Criteria

- Browser reservation adapter has no direct Supabase writes to `public.reservations`.
- Reservation mutations pass through server routes with staff role checks.
- Existing reservation screens still list, create, cancel, comment, and expire reservations.
- `npm run build` passes.
- A search confirms there are no browser reservation insert/update calls.
