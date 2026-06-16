# Admin Inventory Filters Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the admin inventory count cards and filter UI into a focused component while keeping filtering behavior and visible UI exactly the same.

**Architecture:** `AdminInventoryView` remains the coordinator. It keeps filter state, derived filter data, and the actual `visibleProducts` filtering logic. The new `InventoryFilters` component renders the count cards, category tabs, search input, detailed filters toggle, stock/type/price fields, attribute filters, and clear filters button through props and callbacks.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node `.mjs` verification scripts.

---

## Scope

Extract this existing UI region from `src/features/admin/admin-inventory-view.tsx`:

- the three inventory count cards
- category tab buttons
- search input
- detailed filters toggle button
- stock filter select
- bike type filter select
- min/max price inputs
- attribute filter selects
- clear filters button

Create:

`src/features/admin/inventory/components/inventory-filters.tsx`

Keep in `src/features/admin/admin-inventory-view.tsx`:

- `categoryTab`, `query`, `stockFilter`, `bikeTypeFilter`, `minPriceFilter`, `maxPriceFilter`, `attributeFilters`, `isDetailedFiltersOpen`
- `visibleFilterAttributes`
- `attributeOptionsById`
- `visibleProducts`
- `driveTypeFilterOptions`
- `counts`
- `resetDetailedFilters`
- all API actions
- all product card rendering
- all bulk/reservation/sell modal rendering

This plan does not extract product cards, bulk action bars, bulk modals, reservation modals, sell modals, hooks, API logic, or filtering logic.

Expected size change:

- `admin-inventory-view.tsx`: about 1,531 lines -> about 1,370-1,420 lines
- `inventory-filters.tsx`: about 140-190 lines

This is a moderate slice. The larger reduction comes later from product card and modal extraction.

## Files

- Create: `src/features/admin/inventory/components/inventory-filters.tsx`
- Modify: `src/features/admin/admin-inventory-view.tsx`
- Verify: `node docs\tests\verify-structure-baseline.mjs`
- Verify: `git diff --check`
- Verify: `npm run build`

## Task 1: Baseline Verification

**Files:**
- Verify only

- [ ] **Step 1: Run current structure baseline**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
```

Expected:

```text
Structure baseline verification passed.
```

- [ ] **Step 2: Confirm current working tree**

Run:

```powershell
git status --short --untracked-files=all
```

Expected: existing uncommitted extraction files and plan files may appear. No `.superpowers` files should appear.

## Task 2: Create Inventory Filters Component

**Files:**
- Create: `src/features/admin/inventory/components/inventory-filters.tsx`

- [ ] **Step 1: Create the component imports and props**

Create `src/features/admin/inventory/components/inventory-filters.tsx` with these imports and types:

```tsx
'use client';

import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import type { AttributeDTO } from '@/features/catalog';
import type { BikeTypeFilter, CategoryTab, StockFilter } from '@/features/admin/inventory/types';
import {
  categoryLabel,
  driveTypeLabel,
  fieldNameLabel,
  useI18n,
} from '@/lib/i18n';

type InventoryCounts = {
  active: number;
  reserved: number;
  sold: number;
};

type InventoryFiltersProps = {
  counts: InventoryCounts;
  categoryTab: CategoryTab;
  onCategoryTabChange: (tab: CategoryTab) => void;
  query: string;
  onQueryChange: (value: string) => void;
  isDetailedFiltersOpen: boolean;
  onToggleDetailedFilters: () => void;
  stockFilter: StockFilter;
  onStockFilterChange: (value: StockFilter) => void;
  bikeTypeFilter: BikeTypeFilter;
  onBikeTypeFilterChange: (value: BikeTypeFilter) => void;
  minPriceFilter: string;
  onMinPriceFilterChange: (value: string) => void;
  maxPriceFilter: string;
  onMaxPriceFilterChange: (value: string) => void;
  attributeFilters: Record<string, string>;
  onAttributeFilterChange: (attributeId: string, value: string) => void;
  visibleFilterAttributes: AttributeDTO[];
  attributeOptionsById: Record<string, string[]>;
  driveTypeFilterOptions: string[];
  onResetDetailedFilters: () => void;
};
```

- [ ] **Step 2: Add the exported component**

Add the component function:

```tsx
export function InventoryFilters({
  counts,
  categoryTab,
  onCategoryTabChange,
  query,
  onQueryChange,
  isDetailedFiltersOpen,
  onToggleDetailedFilters,
  stockFilter,
  onStockFilterChange,
  bikeTypeFilter,
  onBikeTypeFilterChange,
  minPriceFilter,
  onMinPriceFilterChange,
  maxPriceFilter,
  onMaxPriceFilterChange,
  attributeFilters,
  onAttributeFilterChange,
  visibleFilterAttributes,
  attributeOptionsById,
  driveTypeFilterOptions,
  onResetDetailedFilters,
}: InventoryFiltersProps) {
  const { locale, t } = useI18n();

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4 sm:gap-3 sm:mb-5">
        <div className="rounded-2xl border border-cyan-100 bg-white p-3 sm:p-4"><p className="text-[11px] text-slate-500 sm:text-xs">{t('common.active')}</p><p className="text-xl font-black text-slate-900 sm:text-2xl">{counts.active}</p></div>
        <div className="rounded-2xl border border-cyan-100 bg-white p-3 sm:p-4"><p className="text-[11px] text-slate-500 sm:text-xs">{t('common.reserved')}</p><p className="text-xl font-black text-slate-900 sm:text-2xl">{counts.reserved}</p></div>
        <div className="rounded-2xl border border-cyan-100 bg-white p-3 sm:p-4"><p className="text-[11px] text-slate-500 sm:text-xs">{t('common.sold')}</p><p className="text-xl font-black text-slate-900 sm:text-2xl">{counts.sold}</p></div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Bicycle', 'Parts'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onCategoryTabChange(tab)}
              className={`h-10 px-4 rounded-xl text-sm font-semibold ${
                categoryTab === tab
                  ? 'bg-[var(--brand-navy)] text-white'
                  : 'brand-control border text-slate-700'
              }`}
            >
              {tab === 'All' ? t('common.all') : categoryLabel(tab, t)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:min-w-72 sm:flex-1">
            <Search size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('inventory.searchPlaceholder')}
              className="brand-control h-10 w-full rounded-xl border pl-8 pr-3 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={onToggleDetailedFilters}
            className="brand-control inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold text-slate-700 hover:bg-cyan-50 sm:w-auto sm:px-4"
          >
            <SlidersHorizontal size={14} />
            {t('inventory.detailedFilters')}
            <ChevronDown
              size={14}
              className={`transition-transform ${isDetailedFiltersOpen ? 'rotate-180' : 'rotate-0'}`}
            />
          </button>
        </div>

        {isDetailedFiltersOpen && (
          <div className="brand-filter-panel grid grid-cols-1 gap-3 rounded-2xl border p-4 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={stockFilter}
              onChange={(event) => onStockFilterChange(event.target.value as StockFilter)}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            >
              <option value="All">{t('inventory.allStock')}</option>
              <option value="In Stock">{t('common.inStock')}</option>
              <option value="Out of Stock">{t('common.outOfStock')}</option>
            </select>

            <select
              value={bikeTypeFilter}
              onChange={(event) => onBikeTypeFilterChange(event.target.value as BikeTypeFilter)}
              disabled={categoryTab === 'Parts'}
              className="brand-control h-10 rounded-xl border px-3 text-sm disabled:bg-slate-100"
            >
              <option value="All">{t('inventory.allBikeTypes')}</option>
              {driveTypeFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {driveTypeLabel(option, t)}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              value={minPriceFilter}
              onChange={(event) => onMinPriceFilterChange(event.target.value)}
              placeholder={t('inventory.minPrice')}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            />

            <input
              type="number"
              min="0"
              value={maxPriceFilter}
              onChange={(event) => onMaxPriceFilterChange(event.target.value)}
              placeholder={t('inventory.maxPrice')}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            />

            {visibleFilterAttributes.map((attribute) => (
              <select
                key={attribute.id}
                value={attributeFilters[attribute.id] ?? ''}
                onChange={(event) => onAttributeFilterChange(attribute.id, event.target.value)}
                className="brand-control h-10 rounded-xl border px-3 text-sm"
              >
                <option value="">{fieldNameLabel(attribute, locale)}: {t('common.any')}</option>
                {(attributeOptionsById[attribute.id] ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ))}

            <button
              type="button"
              onClick={onResetDetailedFilters}
              className="brand-control h-10 px-4 rounded-xl border text-sm font-semibold text-slate-700 hover:bg-cyan-50"
            >
              {t('inventory.clearFilters')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
```

Keep the JSX class names and labels exactly as shown, matching the current coordinator JSX.

## Task 3: Update Admin Inventory Coordinator

**Files:**
- Modify: `src/features/admin/admin-inventory-view.tsx`

- [ ] **Step 1: Import `InventoryFilters`**

Add:

```tsx
import { InventoryFilters } from '@/features/admin/inventory/components/inventory-filters';
```

near the other inventory component imports.

- [ ] **Step 2: Add category tab callback**

Add this callback near `resetDetailedFilters`:

```tsx
const changeCategoryTab = (tab: CategoryTab) => {
  setCategoryTab(tab);
  if (tab === 'Parts') {
    setBikeTypeFilter('All');
  }
  setAttributeFilters({});
};
```

This preserves the existing category tab behavior.

- [ ] **Step 3: Add attribute filter callback**

Add this callback near `resetDetailedFilters`:

```tsx
const changeAttributeFilter = (attributeId: string, value: string) => {
  setAttributeFilters((current) => ({
    ...current,
    [attributeId]: value,
  }));
};
```

This preserves the existing attribute select behavior.

- [ ] **Step 4: Replace the count and filter JSX**

Remove the current count cards and filter section from:

```tsx
<div className="grid grid-cols-3 gap-2 mb-4 sm:gap-3 sm:mb-5">
```

through the closing `</div>` of:

```tsx
<div className="mb-4 space-y-3">
```

Replace it with:

```tsx
<InventoryFilters
  counts={counts}
  categoryTab={categoryTab}
  onCategoryTabChange={changeCategoryTab}
  query={query}
  onQueryChange={setQuery}
  isDetailedFiltersOpen={isDetailedFiltersOpen}
  onToggleDetailedFilters={() => setIsDetailedFiltersOpen((current) => !current)}
  stockFilter={stockFilter}
  onStockFilterChange={setStockFilter}
  bikeTypeFilter={bikeTypeFilter}
  onBikeTypeFilterChange={setBikeTypeFilter}
  minPriceFilter={minPriceFilter}
  onMinPriceFilterChange={setMinPriceFilter}
  maxPriceFilter={maxPriceFilter}
  onMaxPriceFilterChange={setMaxPriceFilter}
  attributeFilters={attributeFilters}
  onAttributeFilterChange={changeAttributeFilter}
  visibleFilterAttributes={visibleFilterAttributes}
  attributeOptionsById={attributeOptionsById}
  driveTypeFilterOptions={driveTypeFilterOptions}
  onResetDetailedFilters={resetDetailedFilters}
/>
```

- [ ] **Step 5: Remove imports used only by extracted filter UI**

Remove these imports from `admin-inventory-view.tsx` if they are no longer used:

```tsx
ChevronDown
Search
SlidersHorizontal
type AttributeDTO
```

Keep these imports because the coordinator still uses them after this slice:

```tsx
categoryLabel
driveTypeLabel
fieldNameLabel
coreFieldOptions
loadFieldLayoutConfig
```

## Task 4: Verify Extraction

**Files:**
- Verify only

- [ ] **Step 1: Check changed files**

Run:

```powershell
git status --short --untracked-files=all
```

Expected changed files should include:

```text
 M docs/tests/verify-product-form-actions.mjs
 M src/features/admin/admin-inventory-view.tsx
?? docs/plans/2026-05-27-admin-inventory-safe-extraction.md
?? docs/plans/2026-05-29-admin-inventory-decomposition-roadmap.md
?? docs/plans/2026-05-29-admin-inventory-filters-extraction.md
?? docs/plans/2026-05-29-admin-inventory-product-form-extraction.md
?? src/features/admin/inventory/components/inventory-filters.tsx
```

The existing untracked inventory extraction files may also appear. No `.superpowers` files should appear.

- [ ] **Step 2: Run structure baseline**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
```

Expected:

```text
Structure baseline verification passed.
```

- [ ] **Step 3: Check whitespace**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

Git may print LF/CRLF warnings for existing files. That is acceptable if the command exits with code `0`.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected:

```text
✓ Compiled successfully
✓ Linting and checking validity of types
```

If build is slow in this environment, stop after structure and whitespace checks and ask the user to run `npm run build` manually.

## Manual Smoke Check

After automated verification passes, open admin inventory and confirm:

1. Active/reserved/sold count cards still show the same values.
2. Category tabs still switch between all, bicycle, and parts.
3. Choosing parts still resets bike type to all.
4. Category switching still clears attribute filters.
5. Search input still filters products.
6. Detailed filters button still opens and closes the filter panel.
7. Stock filter still works.
8. Bike type filter still works and is disabled for parts.
9. Min and max price filters still work.
10. Attribute filters still work.
11. Clear filters resets detailed filters.

## Approval Checkpoint

This plan is ready for review. Choose the next step:

```text
A. Implement this inventory filters extraction plan now.
B. Adjust the plan first.
C. Stop here.
```
