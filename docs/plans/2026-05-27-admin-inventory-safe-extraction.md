# Admin Inventory Safe Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the safest admin inventory structure pieces into focused files while keeping the UI and behavior exactly the same.

**Architecture:** This is the first slice of the admin inventory refactor. It moves shared types, constants, pure utility functions, and three tiny presentational components into `src/features/admin/inventory/`, while leaving `AdminInventoryView` and `ProductForm` behavior in the existing coordinator file.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node `.mjs` verification scripts.

---

## Scope

This plan implements option A only:

- Move admin inventory types into `src/features/admin/inventory/types.ts`.
- Move static constants into `src/features/admin/inventory/constants.ts`.
- Move pure helper functions into `src/features/admin/inventory/utils/`.
- Move `StatusBadge`, `ProductImage`, and `ReservationCustomerSummary` into `src/features/admin/inventory/components/`.
- Keep current route imports working through `src/features/admin/admin-inventory-view.tsx`.
- Keep all visible UI, labels, spacing, classes, API calls, and behavior unchanged.

This plan does not extract filters, product cards, modals, hooks, routes, API code, or backend services.

## Files

- Modify: `src/features/admin/admin-inventory-view.tsx`
- Create: `src/features/admin/inventory/types.ts`
- Create: `src/features/admin/inventory/constants.ts`
- Create: `src/features/admin/inventory/utils/money.ts`
- Create: `src/features/admin/inventory/utils/date.ts`
- Create: `src/features/admin/inventory/utils/api-errors.ts`
- Create: `src/features/admin/inventory/utils/inventory-copy.ts`
- Create: `src/features/admin/inventory/utils/product-draft.ts`
- Create: `src/features/admin/inventory/components/status-badge.tsx`
- Create: `src/features/admin/inventory/components/product-image.tsx`
- Create: `src/features/admin/inventory/components/reservation-customer-summary.tsx`
- Verify: `docs/tests/verify-structure-baseline.mjs`
- Verify: `npm run build`

## Task 1: Baseline Verification

**Files:**
- Verify only

- [ ] **Step 1: Run current structure baseline**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
```

Expected: `Structure baseline verification passed.`

- [ ] **Step 2: Confirm current build passes**

Run:

```powershell
npm run build
```

Expected: Next.js reports `Compiled successfully` and finishes page optimization.

## Task 2: Extract Types

**Files:**
- Create: `src/features/admin/inventory/types.ts`
- Modify: `src/features/admin/admin-inventory-view.tsx`

- [ ] **Step 1: Create shared type module**

Create `src/features/admin/inventory/types.ts`:

```ts
import type { ProductCategory, ProductStatus } from '@/features/catalog';
import type { ReservationSource } from '@/features/reservations';

export type CategoryTab = 'All' | 'Bicycle' | 'Parts';
export type SellChannel = 'online' | 'in_store' | 'as_is';
export type StockFilter = 'All' | 'In Stock' | 'Out of Stock';
export type BikeTypeFilter = 'All' | string;
export type InventoryRole = 'admin' | 'seller';
export type BulkMode = 'discount' | 'remove-discount' | 'reserve' | 'cancel-reservation' | 'sell' | 'delete';

export type AdminInventoryPageProps = {
  role?: InventoryRole;
  statusView?: ProductStatus;
  title?: string;
  description?: string;
};

export type BulkActionResult = {
  success: Array<{ id: string; name: string }>;
  skipped: Array<{ id: string; name?: string; reason: string }>;
};

export type ReservationContextDraft = {
  customerName: string;
  customerPhone: string;
  messengerProfileUrl: string;
  reservationSource: ReservationSource;
};

export type ProductFormDraft = {
  name: string;
  category: ProductCategory;
  type: string;
  serial: string;
  price: string;
  discountInput: string;
  stockCount: string;
  description: string;
  image: string;
  images: string[];
  values: Record<string, string>;
};
```

- [ ] **Step 2: Import extracted types in the coordinator**

In `src/features/admin/admin-inventory-view.tsx`, remove the local type definitions for:

- `CategoryTab`
- `SellChannel`
- `StockFilter`
- `BikeTypeFilter`
- `InventoryRole`
- `BulkMode`
- `AdminInventoryPageProps`
- `BulkActionResult`
- `ReservationContextDraft`
- `ProductFormDraft`

Add this type import:

```ts
import type {
  AdminInventoryPageProps,
  BikeTypeFilter,
  BulkActionResult,
  BulkMode,
  CategoryTab,
  ProductFormDraft,
  ReservationContextDraft,
  SellChannel,
  StockFilter,
} from '@/features/admin/inventory/types';
```

- [ ] **Step 3: Remove now-unused type imports**

In `src/features/admin/admin-inventory-view.tsx`, remove these type imports only if TypeScript reports they are unused after Step 2:

```ts
type ProductCategory,
type ProductStatus,
type ReservationSource,
```

Keep any of those imports if the file still uses the type directly.

- [ ] **Step 4: Verify type extraction**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
npm run build
```

Expected: both commands pass.

## Task 3: Extract Constants

**Files:**
- Create: `src/features/admin/inventory/constants.ts`
- Modify: `src/features/admin/admin-inventory-view.tsx`

- [ ] **Step 1: Create constants module**

Create `src/features/admin/inventory/constants.ts`:

```ts
import type { ReservationSource } from '@/features/reservations';
import type { ProductFormDraft, ReservationContextDraft } from './types';

export const EMPTY_DRAFT: ProductFormDraft = {
  name: '',
  category: 'Bicycle',
  type: 'Manual',
  serial: '',
  price: '',
  discountInput: '',
  stockCount: '1',
  description: '',
  image: '',
  images: [],
  values: {},
};

export const RESERVATION_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

export const EMPTY_RESERVATION_CONTEXT: ReservationContextDraft = {
  customerName: '',
  customerPhone: '',
  messengerProfileUrl: '',
  reservationSource: 'manual',
};

export const RESERVATION_SOURCE_OPTIONS: ReservationSource[] = [
  'manual',
  'messenger',
  'phone',
  'walk_in',
  'other',
];
```

- [ ] **Step 2: Import constants in the coordinator**

In `src/features/admin/admin-inventory-view.tsx`, remove the local constant declarations for:

- `EMPTY_DRAFT`
- `RESERVATION_HOLD_MS`
- `EMPTY_RESERVATION_CONTEXT`
- `RESERVATION_SOURCE_OPTIONS`

Add:

```ts
import {
  EMPTY_DRAFT,
  EMPTY_RESERVATION_CONTEXT,
  RESERVATION_HOLD_MS,
  RESERVATION_SOURCE_OPTIONS,
} from '@/features/admin/inventory/constants';
```

- [ ] **Step 3: Verify constant extraction**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
npm run build
```

Expected: both commands pass.

## Task 4: Extract Pure Utilities

**Files:**
- Create: `src/features/admin/inventory/utils/money.ts`
- Create: `src/features/admin/inventory/utils/date.ts`
- Create: `src/features/admin/inventory/utils/api-errors.ts`
- Create: `src/features/admin/inventory/utils/inventory-copy.ts`
- Create: `src/features/admin/inventory/utils/product-draft.ts`
- Modify: `src/features/admin/admin-inventory-view.tsx`

- [ ] **Step 1: Create money utility**

Create `src/features/admin/inventory/utils/money.ts`:

```ts
export function toMoney(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function toStock(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function parseFilterPrice(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}
```

- [ ] **Step 2: Create date utility**

Create `src/features/admin/inventory/utils/date.ts`:

```ts
import { RESERVATION_HOLD_MS } from '../constants';

export function formatDatetimeForInput(rawIso: string): string {
  const date = new Date(rawIso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function reservationExpiryIso(reserveDate: Date): string {
  return new Date(reserveDate.getTime() + RESERVATION_HOLD_MS).toISOString();
}
```

- [ ] **Step 3: Create API error utility**

Create `src/features/admin/inventory/utils/api-errors.ts`:

```ts
export function parseActionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Action failed. Try again.';
}

export function getApiErrorMessage(payload: { error?: string; details?: unknown } | null, fallback: string) {
  const message = payload?.error ?? fallback;
  const details = payload?.details;
  if (
    details &&
    typeof details === 'object' &&
    'message' in details &&
    typeof details.message === 'string'
  ) {
    return `${message} ${details.message}`;
  }
  return message;
}
```

- [ ] **Step 4: Create inventory copy utility**

Create `src/features/admin/inventory/utils/inventory-copy.ts`:

```ts
import type { ProductStatus } from '@/features/catalog';
import type { InventoryRole } from '../types';

export function inventoryTitleKey(role: InventoryRole, statusView: ProductStatus) {
  if (statusView === 'reserved') {
    return 'inventory.titleReserved';
  }
  if (statusView === 'sold') {
    return 'inventory.titleSold';
  }
  if (statusView === 'archived') {
    return 'inventory.titleDeleted';
  }
  return role === 'seller' ? 'inventory.titleSeller' : 'inventory.titleAdmin';
}

export function inventoryDescriptionKey(role: InventoryRole, statusView: ProductStatus) {
  if (statusView === 'reserved') {
    return 'inventory.descReserved';
  }
  if (statusView === 'sold') {
    return 'inventory.descSold';
  }
  if (statusView === 'archived') {
    return 'inventory.descDeleted';
  }
  return role === 'seller' ? 'inventory.descSeller' : 'inventory.descAdmin';
}
```

- [ ] **Step 5: Create product draft utility**

Create `src/features/admin/inventory/utils/product-draft.ts`:

```ts
import { getFallbackImage, type AttributeDTO, type ProductDTO } from '@/features/catalog';
import type { ProductFormDraft } from '../types';

export function imagesFromDraft(draft: ProductFormDraft): string[] {
  return draft.images.length > 0 ? draft.images : draft.image ? [draft.image] : [];
}

export function draftFromProduct(product: ProductDTO): ProductFormDraft {
  const fallbackImage = getFallbackImage(product.category);
  const images = product.images.filter((image) => image !== fallbackImage);

  return {
    name: product.name,
    category: product.category,
    type: product.type ?? 'Manual',
    serial: product.serial,
    price: String(product.price),
    discountInput: product.discountInput,
    stockCount: String(product.stockCount),
    description: product.description,
    image: images[0] ?? '',
    images,
    values: { ...product.values },
  };
}

export function valuesForCategory(
  values: Record<string, string>,
  category: ProductFormDraft['category'],
  attributes: AttributeDTO[]
) {
  const allowedIds = new Set(
    attributes
      .filter((attribute) => attribute.category === category)
      .map((attribute) => attribute.id)
  );
  return Object.fromEntries(
    Object.entries(values)
      .filter(([attributeId]) => allowedIds.has(attributeId))
      .map(([attributeId, value]) => [attributeId, value.trim()])
  );
}
```

- [ ] **Step 6: Import utilities in the coordinator**

In `src/features/admin/admin-inventory-view.tsx`, remove local function declarations for:

- `toMoney`
- `toStock`
- `parseFilterPrice`
- `formatDatetimeForInput`
- `reservationExpiryIso`
- `parseActionError`
- `getApiErrorMessage`
- `inventoryTitleKey`
- `inventoryDescriptionKey`
- `imagesFromDraft`
- `draftFromProduct`
- `valuesForCategory`

Add:

```ts
import { getApiErrorMessage, parseActionError } from '@/features/admin/inventory/utils/api-errors';
import { formatDatetimeForInput, reservationExpiryIso } from '@/features/admin/inventory/utils/date';
import { inventoryDescriptionKey, inventoryTitleKey } from '@/features/admin/inventory/utils/inventory-copy';
import { parseFilterPrice, toMoney, toStock } from '@/features/admin/inventory/utils/money';
import { draftFromProduct, imagesFromDraft, valuesForCategory } from '@/features/admin/inventory/utils/product-draft';
```

- [ ] **Step 7: Remove now-unused imports**

In `src/features/admin/admin-inventory-view.tsx`, remove `getFallbackImage` from the catalog import if only `ProductImage` and `draftFromProduct` used it before extraction.

- [ ] **Step 8: Verify utility extraction**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
npm run build
```

Expected: both commands pass.

## Task 5: Extract Tiny Components

**Files:**
- Create: `src/features/admin/inventory/components/status-badge.tsx`
- Create: `src/features/admin/inventory/components/product-image.tsx`
- Create: `src/features/admin/inventory/components/reservation-customer-summary.tsx`
- Modify: `src/features/admin/admin-inventory-view.tsx`

- [ ] **Step 1: Create status badge component**

Create `src/features/admin/inventory/components/status-badge.tsx`:

```tsx
import type { ProductDTO } from '@/features/catalog';
import { statusLabel, useI18n } from '@/lib/i18n';

export function StatusBadge({ status }: { status: ProductDTO['status'] }) {
  const { t } = useI18n();
  const classes =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'reserved'
        ? 'bg-sky-100 text-sky-700'
        : status === 'sold'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-200 text-slate-700';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}>
      {statusLabel(status, t)}
    </span>
  );
}
```

- [ ] **Step 2: Create product image component**

Create `src/features/admin/inventory/components/product-image.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getFallbackImage, type ProductDTO } from '@/features/catalog';

export function ProductImage({
  src,
  alt,
  category,
  className,
}: {
  src: string;
  alt: string;
  category: ProductDTO['category'];
  className?: string;
}) {
  const fallback = getFallbackImage(category);
  const [imageSrc, setImageSrc] = useState(src || fallback);

  useEffect(() => {
    setImageSrc(src || fallback);
  }, [fallback, src]);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, 160px"
      className={className}
      onError={() => setImageSrc(fallback)}
    />
  );
}
```

- [ ] **Step 3: Create reservation customer summary component**

Create `src/features/admin/inventory/components/reservation-customer-summary.tsx`:

```tsx
import type { ReservationDTO } from '@/features/reservations';
import { reservationSourceLabel, useI18n } from '@/lib/i18n';

export function ReservationCustomerSummary({ reservation }: { reservation: ReservationDTO }) {
  const { t } = useI18n();
  const contextRows = [
    [t('common.customer'), reservation.customerName || t('common.notSet')],
    [t('common.phone'), reservation.customerPhone || t('common.notSet')],
    [t('common.messenger'), reservation.messengerProfileUrl || t('common.notSet')],
    [t('common.source'), reservationSourceLabel(reservation.reservationSource, t)],
  ] satisfies Array<[string, string]>;

  return (
    <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-sky-800">
        {t('inventory.customerDetails')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {contextRows.map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-sky-700">{label}</p>
            {label === t('common.messenger') && value !== t('common.notSet') ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm font-semibold text-cyan-700 hover:underline"
              >
                {value}
              </a>
            ) : (
              <p className="break-words text-sm font-semibold text-slate-800">{value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Import extracted components in the coordinator**

In `src/features/admin/admin-inventory-view.tsx`, remove local component declarations for:

- `StatusBadge`
- `ProductImage`
- `ReservationCustomerSummary`

Add:

```ts
import { ProductImage } from '@/features/admin/inventory/components/product-image';
import { ReservationCustomerSummary } from '@/features/admin/inventory/components/reservation-customer-summary';
import { StatusBadge } from '@/features/admin/inventory/components/status-badge';
```

- [ ] **Step 5: Remove now-unused imports**

In `src/features/admin/admin-inventory-view.tsx`, remove:

```ts
import Image from 'next/image';
```

Remove `useEffect` from the React import if `ProductImage` was the only remaining code using it:

```ts
import { useMemo, useRef, useState } from 'react';
```

Remove `statusLabel` from the i18n import if `StatusBadge` was the only remaining code using it.

- [ ] **Step 6: Verify component extraction**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
npm run build
```

Expected: both commands pass.

## Task 6: Final Review

**Files:**
- Verify only

- [ ] **Step 1: Inspect changed files**

Run:

```powershell
git status --short --untracked-files=all
```

Expected: created files are limited to the new `src/features/admin/inventory/` files and this plan, plus existing untracked docs already present before this implementation.

- [ ] **Step 2: Check file sizes**

Run:

```powershell
node docs\tests\verify-max-file-lines.mjs
```

Expected: `Max file line checks passed.`

- [ ] **Step 3: Run final baseline**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
```

Expected: `Structure baseline verification passed.`

- [ ] **Step 4: Run final build**

Run:

```powershell
npm run build
```

Expected: Next.js reports `Compiled successfully`.

- [ ] **Step 5: Check whitespace**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

## Manual Smoke Check

After automated verification passes, open the admin inventory UI and confirm:

1. Active admin inventory loads.
2. Product cards still show images and status badges.
3. Reserved products still show customer summary details.
4. Create product form opens and shows image previews.
5. Edit product form opens and shows image previews.
6. Reservation form buttons remain visible.
7. Sell, reserve, cancel reservation, and bulk action buttons still appear in the same places as before.

## Approval Checkpoint

This plan is ready for review. Choose the next step:

```text
A. Implement this safe extraction plan now.
B. Adjust the plan first.
C. Stop here.
```
