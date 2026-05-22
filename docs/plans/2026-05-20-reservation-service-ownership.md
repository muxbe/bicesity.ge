# Reservation Service Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make reservation-service the single owner of reservation lifecycle writes while preserving the existing bulk catalog API.

**Architecture:** Keep `/api/catalog/bulk` as the frontend-facing endpoint for bulk actions. Move reservation-specific product validation and catalog status sync into reservation-service wrappers, then make the bulk route call those wrappers. Remove duplicate reservation write helpers from catalog-service after the bulk route no longer imports them.

**Tech Stack:** Next.js App Router, TypeScript, Supabase server admin client, Supabase Postgres.

---

## Files

- Read: `docs/specs/2026-05-20-reservation-service-ownership.md`
- Modify: `src/app/api/reservations/reservation-service.ts`
- Modify: `src/app/api/catalog/bulk/route.ts`
- Modify: `src/app/api/catalog/catalog-service.ts`
- Create: `docs/tests/verify-reservation-service-ownership.mjs`
- Verify: `docs/tests/verify-reservation-api-refactor.mjs`
- Verify: `npm run build`

## Task 1: Add A Guard Test

**Files:**
- Create: `docs/tests/verify-reservation-service-ownership.mjs`

- [x] **Step 1: Write the failing guard**

Create a static guard that fails while catalog-service still owns reservation lifecycle functions:

```js
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const catalogService = readFileSync(
  path.join(repoRoot, "src/app/api/catalog/catalog-service.ts"),
  "utf8"
);
const bulkRoute = readFileSync(
  path.join(repoRoot, "src/app/api/catalog/bulk/route.ts"),
  "utf8"
);

const failures = [];

if (/export async function reserveProduct\(/.test(catalogService)) {
  failures.push("catalog-service still exports reserveProduct().");
}

if (/export async function cancelReservationForProduct\(/.test(catalogService)) {
  failures.push("catalog-service still exports cancelReservationForProduct().");
}

if (/from "@/app\/api\/catalog\/catalog-service";[\s\S]*reserveProduct/.test(bulkRoute)) {
  failures.push("bulk route still imports reserveProduct from catalog-service.");
}

if (/from "@/app\/api\/catalog\/catalog-service";[\s\S]*cancelReservationForProduct/.test(bulkRoute)) {
  failures.push("bulk route still imports cancelReservationForProduct from catalog-service.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Reservation service ownership static checks passed.");
```

- [x] **Step 2: Run the guard and confirm red**

Run:

```powershell
node docs\tests\verify-reservation-service-ownership.mjs
```

Expected: FAIL because the duplicate functions still exist today.

## Task 2: Add Product-Oriented Reservation Wrappers

**Files:**
- Modify: `src/app/api/reservations/reservation-service.ts`

- [x] **Step 1: Import product lookup**

Add imports:

```ts
import { getProductById } from "@/app/api/catalog/catalog-service";
import type { ProductDTO } from "@/features/catalog/dto/catalog-dto";
import { NotFoundError } from "@/features/shared/domain/errors";
```

- [x] **Step 2: Add catalog status sync helper**

Add this helper near the existing mutation helpers:

```ts
async function setCatalogItemStatus(
  productId: string,
  status: "active" | "reserved"
): Promise<void> {
  const supabase = getServerSupabaseAdminClient();
  const { error } = await supabase
    .from("catalog_items")
    .update({ status })
    .eq("id", productId);

  if (error) {
    throw new AdapterError(
      status === "reserved"
        ? "Failed to move product to reserved items."
        : "Failed to move product back to active items.",
      error
    );
  }
}
```

- [x] **Step 3: Add reserve wrapper**

Add:

```ts
type ProductReservationInput = Omit<UpsertReservationDTO, "productId" | "reservedForAt"> & {
  reservedForAt?: string;
};

export async function reserveProductForReservation(
  productId: string,
  input: ProductReservationInput = {},
  actorUserId?: string
): Promise<ProductDTO> {
  const product = await getProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found.", { productId });
  }
  if (product.status === "reserved") {
    throw new ValidationError("Product is already reserved.");
  }
  if (product.status !== "active") {
    throw new ValidationError("Only active products can be reserved.");
  }
  if (product.stockCount <= 0) {
    throw new ValidationError("Out-of-stock products cannot be reserved.");
  }

  await upsertReservation(
    {
      ...input,
      productId,
      reservedForAt: input.reservedForAt ?? new Date().toISOString(),
    },
    actorUserId
  );
  await setCatalogItemStatus(productId, "reserved");

  const updated = await getProductById(productId);
  if (!updated) {
    throw new NotFoundError("Product not found after reservation.", { productId });
  }
  return updated;
}
```

- [x] **Step 4: Add cancel wrapper**

Add:

```ts
export async function cancelProductReservation(
  productId: string,
  note?: string,
  actorUserId?: string
): Promise<ProductDTO> {
  const product = await getProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found.", { productId });
  }
  if (product.status !== "reserved") {
    throw new ValidationError("Only reserved products can have reservations cancelled.");
  }

  await cancelActiveReservationByProductId(
    productId,
    "seller_cancelled",
    note?.trim() || "Cancelled from reserved items page.",
    actorUserId
  );
  await setCatalogItemStatus(productId, "active");

  const updated = await getProductById(productId);
  if (!updated) {
    throw new NotFoundError("Product not found after cancelling reservation.", { productId });
  }
  return updated;
}
```

- [x] **Step 5: Run build check**

Run:

```powershell
npm run build
```

Expected: build passes or only reports the next import-cycle issue to resolve in Task 3.

## Task 3: Route Bulk Reservation Actions Through Reservation Service

**Files:**
- Modify: `src/app/api/catalog/bulk/route.ts`

- [x] **Step 1: Change imports**

Remove reservation helpers from the catalog-service import:

```ts
import {
  archiveProduct,
  getProductById,
  markAsSold,
  updateProduct,
} from "@/app/api/catalog/catalog-service";
```

Add:

```ts
import {
  cancelProductReservation,
  reserveProductForReservation,
} from "@/app/api/reservations/reservation-service";
import { getRequestAuth } from "@/lib/auth/server";
```

- [x] **Step 2: Capture actor user id once**

After role validation passes, add:

```ts
const auth = await getRequestAuth(request);
const actorUserId = auth?.user.id;
```

- [x] **Step 3: Replace reserve call**

Replace:

```ts
await reserveProduct(product.id, {
```

with:

```ts
await reserveProductForReservation(product.id, {
```

and pass `actorUserId` as the second argument after the payload object.

- [x] **Step 4: Replace cancel call**

Replace:

```ts
await cancelReservationForProduct(product.id, {
  note: body.payload?.note,
});
```

with:

```ts
await cancelProductReservation(product.id, body.payload?.note ?? undefined, actorUserId);
```

- [x] **Step 5: Run targeted guard**

Run:

```powershell
node docs\tests\verify-reservation-service-ownership.mjs
```

Expected: may still fail until Task 4 removes duplicate exports.

## Task 4: Remove Duplicate Catalog Reservation Helpers

**Files:**
- Modify: `src/app/api/catalog/catalog-service.ts`

- [x] **Step 1: Remove `reserveProduct()`**

Delete the whole function:

```ts
export async function reserveProduct(
  productId: string,
  input: ReserveProductInput = {}
): Promise<ProductDTO> {
  ...
}
```

- [x] **Step 2: Remove `cancelReservationForProduct()`**

Delete the whole function:

```ts
export async function cancelReservationForProduct(
  productId: string,
  input: CancelReservationInput = {}
): Promise<ProductDTO> {
  ...
}
```

- [x] **Step 3: Remove now-unused types/helpers if build identifies them**

Remove only imports, types, or helper functions that become unused because these two functions were deleted.

Run:

```powershell
npm run build
```

Expected: build output identifies any remaining unused code or type errors.

## Task 5: Verification

**Files:**
- All modified files

- [x] **Step 1: Run ownership guard**

Run:

```powershell
node docs\tests\verify-reservation-service-ownership.mjs
```

Expected: PASS.

- [x] **Step 2: Run existing reservation API guard**

Run:

```powershell
node docs\tests\verify-reservation-api-refactor.mjs
```

Expected: PASS.

- [x] **Step 3: Run build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

In the app:

```text
1. Select multiple active products.
2. Bulk reserve them.
3. Confirm they move to Reserved.
4. Select reserved products.
5. Bulk cancel reservations.
6. Confirm they move back to Active.
7. Single reserve and single cancel still work.
```

Expected: behavior matches current app, but reservation lifecycle writes now have one service owner.

## Approval Checkpoint

This plan is not implementation approval. Choose the next step:

```text
A. Implement Task 1 only, then stop and show me.
B. Adjust the plan first.
C. Stop here.
```
