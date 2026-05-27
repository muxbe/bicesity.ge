# Public Shop Structure Refactor Spec

## Problem

The public shop pages work, but the main customer-facing files are doing too much:

- `src/app/page.tsx` is about 946 lines.
- `src/app/shop/[id]/page.tsx` is about 554 lines.
- The files mix data loading, filters, product cards, rent messaging, gallery UI, detail attribute mapping, messenger URL handling, and fallback image behavior.

This makes customer-facing changes harder because page files are carrying both route concerns and feature implementation details.

## Goal

Split the public shop and product detail pages into small feature files while keeping the visible UI and behavior exactly the same.

This is a structure refactor, not a redesign.

## Current Code Shape

Primary files:

- `src/app/page.tsx`
- `src/app/shop/[id]/page.tsx`

Existing nearby feature code:

- `src/features/shop/shop-bootstrap.ts`
- `src/features/catalog/dto/catalog-dto.ts`
- `src/features/catalog/components/price-display.tsx`

Current home page responsibilities:

- product/rent tab state
- shop bootstrap loading
- product filtering state
- detailed filter state
- active filter count
- visible attribute options
- product card image UI
- rent view UI
- messenger URL fallback and message building
- sanitized attribute values

Current product detail responsibilities:

- product lookup from bootstrap data
- settings loading for contact URL
- gallery state and image fallback handling
- detail attribute lookup and key spec mapping
- messenger message building
- product detail layout

## Target Structure

Create a dedicated public shop feature folder:

```txt
src/features/shop/public/
  shop-home-view.tsx
  product-detail-view.tsx
  constants.ts
  types.ts
  components/
    product-card.tsx
    product-card-image.tsx
    product-detail-gallery.tsx
    product-detail-header.tsx
    product-detail-specs.tsx
    product-grid.tsx
    rent-view.tsx
    shop-filter-panel.tsx
    shop-header.tsx
    shop-tabs.tsx
  hooks/
    use-shop-bootstrap.ts
    use-shop-filters.ts
    use-product-detail.ts
  utils/
    messenger.ts
    price.ts
    product-details.ts
    product-values.ts
```

Then reduce route files:

```txt
src/app/page.tsx
src/app/shop/[id]/page.tsx
```

to small wrappers that render the public shop feature views.

## Refactor Approach

Use careful extraction in layers.

Layer 1: Extract shared shop utilities.

- Move messenger URL fallback and message builders into `utils/messenger.ts`.
- Move price parsing into `utils/price.ts`.
- Move attribute value sanitizing and product detail lookup helpers into `utils/`.
- Keep page JSX in place during this layer.

Layer 2: Extract small visual components.

- Move image components first.
- Move shop tabs, filter panel, product card, product grid, and rent view.
- Move product gallery, product detail header, and product specs.
- Keep Tailwind classes and rendered text the same.

Layer 3: Extract hooks.

- `use-shop-bootstrap.ts` owns bootstrap loading, loading state, and error state.
- `use-shop-filters.ts` owns filter state and derived filtered products.
- `use-product-detail.ts` owns product/detail lookup and detail-page derived data.

Layer 4: Keep route pages as wrappers.

- `src/app/page.tsx` renders `ShopHomeView`.
- `src/app/shop/[id]/page.tsx` renders `ProductDetailView`.

## Non-Goals

- Do not change public layout, colors, spacing, labels, or button placement.
- Do not change product filtering behavior.
- Do not change rent messaging behavior.
- Do not change product detail gallery behavior.
- Do not change API routes.
- Do not change database schema, Supabase policies, or migrations.
- Do not refactor admin pages in this pass.

## Acceptance Criteria

- Public home route still renders the same visible UI.
- Product detail route still renders the same visible UI.
- Product filters return the same results as before.
- Rent message link behavior stays the same.
- Product detail messenger link behavior stays the same.
- Image fallback behavior stays the same.
- Route files become small wrappers.
- New code lives under `src/features/shop/public/`.
- `npm run build` passes.

## Verification

Run automated checks:

```powershell
npm run build
```

Run manual smoke checks:

```text
1. Open the public home page.
2. Switch products and rent views.
3. Search and filter products.
4. Open a bicycle detail page.
5. Open a part detail page.
6. Switch product gallery images.
7. Click the messenger/contact action.
8. Confirm visible layout matches the current UI.
```

