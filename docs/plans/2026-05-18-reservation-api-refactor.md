# Reservation API Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move reservation mutations from browser Supabase table writes to authenticated Next.js API routes.

**Architecture:** Keep the browser reservation repository as the feature-facing interface, but make it call server routes for every mutation. Server routes perform staff role checks with `getRequestStaffRole()` and use `getServerSupabaseAdminClient()` for database writes. Shared reservation mapping stays server-side where practical so API responses keep returning `ReservationDTO`.

**Tech Stack:** Next.js App Router, TypeScript, React, Supabase Auth, Supabase Postgres, `@supabase/supabase-js`.

---

## Files

- Read: `docs/specs/2026-05-18-reservation-api-refactor.md`
- Modify: `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`
- Modify: `src/app/api/reservations/route.ts`
- Create: `src/app/api/reservations/product/[productId]/cancel/route.ts`
- Create: `src/app/api/reservations/product/[productId]/complete/route.ts`
- Create: `src/app/api/reservations/reservation-service.ts`
- Read: `src/app/api/reservations/[id]/seller-comment/route.ts`
- Read: `src/app/api/reservations/expire/route.ts`
- Read: `src/lib/auth/server.ts`
- Read: `src/lib/auth/request-headers.ts`
- Read: `src/lib/supabase/admin.ts`
- Verify with: `npm run build`

## Current Problem Evidence

Direct reservation writes currently exist in:

```powershell
rg -n "getBrowserSupabaseClient|from\(\"reservations\"" src\features\reservations\adapters\supabase\reservation-repository.supabase.ts
```

Observed direct-write methods:

- `upsertReservation`
- `cancelReservationByProductId`
- `completeReservationByProductId`

## Task 1: Extract Or Add Server Reservation Mutation Helpers

**Files:**
- Create: `src/app/api/reservations/reservation-service.ts`
- Read: `src/app/api/reservations/route.ts`
- Read: `src/app/api/catalog/catalog-service.ts`

- [ ] **Step 1: Create the server helper file**

Create `src/app/api/reservations/reservation-service.ts` because `route.ts`, the explicit product action routes, `seller-comment`, and `expire` all belong to the same reservation server boundary.

- [ ] **Step 2: Move or duplicate reservation row mapping server-side**

The helper must preserve the current `ReservationDTO` shape from `src/features/reservations/dto/reservation-dto.ts`.

Required server helper signatures:

```ts
export async function listReservations(
  status: ReservationStatus | "all"
): Promise<ReservationDTO[]>;

export async function upsertReservation(
  input: UpsertReservationDTO,
  actorUserId?: string
): Promise<ReservationDTO>;

export async function cancelActiveReservationByProductId(
  productId: string,
  reason: ReservationCancelReason,
  note?: string,
  actorUserId?: string
): Promise<void>;

export async function completeActiveReservationByProductId(
  productId: string,
  actorUserId?: string
): Promise<void>;
```

Expected: all database writes in these helpers use `getServerSupabaseAdminClient()`.

- [ ] **Step 3: Preserve current upsert behavior**

The server upsert must match the existing browser behavior:

```text
If an active reservation exists for productId: update that reservation.
If no active reservation exists: insert a new active reservation.
After write: return the active ReservationDTO for that product.
```

Expected: an already reserved product can have its active reservation details updated.

## Task 2: Add API Route For Reservation Upsert

**Files:**
- Modify: `src/app/api/reservations/route.ts`

- [ ] **Step 1: Keep existing GET behavior**

The existing `GET` route must continue to support:

```http
GET /api/reservations
GET /api/reservations?status=active
```

Expected: admins and sellers can list reservations; other users receive `403`.

- [ ] **Step 2: Add POST handler**

Add a `POST` handler with this route-level authorization:

```ts
const role = await getRequestStaffRole(request);
if (role !== "admin" && role !== "seller") {
  return NextResponse.json(
    { error: "Only admins and sellers can manage reservations." },
    { status: 403 }
  );
}
```

Then parse `UpsertReservationDTO`, call the server helper, and return:

```ts
return NextResponse.json({ data: reservation }, { status: 201 });
```

Expected: browser repository can create or update reservations through `/api/reservations`.

## Task 3: Add Explicit Product Reservation Action Routes

**Files:**
- Create: `src/app/api/reservations/product/[productId]/cancel/route.ts`
- Create: `src/app/api/reservations/product/[productId]/complete/route.ts`

- [ ] **Step 1: Create cancel POST route**

Create `src/app/api/reservations/product/[productId]/cancel/route.ts` with a `POST` handler accepting:

```ts
type CancelReservationPayload = {
  reason?: ReservationCancelReason;
  note?: string;
};
```

Expected: the route cancels the active reservation for the product.

- [ ] **Step 2: Add staff authorization**

Use the same role check as the `POST /api/reservations` route in both action routes.

Expected: anonymous and non-staff users receive `403`.

- [ ] **Step 3: Implement cancel action**

For cancel, call:

```ts
await cancelActiveReservationByProductId(
  params.productId,
  payload.reason ?? "seller_cancelled",
  payload.note,
  auth?.user.id
);
```

Expected: active reservation becomes cancelled, and database triggers keep catalog status in sync.

- [ ] **Step 4: Create complete POST route**

Create `src/app/api/reservations/product/[productId]/complete/route.ts` with a `POST` handler. The request body may be empty.

Expected: the route completes the active reservation for the product.

- [ ] **Step 5: Implement complete action**

For complete, call:

```ts
await completeActiveReservationByProductId(params.productId, auth?.user.id);
```

Expected: active reservation becomes completed, preserving the current repository contract.

## Task 4: Convert Browser Reservation Repository To API Calls

**Files:**
- Modify: `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`

- [ ] **Step 1: Remove browser Supabase import**

Remove:

```ts
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
```

Expected: this adapter no longer creates a browser Supabase table client for reservation writes.

- [ ] **Step 2: Replace `upsertReservation` direct writes**

Call:

```ts
const response = await fetch("/api/reservations", {
  method: "POST",
  headers: await getJsonAuthHeaders("seller"),
  body: JSON.stringify(input),
});
```

Expected: the method returns the `ReservationDTO` from the API payload.

- [ ] **Step 3: Replace cancellation direct write**

Call:

```ts
const response = await fetch(
  `/api/reservations/product/${encodeURIComponent(productId)}/cancel`,
  {
    method: "POST",
    headers: await getJsonAuthHeaders("seller"),
    body: JSON.stringify({ reason, note }),
  }
);
```

Expected: cancellation errors use the existing `apiErrorMessage` helper.

- [ ] **Step 4: Replace completion direct write**

Call:

```ts
const response = await fetch(
  `/api/reservations/product/${encodeURIComponent(productId)}/complete`,
  {
    method: "POST",
    headers: await getJsonAuthHeaders("seller"),
    body: JSON.stringify({}),
  }
);
```

Expected: completion errors use the existing `apiErrorMessage` helper.

## Task 5: Verification

**Files:**
- All modified files

- [ ] **Step 1: Search for remaining direct reservation writes**

Run:

```powershell
rg -n "getBrowserSupabaseClient|from\(\"reservations\"\)\.(insert|update)" src\features\reservations
```

Expected: no direct browser insert/update calls remain in reservation feature code.

- [ ] **Step 2: Run build**

Run:

```powershell
npm run build
```

Expected: build exits with code 0.

- [ ] **Step 3: Manual smoke test after build**

Run the app and verify these flows:

```text
Admin inventory: reserve an active item.
Admin reservations: cancel that reservation.
Admin reservations: save a seller comment.
Admin reservations: reload list and confirm data persists.
```

Expected: all flows work through API routes with no browser table-write dependency.

## Approval Checkpoint

This plan is not implementation approval. After review, choose:

```text
A. Implement this plan exactly.
B. Adjust the route shape before implementation.
C. Stop here and keep this as documentation.
```
