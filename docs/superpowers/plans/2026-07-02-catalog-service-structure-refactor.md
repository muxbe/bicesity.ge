# Catalog Service Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/app/api/catalog/catalog-service.ts` into focused backend service modules while preserving the existing `@/app/api/catalog/catalog-service` public API and runtime behavior.

**Architecture:** Keep `catalog-service.ts` as a compatibility facade and move internals into `src/app/api/catalog/services/`. Split by responsibility: types/constants, image storage helpers, row/DTO mappers, attribute persistence, reservation status sync, read queries, product commands, and lifecycle commands. Existing route files keep importing from `catalog-service.ts`; no route URL, auth, DTO, database, or behavior changes are part of this work.

**Tech Stack:** Next.js App Router API routes, TypeScript, Supabase Admin client, repository guard scripts under `docs/tests`, existing catalog DTO/domain helpers.

---

## Source Spec

Implement this plan against:

- `docs/specs/2026-07-02-catalog-service-structure-refactor.md`

Current source file:

- `src/app/api/catalog/catalog-service.ts`

Current public callers that must remain compatible:

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

Public exports that must still come from `@/app/api/catalog/catalog-service` after all tasks:

```ts
export {
  countProductsByStatus,
  createProduct,
  getProductById,
  listAttributes,
  listProducts,
  listPublicActiveProducts,
  updatePrice,
  updateProduct,
  updateStockCount,
  markAsSold,
  archiveProduct,
  clearArchivedProduct,
  restoreProduct,
};
```

## Target File Map

Create these files:

- `src/app/api/catalog/services/catalog-types.ts`: internal Supabase row types, options, shared select string, status list.
- `src/app/api/catalog/services/catalog-images.ts`: image URL parsing, image normalization, image row building, product image replacement, unused storage cleanup.
- `src/app/api/catalog/services/catalog-mappers.ts`: category and drive-type conversion, discount patch conversion, `CatalogItemRow` to `ProductDTO` mapping.
- `src/app/api/catalog/services/catalog-attributes.ts`: dynamic attribute value fetch/save, single-select option validation.
- `src/app/api/catalog/services/catalog-reservation-sync.ts`: active reservation to catalog status synchronization.
- `src/app/api/catalog/services/catalog-queries.ts`: read-only product list/count/detail/public projections and `listAttributes`.
- `src/app/api/catalog/services/catalog-commands.ts`: create/update/critical product write commands.
- `src/app/api/catalog/services/catalog-lifecycle.ts`: sold/archive/clear/restore lifecycle commands.

Modify these files:

- `src/app/api/catalog/catalog-service.ts`: reduce to public compatibility facade.
- `docs/tests/verify-max-file-lines.mjs`: replace the legacy 1050-line catalog-service allowance with a small facade limit and add a services folder limit.
- `docs/tests/verify-backend-service-boundaries.mjs`: add a guard that route-level catalog files do not bypass the facade by importing `@/app/api/catalog/services/*` directly.

Do not modify route callers unless TypeScript formatting forces an import sort. The expected route-facing import path remains `@/app/api/catalog/catalog-service`.

---

### Task 1: Extract Catalog Types And Constants

**Files:**

- Create: `src/app/api/catalog/services/catalog-types.ts`
- Modify: `src/app/api/catalog/catalog-service.ts`

- [ ] **Step 1: Create the services folder**

Run:

```powershell
New-Item -ItemType Directory -Force 'src\app\api\catalog\services'
```

Expected: the command creates the folder or reports that it already exists.

- [ ] **Step 2: Create `catalog-types.ts` with exported internal types and constants**

Create `src/app/api/catalog/services/catalog-types.ts` with this content:

```ts
import type {
  ProductStatus,
  ProductStatusFilter,
} from "@/features/catalog/dto/catalog-dto";

export type CatalogItemRow = {
  id: string;
  name: string;
  item_type: "bicycle" | "part";
  serial_number: string;
  price_cents: number;
  stock_count: number;
  status: "active" | "reserved" | "sold" | "archived";
  description: string;
  rating: number | null;
  discount_type: "amount" | "percent" | null;
  discount_amount_cents: number | null;
  discount_percent_bps: number | null;
  discount_reason: string | null;
  bicycles: { drive_type: string } | { drive_type: string }[] | null;
  product_images:
    | {
        bucket_name: string | null;
        object_path: string | null;
        external_url: string | null;
        is_primary: boolean;
        sort_order: number;
      }[]
    | null;
};

export type AttributeRow = {
  id: string;
  display_name: string;
  category: "bicycle" | "part";
  is_public: boolean;
  sort_order: number;
  field_key: string;
  data_type: "text" | "number" | "boolean" | "date" | "image" | "url";
};

export type AttributeValidationRow = {
  id: string;
  display_name: string;
  input_mode: "free_text" | "single_select" | null;
};

export type AttributeOptionValidationRow = {
  attribute_id: string;
  value: string;
};

export type ValueRow = {
  catalog_item_id: string;
  attribute_id: string;
  value_text: string | null;
};

export type ProductImageStorageRow = {
  bucket_name: string | null;
  object_path: string | null;
  external_url: string | null;
};

export type ListProductsOptions = {
  syncReservations?: boolean;
};

export const CATALOG_ITEM_SELECT =
  "id,name,item_type,serial_number,price_cents,stock_count,status,description,rating,discount_type,discount_amount_cents,discount_percent_bps,discount_reason,bicycles(drive_type),product_images(bucket_name,object_path,external_url,is_primary,sort_order)";

export const PRODUCT_STATUSES: ProductStatus[] = [
  "active",
  "reserved",
  "sold",
  "archived",
];

export type CatalogStatusFilter = ProductStatusFilter;
```

- [ ] **Step 3: Import the extracted types/constants into `catalog-service.ts`**

Add these imports near the existing imports in `src/app/api/catalog/catalog-service.ts`:

```ts
import type {
  AttributeOptionValidationRow,
  AttributeValidationRow,
  CatalogItemRow,
  ListProductsOptions,
  ProductImageStorageRow,
  ValueRow,
} from "@/app/api/catalog/services/catalog-types";
import {
  CATALOG_ITEM_SELECT,
  PRODUCT_STATUSES,
} from "@/app/api/catalog/services/catalog-types";
```

Remove these local declarations from `catalog-service.ts`:

```txt
CatalogItemRow
AttributeRow
AttributeValidationRow
AttributeOptionValidationRow
ValueRow
ProductImageStorageRow
ListProductsOptions
CATALOG_ITEM_SELECT
PRODUCT_STATUSES
```

`AttributeRow` is not used by the current service body. Do not import it unless TypeScript reports a real use.

- [ ] **Step 4: Run verification for Task 1**

Run:

```powershell
npm run build
```

Expected: `Compiled successfully` and exit code `0`.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add src\app\api\catalog\catalog-service.ts src\app\api\catalog\services\catalog-types.ts
git commit -m "Extract catalog service types"
```

---

### Task 2: Extract Catalog Image Helpers

**Files:**

- Create: `src/app/api/catalog/services/catalog-images.ts`
- Modify: `src/app/api/catalog/catalog-service.ts`

- [ ] **Step 1: Create `catalog-images.ts`**

Move the existing image-related functions from `catalog-service.ts` into `src/app/api/catalog/services/catalog-images.ts` and export them. The file must contain these imports and exports:

```ts
import type {
  CatalogItemRow,
  ProductImageStorageRow,
} from "@/app/api/catalog/services/catalog-types";
import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";
import {
  normalizeProductImages as normalizeCatalogProductImages,
} from "@/features/catalog/repositories/catalog-helpers";
import { AdapterError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export function extractImageUrls(images: CatalogItemRow["product_images"]): string[] {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function pickPrimaryImage(
  images: CatalogItemRow["product_images"],
  category: ProductCategory
): string {
  return normalizeCatalogProductImages(extractImageUrls(images), category)[0];
}

export function storagePublicUrl(
  bucket: string | null | undefined,
  objectPath: string | null | undefined
): string {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function storageObjectFromPublicUrl(
  url: string
): { bucket: string; path: string } | null {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function storageObjectFromImageRow(
  image: ProductImageStorageRow
): { bucket: string; path: string } | null {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function storageObjectKey(object: { bucket: string; path: string }) {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function uniqueStorageObjects(rows: ProductImageStorageRow[]) {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function imageInsertRow(productId: string, image: string, index: number) {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function normalizeProductImages(
  images: string[] | undefined,
  fallbackImage?: string
): string[] {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function removeUnusedStorageObjects(
  candidateRows: ProductImageStorageRow[],
  readErrorMessage: string,
  removeErrorMessage: string
) {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function syncProductImages(productId: string, images: string[]) {
  // Paste the current body from catalog-service.ts, then delete this comment.
}
```

After moving the bodies, the final file must not contain `Paste the current body` comments.

- [ ] **Step 2: Update `catalog-service.ts` imports**

Add:

```ts
import {
  normalizeProductImages,
  removeUnusedStorageObjects,
  syncProductImages,
} from "@/app/api/catalog/services/catalog-images";
```

Remove local image helper declarations that were moved:

```txt
extractImageUrls
storagePublicUrl
storageObjectFromPublicUrl
storageObjectFromImageRow
storageObjectKey
uniqueStorageObjects
imageInsertRow
normalizeProductImages
removeUnusedStorageObjects
syncProductImages
```

If `rowToProduct` still calls `pickPrimaryImage` locally during this task, keep `pickPrimaryImage` local until Task 3. Prefer moving `pickPrimaryImage` now and importing it from `catalog-images.ts` during Task 3.

- [ ] **Step 3: Run verification for Task 2**

Run:

```powershell
npm run build
```

Expected: `Compiled successfully` and exit code `0`.

- [ ] **Step 4: Commit Task 2**

Run:

```powershell
git add src\app\api\catalog\catalog-service.ts src\app\api\catalog\services\catalog-images.ts
git commit -m "Extract catalog image helpers"
```

---

### Task 3: Extract Catalog Mappers And Discount Patch Helpers

**Files:**

- Create: `src/app/api/catalog/services/catalog-mappers.ts`
- Modify: `src/app/api/catalog/catalog-service.ts`

- [ ] **Step 1: Create `catalog-mappers.ts`**

Create `src/app/api/catalog/services/catalog-mappers.ts` with exported pure helpers. Move the existing bodies unchanged from `catalog-service.ts`.

```ts
import type {
  ProductCategory,
  ProductDTO,
  ProductDriveType,
} from "@/features/catalog/dto/catalog-dto";
import type { CatalogItemRow } from "@/app/api/catalog/services/catalog-types";
import { pickPrimaryImage, extractImageUrls } from "@/app/api/catalog/services/catalog-images";
import {
  buildDiscountFromSource,
  parseDiscountInput,
} from "@/features/catalog/domain/catalog-discount";
import {
  normalizeProductImages as normalizeCatalogProductImages,
} from "@/features/catalog/repositories/catalog-helpers";
import { ValidationError } from "@/features/shared/domain/errors";

export function mapCategoryFromDb(dbCategory: "bicycle" | "part"): ProductCategory {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function mapCategoryToDb(category: ProductCategory): "bicycle" | "part" {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function mapDriveTypeFromDb(value: string | undefined): ProductDriveType | undefined {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function mapDriveTypeToDb(value: ProductDriveType | undefined): string | null {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

function parseDiscountOrThrow(input: string | undefined, price: number) {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function discountPatchFromInput(
  input: string | undefined,
  price: number,
  reason: string | null | undefined
): Record<string, unknown> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export function rowToProduct(
  row: CatalogItemRow,
  valuesByItemId: Map<string, Record<string, string>>
): ProductDTO {
  // Paste the current body from catalog-service.ts, then delete this comment.
}
```

After moving bodies, this file must not contain `Paste the current body` comments.

- [ ] **Step 2: Update `catalog-service.ts` imports**

Add:

```ts
import {
  discountPatchFromInput,
  mapCategoryToDb,
  mapDriveTypeToDb,
  rowToProduct,
} from "@/app/api/catalog/services/catalog-mappers";
```

Remove local declarations for:

```txt
mapCategoryFromDb
mapCategoryToDb
mapDriveTypeFromDb
mapDriveTypeToDb
pickPrimaryImage
parseDiscountOrThrow
discountPatchFromInput
rowToProduct
```

Remove imports from `catalog-service.ts` that are only needed by the moved mapper functions:

```ts
import {
  buildDiscountFromSource,
  parseDiscountInput,
} from "@/features/catalog/domain/catalog-discount";
import {
  getFallbackImage,
  normalizeProductImages as normalizeCatalogProductImages,
} from "@/features/catalog/repositories/catalog-helpers";
```

- [ ] **Step 3: Run verification for Task 3**

Run:

```powershell
npm run build
```

Expected: `Compiled successfully` and exit code `0`.

- [ ] **Step 4: Commit Task 3**

Run:

```powershell
git add src\app\api\catalog\catalog-service.ts src\app\api\catalog\services\catalog-mappers.ts
git commit -m "Extract catalog DTO mappers"
```

---

### Task 4: Extract Catalog Attribute Value Helpers

**Files:**

- Create: `src/app/api/catalog/services/catalog-attributes.ts`
- Modify: `src/app/api/catalog/catalog-service.ts`

- [ ] **Step 1: Create `catalog-attributes.ts`**

Create `src/app/api/catalog/services/catalog-attributes.ts` and move the existing attribute helper bodies unchanged:

```ts
import type {
  AttributeOptionValidationRow,
  AttributeValidationRow,
  ValueRow,
} from "@/app/api/catalog/services/catalog-types";
import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";
import { mapCategoryToDb } from "@/app/api/catalog/services/catalog-mappers";
import { AdapterError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function fetchAttributeValueMap(): Promise<Map<string, Record<string, string>>> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function syncAttributeValues(
  productId: string,
  category: ProductCategory,
  values: Record<string, string> | undefined
) {
  // Paste the current body from catalog-service.ts, then delete this comment.
}
```

After moving bodies, this file must not contain `Paste the current body` comments.

- [ ] **Step 2: Update `catalog-service.ts` imports**

Add:

```ts
import {
  fetchAttributeValueMap,
  syncAttributeValues,
} from "@/app/api/catalog/services/catalog-attributes";
```

Remove local declarations for:

```txt
fetchAttributeValueMap
syncAttributeValues
```

Remove type imports that are now only used by `catalog-attributes.ts`:

```txt
AttributeOptionValidationRow
AttributeValidationRow
ValueRow
```

- [ ] **Step 3: Run verification for Task 4**

Run:

```powershell
npm run build
```

Expected: `Compiled successfully` and exit code `0`.

- [ ] **Step 4: Commit Task 4**

Run:

```powershell
git add src\app\api\catalog\catalog-service.ts src\app\api\catalog\services\catalog-attributes.ts
git commit -m "Extract catalog attribute helpers"
```

---

### Task 5: Extract Reservation Sync And Read Queries

**Files:**

- Create: `src/app/api/catalog/services/catalog-reservation-sync.ts`
- Create: `src/app/api/catalog/services/catalog-queries.ts`
- Modify: `src/app/api/catalog/catalog-service.ts`

- [ ] **Step 1: Create `catalog-reservation-sync.ts`**

Move `syncCatalogReservationStatuses` unchanged from `catalog-service.ts`:

```ts
import { AdapterError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function syncCatalogReservationStatuses(): Promise<void> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}
```

This file must not import `@/app/api/reservations/reservation-service`.

- [ ] **Step 2: Create `catalog-queries.ts`**

Move the read/query functions from `catalog-service.ts` into `src/app/api/catalog/services/catalog-queries.ts`:

```ts
import type {
  AttributeDTO,
  CatalogStatusCounts,
  ProductDTO,
  ProductStatus,
  ProductStatusFilter,
} from "@/features/catalog/dto/catalog-dto";
import type {
  CatalogItemRow,
  ListProductsOptions,
} from "@/app/api/catalog/services/catalog-types";
import {
  CATALOG_ITEM_SELECT,
  PRODUCT_STATUSES,
} from "@/app/api/catalog/services/catalog-types";
import { listFields } from "@/app/api/fields/field-service";
import { fetchAttributeValueMap } from "@/app/api/catalog/services/catalog-attributes";
import { rowToProduct } from "@/app/api/catalog/services/catalog-mappers";
import { syncCatalogReservationStatuses } from "@/app/api/catalog/services/catalog-reservation-sync";
import { AdapterError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function fetchCatalogItems(
  status: ProductStatusFilter = "all"
): Promise<CatalogItemRow[]> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function countCatalogItems(status: ProductStatus): Promise<number> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function fetchOneCatalogItem(productId: string): Promise<CatalogItemRow | null> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function listProducts(
  status: ProductStatusFilter = "all",
  options: ListProductsOptions = {}
): Promise<ProductDTO[]> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function countProductsByStatus(
  options: ListProductsOptions = {}
): Promise<CatalogStatusCounts> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function listPublicActiveProducts(
  publicAttributes: AttributeDTO[]
): Promise<ProductDTO[]> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function getProductById(productId: string): Promise<ProductDTO | null> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function listAttributes(): Promise<AttributeDTO[]> {
  return listFields("all");
}
```

After moving bodies, this file must not contain `Paste the current body` comments.

- [ ] **Step 3: Update `catalog-service.ts` after query extraction**

Add imports needed by the still-local write/lifecycle functions:

```ts
import { getProductById } from "@/app/api/catalog/services/catalog-queries";
```

Add public re-exports near the bottom or top of `catalog-service.ts`:

```ts
export {
  countProductsByStatus,
  getProductById,
  listAttributes,
  listProducts,
  listPublicActiveProducts,
} from "@/app/api/catalog/services/catalog-queries";
```

Remove local declarations for:

```txt
fetchCatalogItems
countCatalogItems
syncCatalogReservationStatuses
fetchOneCatalogItem
listProducts
countProductsByStatus
listPublicActiveProducts
getProductById
listAttributes
```

Do not change route files.

- [ ] **Step 4: Check for accidental catalog/reservation circular import**

Run:

```powershell
rg "reservation-service" src\app\api\catalog\services
```

Expected: no output.

- [ ] **Step 5: Run verification for Task 5**

Run:

```powershell
npm run build
```

Expected: `Compiled successfully` and exit code `0`.

- [ ] **Step 6: Commit Task 5**

Run:

```powershell
git add src\app\api\catalog\catalog-service.ts src\app\api\catalog\services\catalog-reservation-sync.ts src\app\api\catalog\services\catalog-queries.ts
git commit -m "Extract catalog read services"
```

---

### Task 6: Extract Product Create/Update Commands

**Files:**

- Create: `src/app/api/catalog/services/catalog-commands.ts`
- Modify: `src/app/api/catalog/catalog-service.ts`

- [ ] **Step 1: Create `catalog-commands.ts`**

Move create/update command functions from `catalog-service.ts` into `src/app/api/catalog/services/catalog-commands.ts`:

```ts
import type {
  CreateProductDTO,
  ProductDTO,
  UpdateProductDTO,
} from "@/features/catalog/dto/catalog-dto";
import {
  assertRequiredText,
  assertValidPrice,
  assertValidStockCount,
} from "@/features/catalog/domain/catalog-validation";
import { syncAttributeValues } from "@/app/api/catalog/services/catalog-attributes";
import {
  normalizeProductImages,
  syncProductImages,
} from "@/app/api/catalog/services/catalog-images";
import {
  discountPatchFromInput,
  mapCategoryToDb,
  mapDriveTypeToDb,
} from "@/app/api/catalog/services/catalog-mappers";
import { getProductById } from "@/app/api/catalog/services/catalog-queries";
import { AdapterError, NotFoundError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function createProduct(input: CreateProductDTO): Promise<ProductDTO> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function updateProduct(
  productId: string,
  input: UpdateProductDTO
): Promise<ProductDTO> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function updatePrice(productId: string, price: number): Promise<ProductDTO> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function updateStockCount(
  productId: string,
  stockCount: number
): Promise<ProductDTO> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}
```

After moving bodies, this file must not contain `Paste the current body` comments.

- [ ] **Step 2: Update `catalog-service.ts` after command extraction**

Add public re-exports:

```ts
export {
  createProduct,
  updatePrice,
  updateProduct,
  updateStockCount,
} from "@/app/api/catalog/services/catalog-commands";
```

Remove local declarations for:

```txt
createProduct
updateProduct
updatePrice
updateStockCount
```

Keep `getProductById`, `removeUnusedStorageObjects`, and `ProductImageStorageRow` available in `catalog-service.ts` only if lifecycle functions still use them before Task 7.

- [ ] **Step 3: Run verification for Task 6**

Run:

```powershell
npm run build
```

Expected: `Compiled successfully` and exit code `0`.

- [ ] **Step 4: Commit Task 6**

Run:

```powershell
git add src\app\api\catalog\catalog-service.ts src\app\api\catalog\services\catalog-commands.ts
git commit -m "Extract catalog write commands"
```

---

### Task 7: Extract Lifecycle Commands And Reduce Facade

**Files:**

- Create: `src/app/api/catalog/services/catalog-lifecycle.ts`
- Modify: `src/app/api/catalog/catalog-service.ts`

- [ ] **Step 1: Create `catalog-lifecycle.ts`**

Move lifecycle/status functions from `catalog-service.ts` into `src/app/api/catalog/services/catalog-lifecycle.ts`:

```ts
import type {
  MarkSoldDTO,
  ProductDTO,
} from "@/features/catalog/dto/catalog-dto";
import type { ProductImageStorageRow } from "@/app/api/catalog/services/catalog-types";
import {
  removeUnusedStorageObjects,
} from "@/app/api/catalog/services/catalog-images";
import { getProductById } from "@/app/api/catalog/services/catalog-queries";
import { AdapterError, NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function markAsSold(
  productId: string,
  input: MarkSoldDTO
): Promise<ProductDTO> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function archiveProduct(productId: string): Promise<void> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function clearArchivedProduct(productId: string): Promise<void> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}

export async function restoreProduct(productId: string): Promise<ProductDTO> {
  // Paste the current body from catalog-service.ts, then delete this comment.
}
```

After moving bodies, this file must not contain `Paste the current body` comments.

- [ ] **Step 2: Replace `catalog-service.ts` with the compatibility facade**

Replace the full contents of `src/app/api/catalog/catalog-service.ts` with:

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

- [ ] **Step 3: Verify route callers still use the facade**

Run:

```powershell
rg "@/app/api/catalog/services" src\app\api src\features src\lib
```

Expected: output only from service implementation files. Route files and `reservation-service.ts` must not import services directly.

- [ ] **Step 4: Run verification for Task 7**

Run:

```powershell
npm run build
```

Expected: `Compiled successfully` and exit code `0`.

- [ ] **Step 5: Commit Task 7**

Run:

```powershell
git add src\app\api\catalog\catalog-service.ts src\app\api\catalog\services\catalog-lifecycle.ts
git commit -m "Extract catalog lifecycle service"
```

---

### Task 8: Tighten Catalog Structure Guards

**Files:**

- Modify: `docs/tests/verify-max-file-lines.mjs`
- Modify: `docs/tests/verify-backend-service-boundaries.mjs`

- [ ] **Step 1: Update the max-file-line guard**

In `docs/tests/verify-max-file-lines.mjs`, replace the legacy catalog tracked file entry:

```ts
{ path: "src/app/api/catalog/catalog-service.ts", max: 1050, reason: "legacy file before backend service split" },
```

with:

```ts
{ path: "src/app/api/catalog/catalog-service.ts", max: 80, reason: "compatibility facade after catalog service split" },
```

Then add this entry to `futureFolderLimits`:

```ts
{ dir: "src/app/api/catalog/services", max: 420 },
```

- [ ] **Step 2: Update backend service boundary guard**

In `docs/tests/verify-backend-service-boundaries.mjs`, add this block before `failIfAny(...)`:

```js
for (const file of listFiles("src/app/api/catalog", [".ts", ".tsx"])) {
  if (file.includes("/services/") || file === "src/app/api/catalog/catalog-service.ts") {
    continue;
  }

  const text = readText(file);
  if (/from\s+["']@\/app\/api\/catalog\/services\//.test(text)) {
    failures.push(`${file}: catalog routes must import through catalog-service facade`);
  }
}
```

This preserves the public route-facing API and prevents route files from coupling directly to internal service modules.

- [ ] **Step 3: Run the line and boundary guards**

Run:

```powershell
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-backend-service-boundaries.mjs
```

Expected:

```txt
Max file line checks passed.
Backend service boundary checks passed.
```

- [ ] **Step 4: Confirm final file sizes**

Run:

```powershell
(Get-Content 'src\app\api\catalog\catalog-service.ts').Count
Get-ChildItem 'src\app\api\catalog\services' -File | ForEach-Object { $lines = (Get-Content $_.FullName).Count; [PSCustomObject]@{ Lines = $lines; File = $_.FullName.Substring((Get-Location).Path.Length + 1) } } | Sort-Object Lines -Descending | Format-Table -AutoSize
```

Expected:

- `catalog-service.ts` line count is `80` or lower.
- Every file under `src/app/api/catalog/services` is `420` lines or lower.

- [ ] **Step 5: Commit Task 8**

Run:

```powershell
git add docs\tests\verify-max-file-lines.mjs docs\tests\verify-backend-service-boundaries.mjs
git commit -m "Guard catalog service split boundaries"
```

---

### Task 9: Final Verification And Review

**Files:**

- Read-only verification across the repository.

- [ ] **Step 1: Run all automated verification commands**

Run:

```powershell
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
npm run build
```

Expected:

```txt
Max file line checks passed.
Structure boundary checks passed.
Repository structure checks passed.
Backend service boundary checks passed.
```

`npm run build` must show `Compiled successfully` and exit code `0`.

- [ ] **Step 2: Confirm public API imports stayed stable**

Run:

```powershell
rg "catalog-service" src\app\api src\features src\lib
rg "@/app/api/catalog/services" src\app\api src\features src\lib
```

Expected:

- First command still shows existing route/service callers importing `@/app/api/catalog/catalog-service`.
- Second command shows internal service-to-service imports only, with no route files importing internal services directly.

- [ ] **Step 3: Confirm no unresolved move markers remain**

Run:

```powershell
rg "Paste the current body" src\app\api\catalog docs\tests
```

Expected: no output.

- [ ] **Step 4: Review the final diff**

Run:

```powershell
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected:

- Diff shows only catalog service/module split and guard updates.
- `git diff --check` has no output and exit code `0`.

- [ ] **Step 5: Request final code review**

Use a fresh code-review subagent or manual review to check:

```txt
1. Public API from catalog-service.ts is preserved.
2. No route imports internal services directly.
3. No catalog/reservation circular import was introduced.
4. Error messages and validation paths were moved without behavior changes.
5. Image cleanup still checks remaining storage usage before removal.
6. File-size guards match acceptance criteria.
```

- [ ] **Step 6: Final commit only if review required fixes**

If review finds fixes, commit them with:

```powershell
git add <changed-files>
git commit -m "Fix catalog service split review findings"
```

If review finds no fixes, do not create an empty commit.

## Manual Smoke Checklist After Implementation

Run these manually on localhost after automated checks pass:

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

## Rollback Plan

If the split introduces unexpected behavior:

1. Revert the last task commit that introduced the behavior.
2. Run `npm run build`.
3. Run `node docs\tests\verify-max-file-lines.mjs`.
4. Keep earlier successful extraction commits if they still pass verification.
5. If the issue source is unclear, revert the entire branch before merging to `main`.

## Self-Review

- Spec coverage: The plan preserves the public facade, creates all target modules, keeps route callers stable, adds guards, and verifies build plus structure checks.
- Scope check: The plan is limited to catalog backend service structure and does not change schema, routes, authorization, DTO names, UI, feature flags, or data-access architecture.
- Type consistency: All planned module names and exported function names match the spec and current public API.
- Risk controls: Reservation circular import, storage cleanup behavior, error message drift, and DTO mapping drift each have explicit task or review gates.
