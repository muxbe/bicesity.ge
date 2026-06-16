# Admin Inventory Controller Hook Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts` into focused hooks under 260 lines each while keeping the deployed inventory behavior unchanged.

**Architecture:** Keep `AdminInventoryView` as a thin composition component and keep `useAdminInventoryController` as the public facade used by the page. Move filter derivation, selection state, modal draft state, and action groups into focused hooks with explicit parameter and return types. Each slice must preserve the existing returned controller contract until the final cleanup.

**Tech Stack:** Next.js App Router, React client hooks, TypeScript, Supabase-backed catalog APIs, Vercel production deployment.

---

## Current State

- `src/features/admin/admin-inventory-view.tsx` is now a thin composition file at about 208 lines.
- `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts` is about 863 lines.
- The controller hook currently owns data loading, permissions, filters, selection, modal draft state, create/edit/reserve/sell/archive/restore/bulk actions, image upload, error state, and the final object returned to the page.
- `docs/tests/verify-max-file-lines.mjs` already enforces a future `260` line max for `src/features/admin/inventory/hooks/*.ts`, so the controller hook will fail that check until this split is complete.

## Hard Constraints

- Do not change visible UI.
- Do not change labels, class names, routes, API payloads, Supabase code, migrations, or database behavior.
- Do not change the props expected by `InventoryFilters`, `InventoryBulkToolbar`, `InventoryProductList`, or `InventoryActionModals` unless the plan is updated first.
- Keep `AdminInventoryView` importing only `useAdminInventoryController` from hooks.
- Keep the public controller return names stable during extraction.
- Run `npm run build` after each implementation slice.
- Run `node docs\tests\verify-max-file-lines.mjs` only after all hook files are below the configured limit.
- Do not deploy until build passes and the user requests deployment.

## Target File Structure

```text
src/features/admin/admin-inventory-view.tsx
  Thin page composition. No new logic.

src/features/admin/inventory/hooks/use-admin-inventory-controller.ts
  Public facade. Loads catalog/reservation data, wires extracted hooks together, returns the existing controller shape.

src/features/admin/inventory/hooks/use-inventory-filters.ts
  Owns filter input state and derived filtered product data.

src/features/admin/inventory/hooks/use-inventory-selection.ts
  Owns selected IDs and visible-selection helpers.

src/features/admin/inventory/hooks/use-inventory-modal-state.ts
  Owns create/edit/reserve/sell/bulk modal draft state and close/start helpers.

src/features/admin/inventory/hooks/use-inventory-single-actions.ts
  Owns single-product create, edit, critical field save, reserve, cancel reservation, sell, archive, restore, and image upload actions.

src/features/admin/inventory/hooks/use-inventory-bulk-actions.ts
  Owns bulk action POST helper, bulk submit, clear archived, and bulk-start actions that need API behavior.

src/features/admin/inventory/hooks/use-inventory-action-state.ts
  Owns shared working/error state and the `runAction` helper used by single and bulk action hooks.
```

## Final Line Targets

```text
src/features/admin/inventory/hooks/use-admin-inventory-controller.ts       <= 260 lines
src/features/admin/inventory/hooks/use-inventory-filters.ts                <= 260 lines
src/features/admin/inventory/hooks/use-inventory-selection.ts              <= 120 lines
src/features/admin/inventory/hooks/use-inventory-modal-state.ts            <= 220 lines
src/features/admin/inventory/hooks/use-inventory-action-state.ts           <= 100 lines
src/features/admin/inventory/hooks/use-inventory-single-actions.ts         <= 260 lines
src/features/admin/inventory/hooks/use-inventory-bulk-actions.ts           <= 260 lines
```

## Public Controller Contract To Preserve

The controller returned by `useAdminInventoryController` must continue to provide the names used by `AdminInventoryView`:

```ts
type AdminInventoryController = {
  t: ReturnType<typeof import('@/lib/i18n').useI18n>['t'];
  pageTitle: string;
  pageDescription: string;
  attributes: import('@/features/catalog').AttributeDTO[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  isStale: boolean;
  lastRefreshAt: string | null;
  areReservationCommentsLoading: boolean;
  reservationCommentError: string | null;
  reloadReservationComments: () => Promise<void> | void;
  actionError: string | null;
  actionErrorKey: string | null;
  workingKey: string | null;
  canManageCatalog: boolean;
  canReserve: boolean;
  canBulkReserve: boolean;
  canCancelReservation: boolean;
  canDiscountSelected: boolean;
  canMarkSold: boolean;
  canDelete: boolean;
  canRestore: boolean;
  canClearArchived: boolean;
  canUploadToStorage: boolean;
  counts: { active: number; reserved: number; sold: number };
  categoryTab: import('@/features/admin/inventory/types').CategoryTab;
  query: string;
  stockFilter: import('@/features/admin/inventory/types').StockFilter;
  bikeTypeFilter: import('@/features/admin/inventory/types').BikeTypeFilter;
  minPriceFilter: string;
  maxPriceFilter: string;
  attributeFilters: Record<string, string>;
  isDetailedFiltersOpen: boolean;
  visibleFilterAttributes: import('@/features/catalog').AttributeDTO[];
  attributeOptionsById: Record<string, string[]>;
  driveTypeFilterOptions: string[];
  selectedProductIds: string[];
  allVisibleSelected: boolean;
  bulkResult: import('@/features/admin/inventory/types').BulkActionResult | null;
  visibleProducts: import('@/features/catalog').ProductDTO[];
  criticalDrafts: Record<string, { price: string; stock: string }>;
  activeReservationByProductId: Map<string, import('@/features/reservations').ReservationDTO>;
  createOpen: boolean;
  createDraft: import('@/features/admin/inventory/types').ProductFormDraft;
  editProductId: string | null;
  editDraft: import('@/features/admin/inventory/types').ProductFormDraft;
  reserveProductId: string | null;
  reserveAtLocal: string;
  reserveNote: string;
  reservationContext: import('@/features/admin/inventory/types').ReservationContextDraft;
  sellProductId: string | null;
  sellPrice: string;
  sellChannel: import('@/features/admin/inventory/types').SellChannel;
  sellNote: string;
  bulkMode: import('@/features/admin/inventory/types').BulkMode | null;
  bulkDiscountInput: string;
  bulkDiscountReason: string;
  reloadPageData: () => Promise<void>;
  openCreate: () => Promise<void>;
  changeCategoryTab: (tab: import('@/features/admin/inventory/types').CategoryTab) => void;
  setQuery: (value: string) => void;
  setIsDetailedFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStockFilter: (value: import('@/features/admin/inventory/types').StockFilter) => void;
  setBikeTypeFilter: (value: import('@/features/admin/inventory/types').BikeTypeFilter) => void;
  setMinPriceFilter: (value: string) => void;
  setMaxPriceFilter: (value: string) => void;
  changeAttributeFilter: (attributeId: string, value: string) => void;
  resetDetailedFilters: () => void;
  toggleSelectVisible: () => void;
  startBulkReserve: () => void;
  startBulkCancelReservation: () => void;
  startBulkDiscount: () => void;
  startBulkRemoveDiscount: () => void;
  startBulkSell: () => void;
  startBulkDelete: () => void;
  clearSelection: () => void;
  toggleProductSelection: (productId: string) => void;
  updateDraft: (
    productId: string,
    patch: Partial<{ price: string; stock: string }>,
    fallback: { price: string; stock: string }
  ) => void;
  saveCriticalFields: (product: import('@/features/catalog').ProductDTO) => Promise<void>;
  openEdit: (product: import('@/features/catalog').ProductDTO) => Promise<void>;
  openReserve: (product: import('@/features/catalog').ProductDTO) => void;
  cancelReservation: (product: import('@/features/catalog').ProductDTO) => Promise<void>;
  openSell: (product: import('@/features/catalog').ProductDTO) => void;
  archiveProduct: (product: import('@/features/catalog').ProductDTO) => Promise<void>;
  restoreArchivedProduct: (product: import('@/features/catalog').ProductDTO) => Promise<void>;
  dismissActionError: () => void;
  setCreateDraft: React.Dispatch<React.SetStateAction<import('@/features/admin/inventory/types').ProductFormDraft>>;
  setEditDraft: React.Dispatch<React.SetStateAction<import('@/features/admin/inventory/types').ProductFormDraft>>;
  setReserveAtLocal: (value: string) => void;
  setReserveNote: (value: string) => void;
  setReservationContext: React.Dispatch<React.SetStateAction<import('@/features/admin/inventory/types').ReservationContextDraft>>;
  setSellPrice: (value: string) => void;
  setSellChannel: (value: import('@/features/admin/inventory/types').SellChannel) => void;
  setSellNote: (value: string) => void;
  setBulkDiscountInput: (value: string) => void;
  setBulkDiscountReason: (value: string) => void;
  closeReserveDraft: () => void;
  closeBulkModal: () => void;
  setCreateOpen: (value: boolean) => void;
  setEditProductId: (value: string | null) => void;
  setSellProductId: (value: string | null) => void;
  submitCreate: (event: React.FormEvent) => Promise<void>;
  submitEdit: (event: React.FormEvent) => Promise<void>;
  submitReserve: (event: React.FormEvent) => Promise<void>;
  submitSell: (event: React.FormEvent) => Promise<void>;
  submitBulkAction: (event: React.FormEvent) => Promise<void>;
  preventImplicitReservationSubmit: (event: React.KeyboardEvent<HTMLFormElement>) => void;
  uploadImageIntoDraft: (target: 'create' | 'edit', file: File) => Promise<void>;
};
```

The actual implementation may place this type in `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts` or a local `controller-types.ts` file if the facade becomes too long. Do not export it outside the inventory feature unless another file needs it.

## Task 1: Baseline And Guardrails

**Files:**
- Read: `src/features/admin/admin-inventory-view.tsx`
- Read: `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts`
- Verify: `npm run build`

- [ ] **Step 1: Record current line counts**

Run:

```powershell
(Get-Content src\features\admin\admin-inventory-view.tsx | Measure-Object -Line).Lines
(Get-Content src\features\admin\inventory\hooks\use-admin-inventory-controller.ts | Measure-Object -Line).Lines
```

Expected:

```text
208
863
```

- [ ] **Step 2: Run current build before refactoring**

Run:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 3: Confirm no app code changes are bundled with planning**

Run:

```powershell
git status --short --untracked-files=all
```

Expected: working tree may include existing refactor files and docs, but this task must not introduce application-code edits before the first approved implementation slice.

## Task 2: Extract Filter Hook

**Files:**
- Create: `src/features/admin/inventory/hooks/use-inventory-filters.ts`
- Modify: `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts`
- Verify: `npm run build`

- [ ] **Step 1: Create filter hook interface**

Create `src/features/admin/inventory/hooks/use-inventory-filters.ts` with this public shape:

```ts
'use client';

import { useMemo, useState } from 'react';
import type { AttributeDTO, ProductDTO, ProductStatus } from '@/features/catalog';
import { getCurrentPrice } from '@/features/catalog';
import { coreFieldOptions, loadFieldLayoutConfig } from '@/features/fields/field-layout';
import type { BikeTypeFilter, CategoryTab, StockFilter } from '@/features/admin/inventory/types';
import { parseFilterPrice } from '@/features/admin/inventory/utils/money';

type UseInventoryFiltersParams = {
  products: ProductDTO[];
  attributes: AttributeDTO[];
  statusView: ProductStatus;
};

export function useInventoryFilters({
  products,
  attributes,
  statusView,
}: UseInventoryFiltersParams) {
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('All');
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('All');
  const [bikeTypeFilter, setBikeTypeFilter] = useState<BikeTypeFilter>('All');
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const [isDetailedFiltersOpen, setIsDetailedFiltersOpen] = useState(false);

  const changeCategoryTab = (tab: CategoryTab) => {
    setCategoryTab(tab);
    if (tab === 'Parts') {
      setBikeTypeFilter('All');
    }
    setAttributeFilters({});
  };

  const changeAttributeFilter = (attributeId: string, value: string) => {
    setAttributeFilters((current) => ({
      ...current,
      [attributeId]: value,
    }));
  };

  const resetDetailedFilters = () => {
    setStockFilter('All');
    setBikeTypeFilter('All');
    setMinPriceFilter('');
    setMaxPriceFilter('');
    setAttributeFilters({});
  };

  const visibleFilterAttributes = useMemo(
    () =>
      attributes.filter(
        (attribute) => categoryTab === 'All' || attribute.category === categoryTab
      ),
    [attributes, categoryTab]
  );

  const attributeOptionsById = useMemo(() => {
    const scopedProducts = products.filter(
      (product) =>
        product.status === statusView &&
        (categoryTab === 'All' || product.category === categoryTab)
    );
    const options: Record<string, string[]> = {};
    for (const attribute of visibleFilterAttributes) {
      if (attribute.inputMode === 'single_select' && attribute.options.length > 0) {
        options[attribute.id] = attribute.options.map((option) => option.value);
        continue;
      }
      options[attribute.id] = Array.from(
        new Set(
          scopedProducts
            .map((product) => product.values[attribute.id])
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b));
    }
    return options;
  }, [categoryTab, products, statusView, visibleFilterAttributes]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minPrice = parseFilterPrice(minPriceFilter);
    const maxPrice = parseFilterPrice(maxPriceFilter);
    return products.filter((product) => {
      if (product.status !== statusView) {
        return false;
      }
      if (categoryTab !== 'All' && product.category !== categoryTab) {
        return false;
      }
      if (
        normalizedQuery &&
        ![product.name, product.serial, product.description]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }
      if (stockFilter === 'In Stock' && !product.inStock) {
        return false;
      }
      if (stockFilter === 'Out of Stock' && product.inStock) {
        return false;
      }
      if (bikeTypeFilter !== 'All') {
        if (product.category !== 'Bicycle' || product.type !== bikeTypeFilter) {
          return false;
        }
      }
      const currentPrice = getCurrentPrice(product);
      if (minPrice !== null && currentPrice < minPrice) {
        return false;
      }
      if (maxPrice !== null && currentPrice > maxPrice) {
        return false;
      }
      for (const [attributeId, selectedValue] of Object.entries(attributeFilters)) {
        if (selectedValue && product.values[attributeId] !== selectedValue) {
          return false;
        }
      }
      return true;
    });
  }, [
    products,
    categoryTab,
    query,
    stockFilter,
    bikeTypeFilter,
    minPriceFilter,
    maxPriceFilter,
    attributeFilters,
    statusView,
  ]);

  const driveTypeFilterOptions = useMemo(() => {
    const configuredOptions = coreFieldOptions(loadFieldLayoutConfig(), 'drive_type').map((option) => option.value);
    const productOptions = products
      .map((product) => product.type)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set([...configuredOptions, ...productOptions])).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const counts = useMemo(
    () => ({
      active: products.filter((item) => item.status === 'active').length,
      reserved: products.filter((item) => item.status === 'reserved').length,
      sold: products.filter((item) => item.status === 'sold').length,
    }),
    [products]
  );

  return {
    counts,
    categoryTab,
    query,
    stockFilter,
    bikeTypeFilter,
    minPriceFilter,
    maxPriceFilter,
    attributeFilters,
    isDetailedFiltersOpen,
    visibleFilterAttributes,
    attributeOptionsById,
    driveTypeFilterOptions,
    visibleProducts,
    changeCategoryTab,
    setQuery,
    setIsDetailedFiltersOpen,
    setStockFilter,
    setBikeTypeFilter,
    setMinPriceFilter,
    setMaxPriceFilter,
    changeAttributeFilter,
    resetDetailedFilters,
  };
}
```

- [ ] **Step 2: Wire the controller to the filter hook**

In `use-admin-inventory-controller.ts`, remove the duplicated filter state, derived `useMemo` blocks, and filter helper functions. Add:

```ts
import { useInventoryFilters } from '@/features/admin/inventory/hooks/use-inventory-filters';
```

Then inside `useAdminInventoryController`:

```ts
const filters = useInventoryFilters({
  products,
  attributes,
  statusView,
});
```

Replace direct references in the controller return with `filters.counts`, `filters.categoryTab`, `filters.visibleProducts`, and the matching filter setters/helpers.

- [ ] **Step 3: Build**

Run:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

## Task 3: Extract Selection Hook

**Files:**
- Create: `src/features/admin/inventory/hooks/use-inventory-selection.ts`
- Modify: `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts`
- Verify: `npm run build`

- [ ] **Step 1: Create selection hook**

Create `src/features/admin/inventory/hooks/use-inventory-selection.ts`:

```ts
'use client';

import { useMemo, useState } from 'react';

type UseInventorySelectionParams = {
  visibleProductIds: string[];
};

export function useInventorySelection({ visibleProductIds }: UseInventorySelectionParams) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const selectedVisibleCount = useMemo(
    () => selectedProductIds.filter((id) => visibleProductIds.includes(id)).length,
    [selectedProductIds, visibleProductIds]
  );

  const allVisibleSelected =
    visibleProductIds.length > 0 && selectedVisibleCount === visibleProductIds.length;

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  const toggleSelectVisible = () => {
    setSelectedProductIds((current) => {
      const currentSet = new Set(current);
      if (allVisibleSelected) {
        return current.filter((id) => !visibleProductIds.includes(id));
      }
      visibleProductIds.forEach((id) => currentSet.add(id));
      return Array.from(currentSet);
    });
  };

  const clearSelectedProductIds = () => {
    setSelectedProductIds([]);
  };

  return {
    selectedProductIds,
    setSelectedProductIds,
    allVisibleSelected,
    toggleProductSelection,
    toggleSelectVisible,
    clearSelectedProductIds,
  };
}
```

- [ ] **Step 2: Wire selection in controller**

In `use-admin-inventory-controller.ts`, add:

```ts
import { useInventorySelection } from '@/features/admin/inventory/hooks/use-inventory-selection';
```

Then derive IDs from the extracted filters:

```ts
const visibleProductIds = useMemo(
  () => filters.visibleProducts.map((product) => product.id),
  [filters.visibleProducts]
);

const selection = useInventorySelection({ visibleProductIds });
```

Keep `clearSelection` in the controller until `clearSelectedArchivedProducts` is extracted:

```ts
const clearSelection = () => {
  if (canClearArchived) {
    void clearSelectedArchivedProducts();
    return;
  }
  selection.clearSelectedProductIds();
};
```

- [ ] **Step 3: Build**

Run:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

## Task 4: Extract Shared Action State

**Files:**
- Create: `src/features/admin/inventory/hooks/use-inventory-action-state.ts`
- Modify: `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts`
- Verify: `npm run build`

- [ ] **Step 1: Create action state hook**

Create `src/features/admin/inventory/hooks/use-inventory-action-state.ts`:

```ts
'use client';

import { useState } from 'react';
import { parseActionError } from '@/features/admin/inventory/utils/api-errors';

type UseInventoryActionStateParams = {
  reload: () => Promise<void> | void;
};

export function useInventoryActionState({ reload }: UseInventoryActionStateParams) {
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);

  const runAction = async (key: string, action: () => Promise<void>) => {
    setWorkingKey(key);
    setActionError(null);
    setActionErrorKey(null);
    try {
      await action();
      await reload();
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
      setActionErrorKey(key);
    } finally {
      setWorkingKey(null);
    }
  };

  const dismissActionError = () => {
    setActionError(null);
    setActionErrorKey(null);
  };

  return {
    workingKey,
    setWorkingKey,
    actionError,
    setActionError,
    actionErrorKey,
    setActionErrorKey,
    runAction,
    dismissActionError,
  };
}
```

- [ ] **Step 2: Wire action state in controller**

In `use-admin-inventory-controller.ts`, add:

```ts
import { useInventoryActionState } from '@/features/admin/inventory/hooks/use-inventory-action-state';
```

Then inside the controller:

```ts
const actionState = useInventoryActionState({ reload });
```

Replace `workingKey`, `setWorkingKey`, `actionError`, `setActionError`, `actionErrorKey`, `setActionErrorKey`, `runAction`, and `dismissActionError` references with `actionState.*`.

- [ ] **Step 3: Build**

Run:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

## Task 5: Extract Modal Draft State

**Files:**
- Create: `src/features/admin/inventory/hooks/use-inventory-modal-state.ts`
- Modify: `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts`
- Verify: `npm run build`

- [ ] **Step 1: Create modal state hook**

Create `src/features/admin/inventory/hooks/use-inventory-modal-state.ts` with the state that is currently declared near the top of the controller:

```ts
'use client';

import { useState } from 'react';
import { EMPTY_DRAFT, EMPTY_RESERVATION_CONTEXT } from '@/features/admin/inventory/constants';
import type {
  BulkActionResult,
  BulkMode,
  ProductFormDraft,
  ReservationContextDraft,
  SellChannel,
} from '@/features/admin/inventory/types';
import { formatDatetimeForInput } from '@/features/admin/inventory/utils/date';
import { draftFromProduct } from '@/features/admin/inventory/utils/product-draft';
import { getCurrentPrice, type ProductDTO } from '@/features/catalog';

type UseInventoryModalStateParams = {
  soldFromAdminNote: string;
  bulkSaleNote: string;
};

export function useInventoryModalState({
  soldFromAdminNote,
  bulkSaleNote,
}: UseInventoryModalStateParams) {
  const [criticalDrafts, setCriticalDrafts] = useState<Record<string, { price: string; stock: string }>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ProductFormDraft>(EMPTY_DRAFT);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProductFormDraft>(EMPTY_DRAFT);
  const [reserveProductId, setReserveProductId] = useState<string | null>(null);
  const [reserveAtLocal, setReserveAtLocal] = useState('');
  const [reserveNote, setReserveNote] = useState('');
  const [reservationContext, setReservationContext] = useState<ReservationContextDraft>(EMPTY_RESERVATION_CONTEXT);
  const [sellProductId, setSellProductId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellChannel, setSellChannel] = useState<SellChannel>('in_store');
  const [sellNote, setSellNote] = useState('');
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);
  const [bulkDiscountInput, setBulkDiscountInput] = useState('');
  const [bulkDiscountReason, setBulkDiscountReason] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkActionResult | null>(null);

  const openEditDraft = (product: ProductDTO) => {
    setEditProductId(product.id);
    setEditDraft(draftFromProduct(product));
  };

  const openReserveDraft = (product: ProductDTO) => {
    setReserveProductId(product.id);
    setReserveAtLocal(formatDatetimeForInput(new Date().toISOString()));
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
  };

  const closeReserveDraft = () => {
    setReserveProductId(null);
    setReserveAtLocal('');
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
  };

  const openSellDraft = (product: ProductDTO) => {
    setSellProductId(product.id);
    setSellPrice(String(getCurrentPrice(product)));
    setSellChannel('in_store');
    setSellNote(soldFromAdminNote);
  };

  const closeBulkModal = () => {
    setBulkMode(null);
    setBulkDiscountInput('');
    setBulkDiscountReason('');
    setReserveAtLocal('');
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
    setSellChannel('in_store');
    setSellNote('');
  };

  const startBulkReserve = () => {
    setBulkMode('reserve');
    setReserveAtLocal(formatDatetimeForInput(new Date().toISOString()));
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
    setBulkResult(null);
  };

  const startBulkCancelReservation = () => {
    setBulkMode('cancel-reservation');
    setBulkResult(null);
  };

  const startBulkDiscount = () => {
    setBulkMode('discount');
    setBulkResult(null);
  };

  const startBulkRemoveDiscount = () => {
    setBulkMode('remove-discount');
    setBulkResult(null);
  };

  const startBulkSell = () => {
    setBulkMode('sell');
    setSellChannel('in_store');
    setSellNote(bulkSaleNote);
    setBulkResult(null);
  };

  const startBulkDelete = () => {
    setBulkMode('delete');
    setBulkResult(null);
  };

  return {
    criticalDrafts,
    setCriticalDrafts,
    createOpen,
    setCreateOpen,
    createDraft,
    setCreateDraft,
    editProductId,
    setEditProductId,
    editDraft,
    setEditDraft,
    reserveProductId,
    setReserveProductId,
    reserveAtLocal,
    setReserveAtLocal,
    reserveNote,
    setReserveNote,
    reservationContext,
    setReservationContext,
    sellProductId,
    setSellProductId,
    sellPrice,
    setSellPrice,
    sellChannel,
    setSellChannel,
    sellNote,
    setSellNote,
    bulkMode,
    setBulkMode,
    bulkDiscountInput,
    setBulkDiscountInput,
    bulkDiscountReason,
    setBulkDiscountReason,
    bulkResult,
    setBulkResult,
    openEditDraft,
    openReserveDraft,
    closeReserveDraft,
    openSellDraft,
    closeBulkModal,
    startBulkReserve,
    startBulkCancelReservation,
    startBulkDiscount,
    startBulkRemoveDiscount,
    startBulkSell,
    startBulkDelete,
  };
}
```

- [ ] **Step 2: Wire modal state in controller**

In `use-admin-inventory-controller.ts`, add:

```ts
import { useInventoryModalState } from '@/features/admin/inventory/hooks/use-inventory-modal-state';
```

Then inside the controller:

```ts
const modalState = useInventoryModalState({
  soldFromAdminNote: t('inventory.soldFromAdminNote'),
  bulkSaleNote: t('inventory.bulkSaleNote'),
});
```

Replace modal state and modal helper references with `modalState.*`.

- [ ] **Step 3: Build**

Run:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

## Task 6: Extract Single-Product Actions

**Files:**
- Create: `src/features/admin/inventory/hooks/use-inventory-single-actions.ts`
- Modify: `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts`
- Verify: `npm run build`

- [ ] **Step 1: Create action hook shell**

Create `src/features/admin/inventory/hooks/use-inventory-single-actions.ts` with explicit dependencies instead of importing page state:

```ts
'use client';

import type { FormEvent, KeyboardEvent } from 'react';
import { EMPTY_DRAFT, EMPTY_RESERVATION_CONTEXT } from '@/features/admin/inventory/constants';
import type { ProductFormDraft, ReservationContextDraft, SellChannel } from '@/features/admin/inventory/types';
import { getApiErrorMessage, parseActionError } from '@/features/admin/inventory/utils/api-errors';
import { reservationExpiryIso } from '@/features/admin/inventory/utils/date';
import { toMoney, toStock } from '@/features/admin/inventory/utils/money';
import { imagesFromDraft, valuesForCategory } from '@/features/admin/inventory/utils/product-draft';
import type { AttributeDTO, ProductDTO } from '@/features/catalog';
import { getCurrentPrice, parseDiscountInput } from '@/features/catalog';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { getJsonAuthHeaders } from '@/lib/auth/request-headers';
import { uploadCatalogImageFile } from '@/lib/supabase/storage';

type CatalogRepository = ReturnType<typeof import('@/features/catalog').getCatalogRepository>;
type RunAction = (key: string, action: () => Promise<void>) => Promise<void>;
type PostBulkAction = (
  action: 'apply_discount' | 'remove_discount' | 'reserve' | 'cancel_reservation' | 'mark_sold' | 'archive',
  itemIds: string[],
  payload?: Record<string, unknown>
) => Promise<import('@/features/admin/inventory/types').BulkActionResult>;

type UseInventorySingleActionsParams = {
  role: import('@/features/admin/inventory/types').InventoryRole;
  attributes: AttributeDTO[];
  catalogRepository: CatalogRepository;
  runAction: RunAction;
  postBulkAction: PostBulkAction;
  reload: () => Promise<void> | void;
  t: (key: string, params?: Record<string, unknown>) => string;
  createDraft: ProductFormDraft;
  setCreateDraft: React.Dispatch<React.SetStateAction<ProductFormDraft>>;
  setCreateOpen: (value: boolean) => void;
  editProductId: string | null;
  editDraft: ProductFormDraft;
  setEditDraft: React.Dispatch<React.SetStateAction<ProductFormDraft>>;
  setEditProductId: (value: string | null) => void;
  reserveProductId: string | null;
  reserveAtLocal: string;
  reserveNote: string;
  reservationContext: ReservationContextDraft;
  closeReserveDraft: () => void;
  setReserveProductId: (value: string | null) => void;
  setReserveAtLocal: (value: string) => void;
  setReserveNote: (value: string) => void;
  setReservationContext: React.Dispatch<React.SetStateAction<ReservationContextDraft>>;
  sellProductId: string | null;
  sellPrice: string;
  sellChannel: SellChannel;
  sellNote: string;
  setSellProductId: (value: string | null) => void;
  setSellPrice: (value: string) => void;
  setSellNote: (value: string) => void;
  criticalDrafts: Record<string, { price: string; stock: string }>;
  setCriticalDrafts: React.Dispatch<React.SetStateAction<Record<string, { price: string; stock: string }>>>;
  setWorkingKey: (value: string | null) => void;
  setActionError: (value: string | null) => void;
  setActionErrorKey: (value: string | null) => void;
  openEditDraft: (product: ProductDTO) => void;
  openReserveDraft: (product: ProductDTO) => void;
  openSellDraft: (product: ProductDTO) => void;
};
```

- [ ] **Step 2: Move existing single action bodies**

In the same implementation slice, define `useInventorySingleActions(params: UseInventorySingleActionsParams)` and move these exact controller functions into it. Replace state references with `params.*` and keep the existing payloads, validation messages, invalidation tags, and close/reset behavior unchanged:

```text
openCreate
updateDraft
saveCriticalFields
uploadImageIntoDraft
submitCreate
openEdit
submitEdit
openReserve
preventImplicitReservationSubmit
submitReserve
cancelReservation
openSell
submitSell
restoreArchivedProduct
archiveProduct
```

The returned hook object must expose the same names:

```ts
export function useInventorySingleActions(params: UseInventorySingleActionsParams) {
  return {
    openCreate,
    updateDraft,
    saveCriticalFields,
    uploadImageIntoDraft,
    submitCreate,
    openEdit,
    submitEdit,
    openReserve,
    preventImplicitReservationSubmit,
    submitReserve,
    cancelReservation,
    openSell,
    submitSell,
    restoreArchivedProduct,
    archiveProduct,
  };
}
```

Every returned function must be the moved implementation from `use-admin-inventory-controller.ts`. Do not replace function bodies with wrappers that call back into the controller.

- [ ] **Step 3: Build**

Run:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

## Task 7: Extract Bulk Actions

**Files:**
- Create: `src/features/admin/inventory/hooks/use-inventory-bulk-actions.ts`
- Modify: `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts`
- Verify: `npm run build`

- [ ] **Step 1: Create bulk action hook parameter types**

Create `src/features/admin/inventory/hooks/use-inventory-bulk-actions.ts` with imports and parameter types:

```ts
'use client';

import type { FormEvent } from 'react';
import type { BulkActionResult, BulkMode, InventoryRole, ReservationContextDraft, SellChannel } from '@/features/admin/inventory/types';
import { getApiErrorMessage, parseActionError } from '@/features/admin/inventory/utils/api-errors';
import { reservationExpiryIso } from '@/features/admin/inventory/utils/date';
import type { ProductDTO } from '@/features/catalog';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { getJsonAuthHeaders } from '@/lib/auth/request-headers';

type RunAction = (key: string, action: () => Promise<void>) => Promise<void>;

type UseInventoryBulkActionsParams = {
  role: InventoryRole;
  products: ProductDTO[];
  selectedProductIds: string[];
  setSelectedProductIds: React.Dispatch<React.SetStateAction<string[]>>;
  canClearArchived: boolean;
  bulkMode: BulkMode | null;
  bulkDiscountInput: string;
  bulkDiscountReason: string;
  reserveAtLocal: string;
  reserveNote: string;
  reservationContext: ReservationContextDraft;
  sellChannel: SellChannel;
  sellNote: string;
  setActionError: (value: string | null) => void;
  runAction: RunAction;
  setBulkResult: (value: BulkActionResult | null) => void;
  closeBulkModal: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
};
```

- [ ] **Step 2: Move existing bulk functions**

Define `useInventoryBulkActions(params: UseInventoryBulkActionsParams)` and move these existing controller functions into it:

```text
postBulkAction
submitBulkAction
clearSelectedArchivedProducts
clearSelection
```

The hook must return:

```ts
export function useInventoryBulkActions(params: UseInventoryBulkActionsParams) {
  return {
    postBulkAction,
    submitBulkAction,
    clearSelectedArchivedProducts,
    clearSelection,
  };
}
```

Every returned function must be the moved implementation from `use-admin-inventory-controller.ts`. Keep the `/api/catalog/bulk`, `/api/catalog/{id}/clear`, selected ID clearing, confirmation dialog, invalidation tags, and skipped-result handling unchanged.

- [ ] **Step 3: Feed `postBulkAction` back to single actions**

Because `submitReserve` and `cancelReservation` use the same bulk API endpoint, pass `bulkActions.postBulkAction` into `useInventorySingleActions`.

- [ ] **Step 4: Build**

Run:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

## Task 8: Controller Cleanup And Final Verification

**Files:**
- Modify: `src/features/admin/inventory/hooks/use-admin-inventory-controller.ts`
- Verify: `node docs\tests\verify-max-file-lines.mjs`
- Verify: `git diff --check`
- Verify: `npm run build`

- [ ] **Step 1: Make the facade readable**

Keep the controller body ordered like this:

```text
1. Read i18n with useI18n.
2. Load catalog data with useCatalogData.
3. Load reservation comment data with useReservationData.
4. Create catalogRepository with useMemo.
5. Derive permission booleans from role and statusView.
6. Derive pageTitle and pageDescription.
7. Call useInventoryFilters.
8. Derive visibleProductIds from filters.visibleProducts.
9. Call useInventorySelection.
10. Call useInventoryActionState.
11. Call useInventoryModalState.
12. Call useInventoryBulkActions.
13. Call useInventorySingleActions.
14. Define reloadPageData.
15. Define activeReservationByProductId.
16. Return the existing AdminInventoryView controller contract.
```

The facade should only wire hooks together and expose the existing page contract.

- [ ] **Step 2: Check hook line limits**

Run:

```powershell
node docs\tests\verify-max-file-lines.mjs
```

Expected:

```text
Max file line checks passed.
```

- [ ] **Step 3: Check whitespace**

Run:

```powershell
git diff --check
```

Expected: no output.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 5: Manual smoke test**

On production or local app after deployment, verify:

```text
Admin inventory page loads.
Search changes visible products.
Category tabs change visible products.
Detailed filters open and close.
Edit modal opens and closes without saving.
Reserve modal opens and closes without saving.
Sell modal opens and closes without saving.
Bulk toolbar still selects and clears visible products.
Reserved page loads and reservation comments area still renders.
```
## Risk Notes

- The highest-risk slice is Task 6 because it moves many API actions and validation branches.
- The second-highest risk is Task 7 because bulk reserve and single reserve share `postBulkAction`.
- Filtering is low risk because it only moves state and derived arrays without touching API calls.
- Selection is low risk because it only moves selected ID state and visible ID calculations.
- Modal state is medium risk because reserve/sell/bulk state is shared by multiple forms.

## Execution Rule

Do not implement this plan automatically. The next implementation should start only after the user approves one of these options:

```text
1. Implement Task 2 only: filter hook extraction.
2. Implement Tasks 2 and 3: filters plus selection.
3. Implement all tasks with build checkpoints after each task.
```
