# Homepage Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/app/page.tsx` into focused homepage feature files while preserving its exact visuals, CSS classes, translations, API calls, authentication behavior, filtering behavior, hashes, and rental workflow.

**Architecture:** Keep the App Router page as a thin entry point and move homepage internals into `src/features/shop/home/`. Use `HomeView` as the explicit composition root, four independent hooks for catalog, filters, navigation, and rental messaging, and focused presentational components for navigation, filters, products, and rental content.

**Tech Stack:** Next.js 14 App Router, React 18 client components, TypeScript, existing auth/i18n/catalog/freshness modules, Node static verifier scripts, `npm run build`.

---

## Source Design

Implement the approved design:

```text
docs/superpowers/specs/2026-06-19-homepage-decomposition-design.md
```

This is a structural refactor only.

Do not change:

- Visible layout or CSS classes.
- Responsive behavior.
- Text or translation keys.
- `/api/shop/bootstrap`.
- Client-side bootstrap loading.
- Authentication redirects or logout.
- Draft/applied filter semantics.
- Product filtering order or matching rules.
- `#explore`, `#bicycles`, `#components`, or `#rent`.
- Messenger message construction or clipboard behavior.
- Product card links, labels, prices, attributes, or image fallback behavior.
- Supabase, migrations, Vercel settings, or environment variables.

## Resolved Design Detail

The current initial catalog error is rendered directly below the toolbar count at `src/app/page.tsx:816`. Keep it in that exact visual position by rendering it from `HomeFilterToolbar`.

`ProductGrid` owns loading, empty, and populated product states. It does not relocate the catalog error into the product section because that would violate the no-visual-change requirement.

## Target File Structure

Create:

```text
src/features/shop/home/home-view.tsx
src/features/shop/home/home-types.ts
src/features/shop/home/home-helpers.ts
src/features/shop/home/hooks/use-home-catalog.ts
src/features/shop/home/hooks/use-home-filters.ts
src/features/shop/home/hooks/use-home-navigation.ts
src/features/shop/home/hooks/use-rent-messenger.ts
src/features/shop/home/components/home-navigation.tsx
src/features/shop/home/components/home-filter-toolbar.tsx
src/features/shop/home/components/detailed-filter-panel.tsx
src/features/shop/home/components/product-grid.tsx
src/features/shop/home/components/product-card.tsx
src/features/shop/home/components/product-card-image.tsx
src/features/shop/home/components/rent-view.tsx
docs/tests/verify-homepage-decomposition.mjs
```

Modify:

```text
src/app/page.tsx
docs/tests/verify-max-file-lines.mjs
```

## Fixed Public Contracts

Use these names consistently across all tasks:

```ts
export type Translate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export type CategoryFilter = "All" | "Bicycle" | "Parts";
export type StockFilter = "All" | "In Stock" | "Out of Stock";
export type BikeTypeFilter = "All" | string;
export type HomeViewMode = "products" | "rent";

export type FilterState = {
  query: string;
  category: CategoryFilter;
  stock: StockFilter;
  bikeType: BikeTypeFilter;
  minPrice: string;
  maxPrice: string;
  attributeValues: Record<string, string>;
};
```

The type is named `HomeViewMode`, not `HomeView`, to avoid colliding with the `HomeView` component.

---

## Task 1: Add The Homepage Decomposition Verifier

**Files:**

- Create: `docs/tests/verify-homepage-decomposition.mjs`

- [ ] **Step 1: Create the failing static verifier**

Create `docs/tests/verify-homepage-decomposition.mjs`:

```js
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const componentFiles = [
  "src/features/shop/home/components/home-navigation.tsx",
  "src/features/shop/home/components/home-filter-toolbar.tsx",
  "src/features/shop/home/components/detailed-filter-panel.tsx",
  "src/features/shop/home/components/product-grid.tsx",
  "src/features/shop/home/components/product-card.tsx",
  "src/features/shop/home/components/product-card-image.tsx",
  "src/features/shop/home/components/rent-view.tsx",
];

const hookFiles = [
  "src/features/shop/home/hooks/use-home-catalog.ts",
  "src/features/shop/home/hooks/use-home-filters.ts",
  "src/features/shop/home/hooks/use-home-navigation.ts",
  "src/features/shop/home/hooks/use-rent-messenger.ts",
];

const supportFiles = [
  "src/features/shop/home/home-view.tsx",
  "src/features/shop/home/home-types.ts",
  "src/features/shop/home/home-helpers.ts",
];

const requiredFiles = [...componentFiles, ...hookFiles, ...supportFiles];

function absolute(relativePath) {
  return path.join(repoRoot, relativePath);
}

function read(relativePath) {
  return readFileSync(absolute(relativePath), "utf8");
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
}

function checkMaxLines(files, max, failures) {
  for (const file of files) {
    if (!existsSync(absolute(file))) {
      continue;
    }
    const count = lineCount(read(file));
    if (count > max) {
      failures.push(`${file}: ${count} lines exceeds ${max}.`);
    }
  }
}

const failures = [];
const missingFiles = requiredFiles.filter((file) => !existsSync(absolute(file)));

if (missingFiles.length > 0) {
  failures.push(
    `Missing homepage decomposition files:\n${missingFiles
      .map((file) => `- ${file}`)
      .join("\n")}`
  );
}

const pagePath = "src/app/page.tsx";
if (!existsSync(absolute(pagePath))) {
  failures.push("Missing public homepage route.");
} else {
  const page = read(pagePath);
  if (!page.includes("HomeView")) {
    failures.push("Public homepage route must render HomeView.");
  }
  if (lineCount(page) > 20) {
    failures.push(`Public homepage route must be at most 20 lines.`);
  }
}

if (missingFiles.length === 0) {
  const view = read("src/features/shop/home/home-view.tsx");
  const catalog = read("src/features/shop/home/hooks/use-home-catalog.ts");
  const filters = read("src/features/shop/home/hooks/use-home-filters.ts");
  const navigation = read("src/features/shop/home/hooks/use-home-navigation.ts");
  const messenger = read("src/features/shop/home/hooks/use-rent-messenger.ts");
  const image = read("src/features/shop/home/components/product-card-image.tsx");
  const helpers = read("src/features/shop/home/home-helpers.ts");

  for (const hookName of [
    "useHomeCatalog",
    "useHomeFilters",
    "useHomeNavigation",
    "useRentMessenger",
  ]) {
    if (!view.includes(hookName)) {
      failures.push(`HomeView must use ${hookName}.`);
    }
  }

  for (const componentName of [
    "HomeNavigation",
    "HomeFilterToolbar",
    "DetailedFilterPanel",
    "ProductGrid",
    "RentView",
  ]) {
    if (!view.includes(componentName)) {
      failures.push(`HomeView must render ${componentName}.`);
    }
  }

  if (!catalog.includes("fetch('/api/shop/bootstrap'") &&
      !catalog.includes('fetch("/api/shop/bootstrap"')) {
    failures.push("Catalog hook must keep /api/shop/bootstrap loading.");
  }
  if (!catalog.includes("CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL")) {
    failures.push("Catalog hook must keep catalog freshness.");
  }
  if (!filters.includes("draftFilters") || !filters.includes("appliedFilters")) {
    failures.push("Filter hook must keep separate draft and applied filters.");
  }
  if (!filters.includes("sanitizeAttributeValues")) {
    failures.push("Filter hook must sanitize category attribute values.");
  }
  for (const hash of ["#rent", "#bicycles", "#components"]) {
    if (!navigation.includes(hash)) {
      failures.push(`Navigation hook must keep ${hash}.`);
    }
  }
  if (!messenger.includes("buildRentMessage") || !messenger.includes("buildMessengerUrl")) {
    failures.push("Rental hook must keep Messenger message and URL behavior.");
  }
  if (!image.includes("getFallbackImage") || !image.includes("onError")) {
    failures.push("ProductCardImage must keep category fallback behavior.");
  }
  for (const helperName of [
    "parsePrice",
    "buildMessengerUrl",
    "buildRentMessage",
    "sanitizeAttributeValues",
    "filterProducts",
    "countActiveFilters",
  ]) {
    if (!helpers.includes(`export function ${helperName}`)) {
      failures.push(`Homepage helpers must export ${helperName}.`);
    }
  }
}

checkMaxLines(
  [...componentFiles, "src/features/shop/home/home-view.tsx"],
  300,
  failures
);
checkMaxLines(hookFiles, 350, failures);
checkMaxLines(
  [
    "src/features/shop/home/home-types.ts",
    "src/features/shop/home/home-helpers.ts",
  ],
  200,
  failures
);

for (const hookFile of hookFiles) {
  if (!existsSync(absolute(hookFile))) {
    continue;
  }
  const source = read(hookFile);
  for (const otherHook of hookFiles) {
    if (hookFile === otherHook) {
      continue;
    }
    const basename = path.basename(otherHook, path.extname(otherHook));
    if (source.includes(basename)) {
      failures.push(`${hookFile} must not import or call ${basename}.`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log("Homepage decomposition static checks passed.");
```

- [ ] **Step 2: Run the verifier and confirm RED**

Run:

```powershell
node docs\tests\verify-homepage-decomposition.mjs
```

Expected: exit code `1`, missing target files, and the oversized route error.

- [ ] **Step 3: Commit the failing verifier**

```powershell
git add docs/tests/verify-homepage-decomposition.mjs
git commit -m "Add homepage decomposition verifier"
```

---

## Task 2: Extract Homepage Types And Pure Helpers

**Files:**

- Create: `src/features/shop/home/home-types.ts`
- Create: `src/features/shop/home/home-helpers.ts`
- Modify: `src/app/page.tsx:35-144`

- [ ] **Step 1: Create homepage types**

Create `src/features/shop/home/home-types.ts`:

```ts
import type { AttributeDTO, ProductDTO } from "@/features/catalog";
import type { ShopBootstrapDTO } from "@/features/shop/shop-bootstrap";

export type Translate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export type CategoryFilter = "All" | "Bicycle" | "Parts";
export type StockFilter = "All" | "In Stock" | "Out of Stock";
export type BikeTypeFilter = "All" | string;
export type HomeViewMode = "products" | "rent";

export type FilterState = {
  query: string;
  category: CategoryFilter;
  stock: StockFilter;
  bikeType: BikeTypeFilter;
  minPrice: string;
  maxPrice: string;
  attributeValues: Record<string, string>;
};

export const INITIAL_FILTERS: FilterState = {
  query: "",
  category: "All",
  stock: "All",
  bikeType: "All",
  minPrice: "",
  maxPrice: "",
  attributeValues: {},
};

export type ShopBootstrapApiResponse = {
  data?: ShopBootstrapDTO;
  error?: string;
};

export type HomeCatalogResult = {
  products: ProductDTO[];
  attributes: AttributeDTO[];
  messengerUrl: string;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
};

export type HomeFiltersResult = {
  draftFilters: FilterState;
  appliedFilters: FilterState;
  isDetailedOpen: boolean;
  visibleAttributes: AttributeDTO[];
  detailedAttributeOptions: Record<string, string[]>;
  bikeTypeOptions: string[];
  filteredProducts: ProductDTO[];
  activeFilterCount: number;
  updateDraftFilters: (updates: Partial<FilterState>) => void;
  updateAttributeFilter: (attributeId: string, value: string) => void;
  handleCategoryChange: (value: CategoryFilter) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  selectCatalogCategory: (category: CategoryFilter) => void;
  toggleDetailedFilters: () => void;
  closeDetailedFilters: () => void;
};

export type HomeNavigationResult = {
  activeView: HomeViewMode;
  showCatalogCategory: (category: CategoryFilter, hash: string) => void;
  showRentView: () => void;
};

export type RentMessengerResult = {
  messengerError: string | null;
  messengerMessage: string | null;
  openMessengerForRent: () => Promise<void>;
  clearRentMessengerNotices: () => void;
};
```

- [ ] **Step 2: Create pure helpers**

Create `src/features/shop/home/home-helpers.ts`:

```ts
import { getCurrentPrice, type ProductDTO } from "@/features/catalog";
import type {
  CategoryFilter,
  FilterState,
  Translate,
} from "@/features/shop/home/home-types";

export function accountRoleLabel(
  role: string | null | undefined,
  t: Translate
) {
  if (role === "admin") {
    return t("role.admin");
  }
  if (role === "seller") {
    return t("role.seller");
  }
  return t("role.customer");
}

export function parsePrice(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function fallbackMessengerTargetUrl() {
  return (
    process.env.NEXT_PUBLIC_MESSENGER_TARGET_URL?.trim() ||
    process.env.NEXT_PUBLIC_MESSENGER_URL?.trim() ||
    ""
  );
}

export function buildMessengerUrl(targetUrl: string, message: string) {
  if (!targetUrl) {
    return null;
  }

  try {
    const url = new URL(targetUrl);
    url.searchParams.set("text", message);
    return url.toString();
  } catch {
    return null;
  }
}

export function buildRentMessage(rentUrl: string, t: Translate) {
  return [
    t("rent.requestLine1"),
    `Link: ${rentUrl}`,
    t("rent.requestLine3"),
  ].join("\n");
}

export function sanitizeAttributeValues(
  attributeValues: Record<string, string>,
  category: CategoryFilter,
  attributes: Array<{
    id: string;
    category: "Bicycle" | "Parts";
    isPublic: boolean;
  }>
) {
  const sanitized: Record<string, string> = {};
  for (const attribute of attributes) {
    if (!attribute.isPublic) {
      continue;
    }
    if (category !== "All" && attribute.category !== category) {
      continue;
    }
    const value = attributeValues[attribute.id];
    if (value) {
      sanitized[attribute.id] = value;
    }
  }
  return sanitized;
}

export function filterProducts(
  products: ProductDTO[],
  filters: FilterState
) {
  const minPrice = parsePrice(filters.minPrice);
  const maxPrice = parsePrice(filters.maxPrice);
  const normalizedQuery = filters.query.trim().toLowerCase();

  return products.filter((product) => {
    if (filters.category !== "All" && product.category !== filters.category) {
      return false;
    }

    if (normalizedQuery) {
      const searchableText = [
        product.name,
        product.description,
        product.serial,
        ...Object.values(product.values),
      ]
        .join(" ")
        .toLowerCase();
      if (!searchableText.includes(normalizedQuery)) {
        return false;
      }
    }

    if (filters.stock === "In Stock" && !product.inStock) {
      return false;
    }
    if (filters.stock === "Out of Stock" && product.inStock) {
      return false;
    }
    if (
      filters.bikeType !== "All" &&
      (product.category !== "Bicycle" || product.type !== filters.bikeType)
    ) {
      return false;
    }

    const currentPrice = getCurrentPrice(product);
    if (minPrice !== null && currentPrice < minPrice) {
      return false;
    }
    if (maxPrice !== null && currentPrice > maxPrice) {
      return false;
    }

    for (const [attributeId, selectedValue] of Object.entries(
      filters.attributeValues
    )) {
      if (selectedValue && product.values[attributeId] !== selectedValue) {
        return false;
      }
    }

    return true;
  });
}

export function countActiveFilters(filters: FilterState) {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.category !== "All") count += 1;
  if (filters.stock !== "All") count += 1;
  if (filters.bikeType !== "All") count += 1;
  if (parsePrice(filters.minPrice) !== null) count += 1;
  if (parsePrice(filters.maxPrice) !== null) count += 1;
  count += Object.values(filters.attributeValues).filter(Boolean).length;
  return count;
}

```

- [ ] **Step 3: Replace local types and helpers in the route**

In `src/app/page.tsx`:

- Remove the local filter/view types, `INITIAL_FILTERS`, bootstrap response type, and pure helper functions.
- Keep `loadShopBootstrap` local until Task 8 and update it to use the imported `ShopBootstrapApiResponse`.
- Import the types and helpers from the new files.
- Keep all JSX and state behavior unchanged.

Use imports:

```ts
import type {
  BikeTypeFilter,
  CategoryFilter,
  FilterState,
  HomeViewMode,
  ShopBootstrapApiResponse,
  StockFilter,
} from "@/features/shop/home/home-types";
import {
  INITIAL_FILTERS,
} from "@/features/shop/home/home-types";
import {
  accountRoleLabel,
  buildMessengerUrl,
  buildRentMessage,
  countActiveFilters,
  fallbackMessengerTargetUrl,
  filterProducts,
  sanitizeAttributeValues,
} from "@/features/shop/home/home-helpers";
```

Replace only the filtered-product and active-filter-count `useMemo` bodies with `filterProducts` and `countActiveFilters`. Keep visible-attribute and option derivation in the route until Task 9. Rename the state type usage from `HomeView` to `HomeViewMode`.

- [ ] **Step 4: Verify this extraction**

```powershell
git diff --check
npm run build
```

Expected: both pass; rendered behavior remains unchanged.

- [ ] **Step 5: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/home-types.ts src/features/shop/home/home-helpers.ts
git commit -m "Extract homepage types and helpers"
```

---

## Task 3: Extract Product Image Fallback

**Files:**

- Create: `src/features/shop/home/components/product-card-image.tsx`
- Modify: `src/app/page.tsx:146-164`

- [ ] **Step 1: Create `ProductCardImage`**

Create `src/features/shop/home/components/product-card-image.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  getFallbackImage,
  type ProductDTO,
} from "@/features/catalog";

export type ProductCardImageProps = {
  product: ProductDTO;
};

export function ProductCardImage({ product }: ProductCardImageProps) {
  const fallback = getFallbackImage(product.category);
  const [imageSrc, setImageSrc] = useState(product.image || fallback);

  useEffect(() => {
    setImageSrc(product.image || fallback);
  }, [fallback, product.image]);

  return (
    <Image
      src={imageSrc}
      alt={product.name}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className="object-cover group-hover:scale-110 transition duration-500"
      onError={() => setImageSrc(fallback)}
    />
  );
}
```

- [ ] **Step 2: Replace the local component**

Remove the local `ProductCardImage` from `src/app/page.tsx` and import:

```ts
import { ProductCardImage } from "@/features/shop/home/components/product-card-image";
```

- [ ] **Step 3: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/components/product-card-image.tsx
git commit -m "Extract homepage product image"
```

---

## Task 4: Extract Product Card And Grid

**Files:**

- Create: `src/features/shop/home/components/product-card.tsx`
- Create: `src/features/shop/home/components/product-grid.tsx`
- Modify: `src/app/page.tsx:970-1040`

- [ ] **Step 1: Create `ProductCard`**

Use this exact prop contract:

```ts
export type ProductCardProps = {
  product: ProductDTO;
  attributes: AttributeDTO[];
  locale: string;
  t: Translate;
};
```

Create `ProductCard` by moving the exact card markup currently at `src/app/page.tsx:985-1036`.

Required imports:

```ts
import Link from "next/link";
import {
  buildPublicAttributes,
  type AttributeDTO,
  type ProductDTO,
} from "@/features/catalog";
import { PriceDisplay } from "@/features/catalog/components/price-display";
import { ProductCardImage } from "@/features/shop/home/components/product-card-image";
import type { Translate } from "@/features/shop/home/home-types";
import {
  categoryLabel,
  discountLabel,
  driveTypeLabel,
  fieldNameLabel,
  stockLabel,
} from "@/lib/i18n";
```

At the top of the component, calculate once:

```ts
const publicAttributes = buildPublicAttributes(product, attributes);
```

Use `publicAttributes` for the existing length check and first three badges. Do not change any markup or classes.

- [ ] **Step 2: Create `ProductGrid`**

Use this prop contract:

```ts
export type ProductGridProps = {
  isLoading: boolean;
  products: ProductDTO[];
  attributes: AttributeDTO[];
  locale: string;
  t: Translate;
};
```

Move the exact `<section id="explore">` markup from `src/app/page.tsx:970-1039`.

The three states remain:

1. Existing loading card.
2. Existing no-matching-products card.
3. Existing three-column product grid.

Map products to:

```tsx
<ProductCard
  key={product.id}
  product={product}
  attributes={attributes}
  locale={locale}
  t={t}
/>
```

- [ ] **Step 3: Replace the inline product section**

Replace the product branch with:

```tsx
<ProductGrid
  isLoading={isLoading}
  products={filteredProducts}
  attributes={attributes}
  locale={locale}
  t={t}
/>
```

- [ ] **Step 4: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/components/product-card.tsx src/features/shop/home/components/product-grid.tsx
git commit -m "Extract homepage product cards"
```

---

## Task 5: Extract Rental View

**Files:**

- Create: `src/features/shop/home/components/rent-view.tsx`
- Modify: `src/app/page.tsx:166-261`

- [ ] **Step 1: Move `RentView`**

Create `src/features/shop/home/components/rent-view.tsx`.

Start with:

```tsx
"use client";

import Image from "next/image";
import { Bike, MapPin, MessageCircle, Route } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type RentViewProps = {
  onBrowseBicycles: () => void;
  onMessageSeller: () => void;
  messengerError: string | null;
  messengerMessage: string | null;
};
```

Move the exact existing `RentView` implementation and all classes from `src/app/page.tsx:166-261`. Export it as:

```ts
export function RentView(props: RentViewProps) {
```

- [ ] **Step 2: Replace the local component**

Remove the local component and import:

```ts
import { RentView } from "@/features/shop/home/components/rent-view";
```

- [ ] **Step 3: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/components/rent-view.tsx
git commit -m "Extract homepage rental view"
```

---

## Task 6: Extract Filter Toolbar And Detailed Panel

**Files:**

- Create: `src/features/shop/home/components/home-filter-toolbar.tsx`
- Create: `src/features/shop/home/components/detailed-filter-panel.tsx`
- Modify: `src/app/page.tsx:738-820`
- Modify: `src/app/page.tsx:823-960`

- [ ] **Step 1: Create `HomeFilterToolbar`**

Use this prop contract:

```ts
export type HomeFilterToolbarProps = {
  draftFilters: FilterState;
  isDetailedOpen: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  activeFilterCount: number;
  productCount: number;
  t: Translate;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: CategoryFilter) => void;
  onStockChange: (value: StockFilter) => void;
  onToggleDetailed: () => void;
  onSearch: () => void;
};
```

Move the exact wrapper and form at `src/app/page.tsx:738-820`.

The component handles `FormEvent` locally:

```tsx
const handleSubmit = (event: FormEvent) => {
  event.preventDefault();
  onSearch();
};
```

Keep:

- Search input.
- Desktop category and stock selects.
- Detailed toggle and Chevron rotation.
- Desktop search button.
- Loading/product/filter count text.
- Refresh spinner.
- Error at its current position below the count.

Replace `isRefreshing || isAuthRefreshing` with the already-combined `isRefreshing` prop.

- [ ] **Step 2: Create `DetailedFilterPanel`**

Use this prop contract:

```ts
export type DetailedFilterPanelProps = {
  draftFilters: FilterState;
  visibleAttributes: AttributeDTO[];
  detailedAttributeOptions: Record<string, string[]>;
  bikeTypeOptions: string[];
  locale: string;
  t: Translate;
  onCategoryChange: (value: CategoryFilter) => void;
  onStockChange: (value: StockFilter) => void;
  onBikeTypeChange: (value: BikeTypeFilter) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onAttributeChange: (attributeId: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
};
```

Move the exact markup from `src/app/page.tsx:823-960`.

The component handles `FormEvent` locally and calls `onApply()`. Keep all labels, option ordering, classes, disabled behavior, placeholders, and buttons unchanged.

- [ ] **Step 3: Replace inline filter markup**

Replace the toolbar with:

```tsx
{activeView === "products" && (
  <HomeFilterToolbar
    draftFilters={draftFilters}
    isDetailedOpen={isDetailedOpen}
    isLoading={isLoading}
    isRefreshing={isRefreshing || isAuthRefreshing}
    error={error}
    activeFilterCount={activeFilterCount}
    productCount={filteredProducts.length}
    t={t}
    onQueryChange={(query) => updateDraftFilters({ query })}
    onCategoryChange={handleCategoryChange}
    onStockChange={(stock) => updateDraftFilters({ stock })}
    onToggleDetailed={() => setIsDetailedOpen((current) => !current)}
    onSearch={() => applyFilters(true)}
  />
)}
```

Replace the detailed panel with:

```tsx
{activeView === "products" && isDetailedOpen && (
  <DetailedFilterPanel
    draftFilters={draftFilters}
    visibleAttributes={visibleAttributes}
    detailedAttributeOptions={detailedAttributeOptions}
    bikeTypeOptions={bikeTypeOptions}
    locale={locale}
    t={t}
    onCategoryChange={handleCategoryChange}
    onStockChange={(stock) => updateDraftFilters({ stock })}
    onBikeTypeChange={(bikeType) => updateDraftFilters({ bikeType })}
    onMinPriceChange={(minPrice) => updateDraftFilters({ minPrice })}
    onMaxPriceChange={(maxPrice) => updateDraftFilters({ maxPrice })}
    onAttributeChange={(attributeId, value) =>
      setDraftFilters((current) => ({
        ...current,
        attributeValues: {
          ...current.attributeValues,
          [attributeId]: value,
        },
      }))
    }
    onApply={() => applyFilters(true)}
    onReset={() => {
      setDraftFilters(INITIAL_FILTERS);
      setAppliedFilters(INITIAL_FILTERS);
      setIsDetailedOpen(false);
    }}
    onClose={() => setIsDetailedOpen(false)}
  />
)}
```

- [ ] **Step 4: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/components/home-filter-toolbar.tsx src/features/shop/home/components/detailed-filter-panel.tsx
git commit -m "Extract homepage filters"
```

---

## Task 7: Extract Navigation Presentation

**Files:**

- Create: `src/features/shop/home/components/home-navigation.tsx`
- Modify: `src/app/page.tsx:623-737`

- [ ] **Step 1: Create `HomeNavigation`**

Use this prop contract:

```ts
export type HomeNavigationProps = {
  activeView: HomeViewMode;
  activeCategory: CategoryFilter;
  email: string;
  role: string | null;
  t: Translate;
  onExplore: () => void;
  onBicycles: () => void;
  onComponents: () => void;
  onRent: () => void;
  onLogout: () => void;
};
```

Required imports:

```ts
import Link from "next/link";
import { LogOut } from "lucide-react";
import { BikeCityLogo } from "@/components/bike-city-logo";
import { accountRoleLabel } from "@/features/shop/home/home-helpers";
import type {
  CategoryFilter,
  HomeViewMode,
  Translate,
} from "@/features/shop/home/home-types";
import { LanguageSwitcher } from "@/lib/i18n";
```

Move the content inside the current `<nav>` from `src/app/page.tsx:624-737`. Do not include the outer sticky `<nav>` because `HomeView` must place `HomeFilterToolbar` inside that same element after `HomeNavigation`.

Keep the existing desktop/mobile button class functions inside this component:

```ts
const navButtonClass = (isActive: boolean) => ...
const mobileNavButtonClass = (isActive: boolean) => ...
```

Replace `user?.email ?? t("common.account")` with the `email` prop. Keep role links, labels, classes, `aria-pressed`, and logout markup unchanged.

- [ ] **Step 2: Replace inline navigation**

Inside the existing outer `<nav>`, render:

```tsx
<HomeNavigation
  activeView={activeView}
  activeCategory={appliedFilters.category}
  email={user?.email ?? t("common.account")}
  role={role}
  t={t}
  onExplore={() => showCatalogCategory("All", "#explore")}
  onBicycles={() => showCatalogCategory("Bicycle", "#bicycles")}
  onComponents={() => showCatalogCategory("Parts", "#components")}
  onRent={showRentView}
  onLogout={() => void logout()}
/>
```

Leave `HomeFilterToolbar` immediately after it inside the sticky `<nav>`.

- [ ] **Step 3: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/components/home-navigation.tsx
git commit -m "Extract homepage navigation"
```

---

## Task 8: Extract Catalog Loading Hook

**Files:**

- Create: `src/features/shop/home/hooks/use-home-catalog.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `useHomeCatalog`**

Create `src/features/shop/home/hooks/use-home-catalog.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttributeDTO, ProductDTO } from "@/features/catalog";
import { CRITICAL_INVALIDATION_TAGS } from "@/features/shared/freshness/critical-field-registry";
import { useFocusFreshness } from "@/features/shared/freshness/use-focus-freshness";
import {
  fallbackMessengerTargetUrl,
} from "@/features/shop/home/home-helpers";
import type {
  HomeCatalogResult,
  ShopBootstrapApiResponse,
  Translate,
} from "@/features/shop/home/home-types";
import type { ShopBootstrapDTO } from "@/features/shop/shop-bootstrap";

async function loadShopBootstrap(): Promise<ShopBootstrapDTO> {
  const response = await fetch("/api/shop/bootstrap", { cache: "no-store" });
  const payload = (await response
    .json()
    .catch(() => null)) as ShopBootstrapApiResponse | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error ?? "Failed to load shop data.");
  }
  return payload.data;
}

export function useHomeCatalog(t: Translate): HomeCatalogResult {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [attributes, setAttributes] = useState<AttributeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messengerUrl, setMessengerUrl] = useState(
    fallbackMessengerTargetUrl()
  );
  const hasLoadedBootstrapRef = useRef(false);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const loadBootstrapData = useCallback(
    async (options: { background?: boolean } = {}) => {
      const shouldShowLoader =
        !options.background || !hasLoadedBootstrapRef.current;

      if (shouldShowLoader) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const nextData = await loadShopBootstrap();
        setProducts(nextData.products);
        setAttributes(nextData.attributes);
        setMessengerUrl(nextData.settings.messengerUrl.trim());
        hasLoadedBootstrapRef.current = true;
      } catch {
        if (hasLoadedBootstrapRef.current) {
          return;
        }
        setError(tRef.current("home.failedShopData"));
      } finally {
        if (shouldShowLoader) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  const freshness = useFocusFreshness({
    tags: [CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL],
    onRefresh: () => loadBootstrapData({ background: true }),
  });

  return {
    products,
    attributes,
    messengerUrl,
    isLoading,
    isRefreshing: freshness.isRefreshing,
    error,
  };
}
```

- [ ] **Step 2: Replace catalog state in the route**

Remove:

- Local bootstrap API type.
- Local `loadShopBootstrap`.
- Product/attribute/loading/error/Messenger state.
- `hasLoadedBootstrapRef`.
- `tRef`.
- Bootstrap effects and freshness hook.

Use:

```ts
const catalog = useHomeCatalog(t);
const {
  products,
  attributes,
  messengerUrl,
  isLoading,
  isRefreshing,
  error,
} = catalog;
```

- [ ] **Step 3: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/hooks/use-home-catalog.ts
git commit -m "Extract homepage catalog hook"
```

---

## Task 9: Extract Filter Hook

**Files:**

- Create: `src/features/shop/home/hooks/use-home-filters.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `useHomeFilters`**

Create `src/features/shop/home/hooks/use-home-filters.ts`:

```ts
"use client";

import { useCallback, useMemo, useState } from "react";
import type { AttributeDTO, ProductDTO } from "@/features/catalog";
import {
  countActiveFilters,
  filterProducts,
  sanitizeAttributeValues,
} from "@/features/shop/home/home-helpers";
import {
  INITIAL_FILTERS,
  type CategoryFilter,
  type FilterState,
  type HomeFiltersResult,
} from "@/features/shop/home/home-types";

export function useHomeFilters(
  products: ProductDTO[],
  attributes: AttributeDTO[]
): HomeFiltersResult {
  const [draftFilters, setDraftFilters] =
    useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(INITIAL_FILTERS);
  const [isDetailedOpen, setIsDetailedOpen] = useState(false);

  const visibleAttributes = useMemo(
    () =>
      attributes.filter(
        (attribute) =>
          attribute.isPublic &&
          (draftFilters.category === "All" ||
            attribute.category === draftFilters.category)
      ),
    [attributes, draftFilters.category]
  );
  const detailedAttributeOptions = useMemo(() => {
    const scopedProducts = products.filter(
      (product) =>
        draftFilters.category === "All" ||
        product.category === draftFilters.category
    );
    const options: Record<string, string[]> = {};

    for (const attribute of visibleAttributes) {
      if (
        attribute.inputMode === "single_select" &&
        attribute.options.length > 0
      ) {
        options[attribute.id] = attribute.options.map(
          (option) => option.value
        );
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
  }, [draftFilters.category, products, visibleAttributes]);
  const bikeTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((product) => product.category === "Bicycle")
            .map((product) => product.type)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );
  const filteredProducts = useMemo(
    () => filterProducts(products, appliedFilters),
    [appliedFilters, products]
  );
  const activeFilterCount = useMemo(
    () => countActiveFilters(appliedFilters),
    [appliedFilters]
  );

  const updateDraftFilters = useCallback(
    (updates: Partial<FilterState>) => {
      setDraftFilters((current) => ({ ...current, ...updates }));
    },
    []
  );

  const updateAttributeFilter = useCallback(
    (attributeId: string, value: string) => {
      setDraftFilters((current) => ({
        ...current,
        attributeValues: {
          ...current.attributeValues,
          [attributeId]: value,
        },
      }));
    },
    []
  );

  const handleCategoryChange = useCallback(
    (value: CategoryFilter) => {
      setDraftFilters((current) => ({
        ...current,
        category: value,
        bikeType: value === "Parts" ? "All" : current.bikeType,
        attributeValues: sanitizeAttributeValues(
          current.attributeValues,
          value,
          attributes
        ),
      }));
    },
    [attributes]
  );

  const applyFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setIsDetailedOpen(false);
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    setDraftFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setIsDetailedOpen(false);
  }, []);

  const selectCatalogCategory = useCallback((category: CategoryFilter) => {
    const nextFilters: FilterState = { ...INITIAL_FILTERS, category };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setIsDetailedOpen(false);
  }, []);

  const toggleDetailedFilters = useCallback(() => {
    setIsDetailedOpen((current) => !current);
  }, []);

  const closeDetailedFilters = useCallback(() => {
    setIsDetailedOpen(false);
  }, []);

  return {
    draftFilters,
    appliedFilters,
    isDetailedOpen,
    visibleAttributes,
    detailedAttributeOptions,
    bikeTypeOptions,
    filteredProducts,
    activeFilterCount,
    updateDraftFilters,
    updateAttributeFilter,
    handleCategoryChange,
    applyFilters,
    resetFilters,
    selectCatalogCategory,
    toggleDetailedFilters,
    closeDetailedFilters,
  };
}
```

- [ ] **Step 2: Replace filter state and derivations**

Use:

```ts
const filters = useHomeFilters(products, attributes);
```

Wire toolbar and detailed panel directly to the returned values/actions. Remove all route-local filter state, memos, submit handlers, and category/reset helpers.

- [ ] **Step 3: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/hooks/use-home-filters.ts
git commit -m "Extract homepage filter hook"
```

---

## Task 10: Extract Rental Messenger Hook

**Files:**

- Create: `src/features/shop/home/hooks/use-rent-messenger.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `useRentMessenger`**

Create `src/features/shop/home/hooks/use-rent-messenger.ts`:

```ts
"use client";

import { useCallback, useState } from "react";
import {
  buildMessengerUrl,
  buildRentMessage,
} from "@/features/shop/home/home-helpers";
import type {
  RentMessengerResult,
  Translate,
} from "@/features/shop/home/home-types";

export function useRentMessenger(
  messengerUrl: string,
  t: Translate
): RentMessengerResult {
  const [messengerError, setMessengerError] = useState<string | null>(null);
  const [messengerMessage, setMessengerMessage] = useState<string | null>(null);

  const clearRentMessengerNotices = useCallback(() => {
    setMessengerError(null);
    setMessengerMessage(null);
  }, []);

  const openMessengerForRent = useCallback(async () => {
    clearRentMessengerNotices();

    const rentUrl =
      typeof window === "undefined"
        ? "/#rent"
        : `${window.location.origin}/#rent`;
    const message = buildRentMessage(rentUrl, t);
    const targetMessengerUrl = buildMessengerUrl(messengerUrl, message);

    if (!targetMessengerUrl) {
      setMessengerError(t("rent.messageLinkMissing"));
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      }
      const opened = window.open(
        targetMessengerUrl,
        "_blank",
        "noopener,noreferrer"
      );
      setMessengerMessage(
        opened ? t("rent.messageOpened") : t("rent.messageCopied")
      );
    } catch (caughtError) {
      setMessengerError(
        caughtError instanceof Error
          ? caughtError.message
          : t("rent.messageError")
      );
    }
  }, [clearRentMessengerNotices, messengerUrl, t]);

  return {
    messengerError,
    messengerMessage,
    openMessengerForRent,
    clearRentMessengerNotices,
  };
}
```

- [ ] **Step 2: Replace rental state and action**

Use:

```ts
const rentMessenger = useRentMessenger(messengerUrl, t);
```

Wire `RentView` and navigation callbacks to the returned values. Remove route-local rental notice state and `openMessengerForRent`.

- [ ] **Step 3: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/hooks/use-rent-messenger.ts
git commit -m "Extract homepage rental messenger hook"
```

---

## Task 11: Extract Hash Navigation Hook

**Files:**

- Create: `src/features/shop/home/hooks/use-home-navigation.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create navigation options type**

Add to `home-types.ts`:

```ts
export type UseHomeNavigationOptions = {
  canRenderShop: boolean;
  onHashCategory: (category: CategoryFilter) => void;
  onCloseDetailedFilters: () => void;
  onClearRentNotices: () => void;
};
```

- [ ] **Step 2: Create `useHomeNavigation`**

Create `src/features/shop/home/hooks/use-home-navigation.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CategoryFilter,
  HomeNavigationResult,
  HomeViewMode,
  UseHomeNavigationOptions,
} from "@/features/shop/home/home-types";

function scrollToHomeSection(sectionId: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.requestAnimationFrame(() => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function useHomeNavigation({
  canRenderShop,
  onHashCategory,
  onCloseDetailedFilters,
  onClearRentNotices,
}: UseHomeNavigationOptions): HomeNavigationResult {
  const [activeView, setActiveView] =
    useState<HomeViewMode>("products");

  useEffect(() => {
    if (!canRenderShop || typeof window === "undefined") {
      return;
    }

    const applyHashView = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#rent") {
        setActiveView("rent");
        onCloseDetailedFilters();
        return;
      }

      const category: CategoryFilter =
        hash === "#bicycles"
          ? "Bicycle"
          : hash === "#components"
            ? "Parts"
            : "All";
      setActiveView("products");
      onHashCategory(category);
      onCloseDetailedFilters();
    };

    applyHashView();
    window.addEventListener("hashchange", applyHashView);
    return () => {
      window.removeEventListener("hashchange", applyHashView);
    };
  }, [canRenderShop, onCloseDetailedFilters, onHashCategory]);

  const showCatalogCategory = useCallback(
    (category: CategoryFilter, hash: string) => {
      setActiveView("products");
      onHashCategory(category);
      onCloseDetailedFilters();
      onClearRentNotices();

      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", hash);
      }
      scrollToHomeSection("explore");
    },
    [
      onClearRentNotices,
      onCloseDetailedFilters,
      onHashCategory,
    ]
  );

  const showRentView = useCallback(() => {
    setActiveView("rent");
    onCloseDetailedFilters();
    onClearRentNotices();

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "#rent");
    }
    scrollToHomeSection("rent");
  }, [onClearRentNotices, onCloseDetailedFilters]);

  return {
    activeView,
    showCatalogCategory,
    showRentView,
  };
}
```

Important behavior:

- Hash changes reset category filters and close detailed filters.
- Hash changes do not clear rental notices because the current `hashchange` handler does not clear them.
- User navigation buttons do clear rental notices.

- [ ] **Step 3: Replace route-local navigation**

Use:

```ts
const navigation = useHomeNavigation({
  canRenderShop,
  onHashCategory: filters.selectCatalogCategory,
  onCloseDetailedFilters: filters.closeDetailedFilters,
  onClearRentNotices: rentMessenger.clearRentMessengerNotices,
});
```

Remove route-local `activeView`, hash effect, scrolling helper, category navigation, and rent navigation.

- [ ] **Step 4: Verify**

```powershell
git diff --check
npm run build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/home-types.ts src/features/shop/home/hooks/use-home-navigation.ts
git commit -m "Extract homepage navigation hook"
```

---

## Task 12: Create HomeView And Thin Route

**Files:**

- Create: `src/features/shop/home/home-view.tsx`
- Modify: `src/app/page.tsx`
- Modify: `docs/tests/verify-max-file-lines.mjs`

- [ ] **Step 1: Create `HomeView`**

Create `src/features/shop/home/home-view.tsx` with `"use client";`.

Required imports:

```ts
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { DetailedFilterPanel } from "@/features/shop/home/components/detailed-filter-panel";
import { HomeFilterToolbar } from "@/features/shop/home/components/home-filter-toolbar";
import { HomeNavigation } from "@/features/shop/home/components/home-navigation";
import { ProductGrid } from "@/features/shop/home/components/product-grid";
import { RentView } from "@/features/shop/home/components/rent-view";
import { useHomeCatalog } from "@/features/shop/home/hooks/use-home-catalog";
import { useHomeFilters } from "@/features/shop/home/hooks/use-home-filters";
import { useHomeNavigation } from "@/features/shop/home/hooks/use-home-navigation";
import { useRentMessenger } from "@/features/shop/home/hooks/use-rent-messenger";
import { useI18n } from "@/lib/i18n";
```

The component must:

1. Keep the current auth hook values.
2. Keep the unauthenticated redirect effect:

```ts
useEffect(() => {
  if (status === "unauthenticated") {
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }
}, [pathname, router, status]);
```

3. Create hooks in dependency order:

```ts
const catalog = useHomeCatalog(t);
const filters = useHomeFilters(catalog.products, catalog.attributes);
const rentMessenger = useRentMessenger(catalog.messengerUrl, t);
const navigation = useHomeNavigation({
  canRenderShop,
  onHashCategory: filters.selectCatalogCategory,
  onCloseDetailedFilters: filters.closeDetailedFilters,
  onClearRentNotices: rentMessenger.clearRentMessengerNotices,
});
```

4. Keep logout:

```ts
const logout = async () => {
  await signOut();
  router.replace("/login");
};
```

5. Keep the exact authentication loading screen and `return null` gate.
6. Render the same root wrapper and sticky `<nav>`.
7. Place `HomeNavigation` and `HomeFilterToolbar` inside the same sticky `<nav>`.
8. Render `DetailedFilterPanel` immediately after the sticky nav.
9. Render `RentView` or `ProductGrid` using the current branch order.

Use direct hook wiring:

```tsx
<HomeFilterToolbar
  draftFilters={filters.draftFilters}
  isDetailedOpen={filters.isDetailedOpen}
  isLoading={catalog.isLoading}
  isRefreshing={catalog.isRefreshing || isAuthRefreshing}
  error={catalog.error}
  activeFilterCount={filters.activeFilterCount}
  productCount={filters.filteredProducts.length}
  t={t}
  onQueryChange={(query) => filters.updateDraftFilters({ query })}
  onCategoryChange={filters.handleCategoryChange}
  onStockChange={(stock) => filters.updateDraftFilters({ stock })}
  onToggleDetailed={filters.toggleDetailedFilters}
  onSearch={filters.applyFilters}
/>
```

Wire the detailed panel, rent view, and product grid using the contracts from Tasks 4-6.

Use this composition shape:

```tsx
export function HomeView() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const {
    status,
    session,
    user,
    role,
    signOut,
    isBootstrapping,
    isRefreshing: isAuthRefreshing,
  } = useAuth();
  const canRenderShop = status === "authenticated" || Boolean(session);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  const catalog = useHomeCatalog(t);
  const filters = useHomeFilters(catalog.products, catalog.attributes);
  const rentMessenger = useRentMessenger(catalog.messengerUrl, t);
  const navigation = useHomeNavigation({
    canRenderShop,
    onHashCategory: filters.selectCatalogCategory,
    onCloseDetailedFilters: filters.closeDetailedFilters,
    onClearRentNotices: rentMessenger.clearRentMessengerNotices,
  });

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  if (isBootstrapping && !session) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-black text-slate-900 mb-2">
            {t("common.loadingRequired")}
          </h1>
          <p className="text-slate-600">
            {t("common.checkingCatalogAccess")}
          </p>
        </div>
      </main>
    );
  }

  if (!canRenderShop) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur-xl border-b border-slate-200">
        <HomeNavigation
          activeView={navigation.activeView}
          activeCategory={filters.appliedFilters.category}
          email={user?.email ?? t("common.account")}
          role={role}
          t={t}
          onExplore={() =>
            navigation.showCatalogCategory("All", "#explore")
          }
          onBicycles={() =>
            navigation.showCatalogCategory("Bicycle", "#bicycles")
          }
          onComponents={() =>
            navigation.showCatalogCategory("Parts", "#components")
          }
          onRent={navigation.showRentView}
          onLogout={() => void logout()}
        />

        {navigation.activeView === "products" && (
          <HomeFilterToolbar
            draftFilters={filters.draftFilters}
            isDetailedOpen={filters.isDetailedOpen}
            isLoading={catalog.isLoading}
            isRefreshing={catalog.isRefreshing || isAuthRefreshing}
            error={catalog.error}
            activeFilterCount={filters.activeFilterCount}
            productCount={filters.filteredProducts.length}
            t={t}
            onQueryChange={(query) =>
              filters.updateDraftFilters({ query })
            }
            onCategoryChange={filters.handleCategoryChange}
            onStockChange={(stock) =>
              filters.updateDraftFilters({ stock })
            }
            onToggleDetailed={filters.toggleDetailedFilters}
            onSearch={filters.applyFilters}
          />
        )}
      </nav>

      {navigation.activeView === "products" && filters.isDetailedOpen && (
        <DetailedFilterPanel
          draftFilters={filters.draftFilters}
          visibleAttributes={filters.visibleAttributes}
          detailedAttributeOptions={filters.detailedAttributeOptions}
          bikeTypeOptions={filters.bikeTypeOptions}
          locale={locale}
          t={t}
          onCategoryChange={filters.handleCategoryChange}
          onStockChange={(stock) => filters.updateDraftFilters({ stock })}
          onBikeTypeChange={(bikeType) =>
            filters.updateDraftFilters({ bikeType })
          }
          onMinPriceChange={(minPrice) =>
            filters.updateDraftFilters({ minPrice })
          }
          onMaxPriceChange={(maxPrice) =>
            filters.updateDraftFilters({ maxPrice })
          }
          onAttributeChange={filters.updateAttributeFilter}
          onApply={filters.applyFilters}
          onReset={filters.resetFilters}
          onClose={filters.closeDetailedFilters}
        />
      )}

      {navigation.activeView === "rent" ? (
        <RentView
          onBrowseBicycles={() =>
            navigation.showCatalogCategory("Bicycle", "#bicycles")
          }
          onMessageSeller={() =>
            void rentMessenger.openMessengerForRent()
          }
          messengerError={rentMessenger.messengerError}
          messengerMessage={rentMessenger.messengerMessage}
        />
      ) : (
        <ProductGrid
          isLoading={catalog.isLoading}
          products={filters.filteredProducts}
          attributes={catalog.attributes}
          locale={locale}
          t={t}
        />
      )}
    </div>
  );
}
```
- [ ] **Step 2: Replace the route**

Replace `src/app/page.tsx` with:

```tsx
import { HomeView } from "@/features/shop/home/home-view";

export default function HomePage() {
  return <HomeView />;
}
```

- [ ] **Step 3: Update the general max-line verifier**

In `docs/tests/verify-max-file-lines.mjs`:

- Remove the legacy `src/app/page.tsx` tracked-file allowance.
- Add:

```js
{ dir: "src/features/shop/home/components", max: 300 },
{ dir: "src/features/shop/home/hooks", max: 350 },
```

The homepage-specific verifier remains responsible for the 200-line helper/type limits and 20-line route limit.

- [ ] **Step 4: Run the homepage verifier**

```powershell
node docs\tests\verify-homepage-decomposition.mjs
```

Expected: `Homepage decomposition static checks passed.`

- [ ] **Step 5: Run all structural checks and build**

```powershell
node docs\tests\verify-homepage-decomposition.mjs
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
git diff --check
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add src/app/page.tsx src/features/shop/home/home-view.tsx docs/tests/verify-max-file-lines.mjs
git commit -m "Extract homepage view"
```

---

## Task 13: Browser Smoke Verification

**Files:**

- No source changes expected.

- [ ] **Step 1: Start the development server**

```powershell
npm run dev
```

Expected: Next.js starts on the available localhost port.

- [ ] **Step 2: Verify authentication**

Check:

- Authentication loading view still appears while bootstrapping.
- Unauthenticated access redirects to `/login?next=%2F`.
- Authenticated access renders the shop.
- Logout signs out and redirects to `/login`.

- [ ] **Step 3: Verify desktop at 1440px**

Check:

- Navigation layout matches the pre-refactor page.
- Explore, Bicycles, Components, and Rent buttons work.
- Account email, role, language switcher, staff link, and logout remain aligned.
- Toolbar remains inside the sticky navigation.
- Detailed panel opens below navigation.
- Product grid remains one, two, and three columns at the existing breakpoints.

- [ ] **Step 4: Verify mobile at 390px**

Check:

- Header controls fit without horizontal page overflow.
- Mobile nav remains horizontally scrollable.
- Search and Detailed controls retain their current grid.
- Detailed filters remain one column.
- Product images and cards retain their current sizes.
- Rental actions stack vertically.

- [ ] **Step 5: Verify filters**

Check:

- Typing does not affect products until Search is submitted.
- Category, stock, bike type, min/max price, and dynamic attributes work.
- Selecting Parts disables and resets bicycle type.
- Category changes remove incompatible attribute selections.
- Clear All resets draft and applied filters and closes the panel.
- Filter count and product count remain correct.

- [ ] **Step 6: Verify hashes and rental behavior**

Check:

- `/#bicycles` opens Bicycle products.
- `/#components` opens Parts.
- `/#rent` opens Rent.
- Browser hash changes update the view.
- Message Seller copies the same message and opens the configured URL.
- Missing/invalid Messenger URL shows the existing error.
- Browse Bicycles returns to Bicycle products.

- [ ] **Step 7: Verify product states**

Check:

- Initial loading card.
- Initial bootstrap error remains below toolbar counts.
- Empty-result card.
- Populated cards.
- Product links.
- Product image fallback.
- Prices, discount labels, dynamic attributes, drive type, and stock badges.
- No new browser console errors.

- [ ] **Step 8: Stop the development server**

Stop the process started in Step 1.

---

## Task 14: Final Verification

**Files:**

- No source changes expected unless verification exposes a defect.

- [ ] **Step 1: Run the complete verification suite**

```powershell
node docs\tests\verify-homepage-decomposition.mjs
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
git diff --check
npm run build
```

Expected: every command exits `0`.

- [ ] **Step 2: Check target line counts**

```powershell
$targets = @(
  "src/app/page.tsx",
  "src/features/shop/home/home-view.tsx",
  "src/features/shop/home/home-types.ts",
  "src/features/shop/home/home-helpers.ts"
)
$targets += Get-ChildItem "src/features/shop/home/components" -File |
  ForEach-Object FullName
$targets += Get-ChildItem "src/features/shop/home/hooks" -File |
  ForEach-Object FullName
$rows = foreach ($target in $targets) {
  $resolved = Resolve-Path -LiteralPath $target
  [pscustomobject]@{
    Lines = (Get-Content -LiteralPath $resolved).Count
    File = $resolved.Path.Replace((Get-Location).Path + "\", "")
  }
}
$rows | Sort-Object Lines -Descending | Format-Table -AutoSize
```

Expected:

- `src/app/page.tsx` is at most 20 lines.
- `home-view.tsx` and components are at most 300 lines.
- Hooks are at most 350 lines.
- `home-types.ts` and `home-helpers.ts` are at most 200 lines.

- [ ] **Step 3: Check the largest remaining routes**

```powershell
Get-ChildItem -Path src\app -Recurse -Filter page.tsx |
  ForEach-Object {
    [pscustomobject]@{
      Lines = (Get-Content -LiteralPath $_.FullName).Count
      File = $_.FullName.Replace((Get-Location).Path + "\", "")
    }
  } |
  Sort-Object Lines -Descending |
  Select-Object -First 10 |
  Format-Table -AutoSize
```

Expected: `src/app/shop/[id]/page.tsx` becomes the largest remaining route page.

- [ ] **Step 4: Confirm repository state**

```powershell
git status --short --branch
git log -14 --oneline
```

Expected:

- Working tree is clean.
- Homepage decomposition commits are present.
- No deployment or push occurred unless separately requested.

## Implementation Notes

- Execute in an isolated worktree when implementation begins.
- Use the existing quote/style conventions in each moved block; do not run a broad formatter.
- Preserve JSX and classes exactly while moving components.
- Run `npm run build` after every extraction commit.
- Inspect `git diff --check` before every commit.
- Do not combine multiple tasks into one commit.
- If unexpected files change, stop and ask the user before continuing.
- If a target file would exceed its hard line limit, split it by responsibility before committing.
- Do not push or deploy without an explicit user request.
