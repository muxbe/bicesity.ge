# Catalog Service Structure Refactor Spec

Status: draft
Date: 2026-07-02
Project: VeloHub / Bike City

## Problem

`src/app/api/catalog/catalog-service.ts` works, but it has grown into the largest source file in the repository.

Current size and responsibilities:

- `catalog-service.ts` is about 1,005 lines.
- It contains Supabase row types, category/drive mappers, image URL/storage cleanup helpers, DTO mapping, discount patching, attribute-value sync, reservation-status sync, catalog read queries, count queries, create/update flows, critical field updates, sale flow, archive flow, clear flow, and restore flow.
- Route files depend on this service as the public catalog API, so a careless split can easily break imports or behavior.

The file is doing too many jobs. That makes future Supabase work riskier because changes to one concern require reading a large mixed service.

## Goal

Split `catalog-service.ts` into smaller backend modules while preserving the existing route-facing API and runtime behavior.

This is a structure refactor, not a feature change.

## Current Public API

These functions are currently imported by routes and other services and must remain available from `@/app/api/catalog/catalog-service` after the refactor:

- `listProducts`
- `countProductsByStatus`
- `listPublicActiveProducts`
- `getProductById`
- `listAttributes`
- `createProduct`
- `updateProduct`
- `updatePrice`
- `updateStockCount`
- `markAsSold`
- `archiveProduct`
- `clearArchivedProduct`
- `restoreProduct`

Known callers:

- `src/app/api/catalog/route.ts`
- `src/app/api/catalog/bulk/route.ts`
- `src/app/api/catalog/counts/route.ts`
- `src/app/api/catalog/[id]/route.ts`
- `src/app/api/catalog/[id]/critical/route.ts`
- `src/app/api/catalog/[id]/clear/route.ts`
- `src/app/api/catalog/[id]/restore/route.ts`
- `src/app/api/catalog/[id]/sold/route.ts`
- `src/app/api/shop/bootstrap/route.ts`
- `src/app/api/reservations/reservation-service.ts`

## Current Responsibility Groups

The current service naturally separates into these groups:

1. DB row types and shared constants
2. Product category and drive-type mapping
3. Product image URL parsing, insert-row building, replacement, and storage cleanup
4. Catalog row to `ProductDTO` mapping
5. Discount input parsing and DB patch building
6. Attribute value loading, validation, upsert, and clearing
7. Reservation status synchronization for catalog items
8. Catalog read queries and count queries
9. Product create/update commands
10. Critical price/stock update commands
11. Lifecycle/status commands: sold, archive, clear, restore

## Target Structure

Keep `src/app/api/catalog/catalog-service.ts` as the compatibility facade. It should stay small and export the same public functions as today.

Create focused backend modules under `src/app/api/catalog/services/`:

```txt
src/app/api/catalog/
  catalog-service.ts
  error-response.ts
  role.ts
  services/
    catalog-attributes.ts
    catalog-commands.ts
    catalog-images.ts
    catalog-lifecycle.ts
    catalog-mappers.ts
    catalog-queries.ts
    catalog-reservation-sync.ts
    catalog-types.ts
```

### `catalog-types.ts`

Owns internal Supabase row types, service options, constants, and shared status lists.

Expected contents:

- `CatalogItemRow`
- `AttributeRow`
- `AttributeValidationRow`
- `AttributeOptionValidationRow`
- `ValueRow`
- `ProductImageStorageRow`
- `ListProductsOptions`
- `CATALOG_ITEM_SELECT`
- `PRODUCT_STATUSES`

### `catalog-mappers.ts`

Owns pure conversion helpers between database rows and DTO/domain values.

Expected contents:

- `mapCategoryFromDb`
- `mapCategoryToDb`
- `mapDriveTypeFromDb`
- `mapDriveTypeToDb`
- `rowToProduct`
- discount patch helper if it stays pure enough to avoid circular imports

### `catalog-images.ts`

Owns image normalization, public URL parsing, product image replacement, and unused Supabase Storage cleanup.

Expected contents:

- `extractImageUrls`
- `storagePublicUrl`
- `storageObjectFromPublicUrl`
- `storageObjectFromImageRow`
- `uniqueStorageObjects`
- `imageInsertRow`
- `normalizeProductImages`
- `syncProductImages`
- `removeUnusedStorageObjects`

### `catalog-attributes.ts`

Owns catalog item dynamic attribute value loading and saving.

Expected contents:

- `fetchAttributeValueMap`
- `syncAttributeValues`
- attribute option validation logic for single-select fields

### `catalog-reservation-sync.ts`

Owns synchronization between active reservations and `catalog_items.status`.

Expected contents:

- `syncCatalogReservationStatuses`

This module should stay independent from the reservations service to avoid catalog/reservation circular imports.

### `catalog-queries.ts`

Owns read-only catalog access.

Expected contents:

- `fetchCatalogItems`
- `countCatalogItems`
- `fetchOneCatalogItem`
- `listProducts`
- `countProductsByStatus`
- `listPublicActiveProducts`
- `getProductById`
- `listAttributes`

### `catalog-commands.ts`

Owns create/update style write operations that edit core product fields, images, and attributes.

Expected contents:

- `createProduct`
- `updateProduct`
- `updatePrice`
- `updateStockCount`

### `catalog-lifecycle.ts`

Owns state/lifecycle operations that create sales, archive products, permanently clear archived products through RPC, and restore archived products.

Expected contents:

- `markAsSold`
- `archiveProduct`
- `clearArchivedProduct`
- `restoreProduct`

## Compatibility Facade

`src/app/api/catalog/catalog-service.ts` should remain the only import path used by existing route files during this pass.

The final facade should only re-export the public API:

```ts
export {
  countProductsByStatus,
  getProductById,
  listAttributes,
  listProducts,
  listPublicActiveProducts,
} from "@/app/api/catalog/services/catalog-queries";

export {
  createProduct,
  updatePrice,
  updateProduct,
  updateStockCount,
} from "@/app/api/catalog/services/catalog-commands";

export {
  archiveProduct,
  clearArchivedProduct,
  markAsSold,
  restoreProduct,
} from "@/app/api/catalog/services/catalog-lifecycle";
```

The exact export ordering can differ, but the exported names must remain identical.

## Refactor Approach

Use a low-risk staged extraction.

1. Extract pure/internal types and mappers first.
2. Extract image helpers next because they have a clear responsibility and can be verified independently through build/tests.
3. Extract attribute value helpers.
4. Extract reservation sync.
5. Extract query functions.
6. Extract create/update commands.
7. Extract lifecycle commands.
8. Reduce `catalog-service.ts` to the compatibility facade.
9. Add or tighten a structure guard so this file does not grow back into a 1,000-line service.

Each stage should compile before moving to the next stage.

## Behavioral Requirements

The refactor must preserve current behavior:

1. Public shoppers can only see active catalog items.
2. Staff/admin catalog reads can request active, reserved, sold, archived, or all non-archived items.
3. Staff/admin catalog reads can trigger reservation-status synchronization when the caller requests it.
4. Product creation still creates the correct `catalog_items` row and the correct `bicycles` or `parts` extension row.
5. Product update still validates required text, price, stock count, discount input, drive type, images, and dynamic field values.
6. Critical price and stock commands still delegate through the same validation path as normal updates.
7. Mark-as-sold still inserts a `sales` row, sets item status to `sold`, and sets `stock_count` to `0`.
8. Archive still cancels active reservations before setting status to `archived`.
9. Clear still calls `clear_archived_catalog_item` and cleans unused storage objects.
10. Restore still returns archived products to `active` when stock is positive and `sold` when stock is zero.
11. Existing `AdapterError`, `NotFoundError`, and `ValidationError` messages should stay unchanged unless a message is clearly incorrect.
12. Existing DTO shapes and route JSON responses must not change.

## Non-Goals

Do not include these in this refactor:

1. Do not change database schema.
2. Do not change Supabase table names, column names, RPC names, or storage bucket behavior.
3. Do not change route URLs or HTTP methods.
4. Do not change authorization rules.
5. Do not rewrite bulk action behavior.
6. Do not move catalog code into the feature repository adapter layer yet.
7. Do not introduce new feature flags.
8. Do not change UI components.
9. Do not rename DTO fields.
10. Do not optimize query performance unless required to preserve behavior after the split.

## Acceptance Criteria

1. `src/app/api/catalog/catalog-service.ts` is reduced to a small compatibility facade, target under 80 lines.
2. No new service module under `src/app/api/catalog/services/` exceeds 420 lines.
3. Existing callers continue importing from `@/app/api/catalog/catalog-service`.
4. `rg "catalog-service" src/app/api src/features src/lib` shows no required caller import churn beyond optional formatting.
5. `npm run build` passes.
6. `node docs/tests/verify-max-file-lines.mjs` passes after adding the new folder/file guard.
7. `node docs/tests/verify-structure-boundaries.mjs` passes.
8. `node docs/tests/verify-repository-structure.mjs` passes.
9. `node docs/tests/verify-backend-service-boundaries.mjs` passes.
10. No production behavior changes are intentionally introduced.

## Verification Plan

Run automated checks:

```powershell
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
npm run build
```

Run targeted code checks:

```powershell
rg "catalog-service" src\app\api src\features src\lib
rg "from \"@/app/api/catalog/services" src\app\api\catalog
```

Manual smoke checks after implementation:

1. Open admin inventory and load all statuses.
2. Create a product with multiple images and dynamic field values.
3. Edit price and stock from the admin inventory page.
4. Apply and remove a discount.
5. Reserve an active product.
6. Mark a product sold.
7. Delete/archive a product.
8. Restore a deleted product.
9. Clear a deleted product.
10. Open public shop and confirm only active products are visible.

## Risks And Controls

### Risk: Circular Imports

`reservation-service.ts` imports `getProductById` from catalog. The catalog reservation-status sync must not import reservation-service back.

Control: keep reservation-status sync using direct Supabase queries inside `catalog-reservation-sync.ts`.

### Risk: Storage Cleanup Regression

Image storage cleanup is sensitive because deleting an object still used by another product would be data loss.

Control: preserve the current `removeUnusedStorageObjects` behavior exactly and keep shared storage-object helpers in one image module.

### Risk: Error Message Drift

Route error handling depends on domain errors being converted consistently.

Control: move errors with their original messages; do not generalize messages during extraction.

### Risk: Hidden Behavior Change In DTO Mapping

`rowToProduct` combines category mapping, bicycle drive type, image fallback, discount source, stock/inStock, and dynamic values.

Control: extract `rowToProduct` as one unit before modifying any query or command orchestration.

## Follow-Up Candidates

After this refactor is complete and stable:

1. Add contract tests for catalog mock vs Supabase adapters.
2. Move catalog service modules toward the Step 5 repository/data-access architecture.
3. Split `field-service.ts` next; it is the next backend service over the desired line threshold.
4. Consider focused integration tests for image replacement and archive/restore flows.