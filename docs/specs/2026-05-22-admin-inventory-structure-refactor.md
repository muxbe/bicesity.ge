# Admin Inventory Structure Refactor Spec

## Problem

The admin inventory screen works, but its main file has grown too large:

- `src/features/admin/admin-inventory-view.tsx` is about 1,974 lines.
- It contains route-facing view code, local state, filtering, selection, action handlers, product form UI, image UI, reservation UI, sell UI, bulk action UI, formatting helpers, and draft conversion helpers in one file.
- This makes small fixes risky because UI, business actions, and helper code are mixed together.
- Future layout work will become harder if this file keeps growing.

The same general issue exists elsewhere, but admin inventory is the first cleanup target because it is the largest and most important seller/admin workflow.

## Goal

Split admin inventory into small, focused files while keeping the visible UI and behavior exactly the same.

This is a structure refactor, not a redesign.

## Current Code Shape

Primary file:

- `src/features/admin/admin-inventory-view.tsx`

Current responsibilities inside that file:

- inventory page header and status summary
- category, search, stock, price, bike type, and attribute filters
- visible product filtering
- selected product tracking
- create and edit product form state
- image preview and upload controls
- reserve modal state
- seller/customer reservation context fields
- sell modal state
- bulk action state
- product card UI
- product status badge UI
- product image fallback handling
- API action handling and error display
- helper functions for money, stock, date input, drafts, and copy keys

## Target Structure

Create a dedicated admin inventory feature folder:

```txt
src/features/admin/inventory/
  admin-inventory-view.tsx
  constants.ts
  types.ts
  components/
    bulk-action-modal.tsx
    bulk-actions-bar.tsx
    inventory-counts.tsx
    inventory-filters.tsx
    inventory-header.tsx
    product-card.tsx
    product-form.tsx
    product-image.tsx
    reservation-customer-summary.tsx
    reservation-modal.tsx
    sell-modal.tsx
    status-badge.tsx
  hooks/
    use-inventory-actions.ts
    use-inventory-filters.ts
    use-inventory-selection.ts
  utils/
    api-errors.ts
    inventory-copy.ts
    money.ts
    product-draft.ts
```

Keep this compatibility file:

```txt
src/features/admin/admin-inventory-view.tsx
```

It should become a small re-export or wrapper so existing route imports continue to work.

## Refactor Approach

Use careful extraction in layers.

Layer 1: Extract types, constants, and pure utilities.

- Move draft types, bulk result types, category/filter types, and role props into `types.ts`.
- Move empty draft values and reservation constants into `constants.ts`.
- Move money parsing, stock parsing, date formatting, API error parsing, copy key selection, and draft conversion helpers into `utils/`.
- No JSX behavior changes in this layer.

Layer 2: Extract small presentational components.

- Move `StatusBadge`, `ProductImage`, and `ReservationCustomerSummary` first.
- Then move header, counts, filters, bulk action bar, product card, and modal components.
- Components should receive explicit props instead of importing page state directly.
- Tailwind classes and rendered text should stay the same.

Layer 3: Extract focused hooks after component boundaries are stable.

- `use-inventory-filters.ts` owns filter state and derived visible products.
- `use-inventory-selection.ts` owns selected product ids, select visible, and selection counts.
- `use-inventory-actions.ts` owns the shared action runner and reusable API-facing action helpers that do not require JSX state from a modal.
- Keep hooks small enough that each one has a clear job.

Layer 4: Keep `AdminInventoryView` as the coordinator.

- It loads catalog and reservation data.
- It wires hooks and components together.
- It remains the place where role and `statusView` determine which actions are enabled.
- It should be much smaller than the current file.

## Non-Goals

- Do not change the visible admin UI.
- Do not redesign layout, colors, spacing, labels, or button placement.
- Do not change API routes.
- Do not change database schema, Supabase policies, or migrations.
- Do not change reservation, sale, delete, restore, or bulk action behavior.
- Do not refactor fields settings or public shop in this pass.
- Do not introduce a new state management library.

## Acceptance Criteria

- Existing admin inventory pages still render through the same route files.
- Product create/edit form looks and behaves the same.
- Reservation modal buttons remain visible and behavior stays the same.
- Sell modal behavior stays the same.
- Bulk reserve, cancel reservation, discount, remove discount, sell, delete, restore, and clear archived actions keep the same request behavior.
- The compatibility import from `src/features/admin/admin-inventory-view.tsx` still works.
- `src/features/admin/admin-inventory-view.tsx` is reduced to a small wrapper or re-export.
- The new `src/features/admin/inventory/` files are grouped by responsibility.
- No page route receives a large inline implementation.
- `npm run build` passes.

## Verification

Run automated checks:

```powershell
npm run build
```

Run manual smoke checks:

```text
1. Open active admin inventory.
2. Search and use detailed filters.
3. Create a product.
4. Edit a product.
5. Reserve a product.
6. Cancel a reservation from reserved view.
7. Sell a product.
8. Use at least one bulk action.
9. Confirm visible layout matches the current UI.
```

## Follow-Up Candidates

After this pass is complete and verified, apply the same pattern to:

- `src/app/admin/fields/page.tsx`
- `src/app/page.tsx`
- `src/app/api/catalog/catalog-service.ts`
