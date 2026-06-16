# Admin Inventory Decomposition Roadmap Spec

**Goal:** Reduce `src/features/admin/admin-inventory-view.tsx` from about 1,531 lines to a readable coordinator of about 500-700 lines without changing visible UI or behavior.

**Current State:** The first safe extraction moved inventory types, constants, pure utilities, tiny presentational components, and `ProductForm` into `src/features/admin/inventory/`. The remaining coordinator still mixes page state, derived filtering data, product list rendering, filters UI, bulk modal UI, reservation/sell modal UI, and action handlers.

**Target Architecture:** Keep `AdminInventoryView` as the coordinator. Move large UI-only sections into focused components that receive data and callbacks through props. Keep API calls and business action handlers in the coordinator until the UI is split cleanly.

---

## Hard Constraints

- Keep visible UI exactly the same.
- Do not change behavior.
- Do not change labels, classes, layout, colors, spacing, API routes, database code, Supabase policies, or migrations.
- Do not commit or push unless explicitly requested.
- Do not include or modify `.superpowers` files.
- Do not combine multiple extraction slices in one implementation without approval.
- Before each implementation slice, write or update a focused plan and ask for approval.

## Target File Shape

Final healthy target:

```text
src/features/admin/admin-inventory-view.tsx                         500-700 lines
src/features/admin/inventory/components/product-form.tsx            300-350 lines
src/features/admin/inventory/components/inventory-filters.tsx       250-350 lines
src/features/admin/inventory/components/bulk-action-modal.tsx       150-250 lines
src/features/admin/inventory/components/product-card.tsx            300-450 lines
src/features/admin/inventory/components/reservation-modal.tsx       150-250 lines
src/features/admin/inventory/components/sell-modal.tsx              100-180 lines
src/features/admin/inventory/components/status-badge.tsx            small
src/features/admin/inventory/components/product-image.tsx           small
src/features/admin/inventory/components/reservation-customer-summary.tsx small
src/features/admin/inventory/types.ts                               small
src/features/admin/inventory/constants.ts                           small
src/features/admin/inventory/utils/*                                small
```

`admin-inventory-view.tsx` should keep:

- page-level state
- data loading hooks
- derived data
- API action handlers
- modal open/close state
- callback wiring
- high-level page layout

It should not keep:

- full product form JSX
- full filter panel JSX
- full product card JSX
- full bulk modal JSX
- full reservation/sell modal JSX
- pure helpers already extracted to utils

## Recommended Slice Order

### Slice 1: Extract Inventory Filters

Create:

`src/features/admin/inventory/components/inventory-filters.tsx`

Move only the filter/search UI section from `AdminInventoryView`.

Keep in coordinator:

- filter state
- `visibleFilterAttributes`
- `attributeOptionsById`
- `driveTypeFilterOptions`
- `counts`
- `resetDetailedFilters`
- actual product filtering logic

Expected result:

- `admin-inventory-view.tsx`: about 1,531 lines -> about 1,200-1,300 lines
- Risk: low to medium
- Reason: Mostly controlled UI and props, no API ownership change

### Slice 2: Extract Bulk Action Modal

Create:

`src/features/admin/inventory/components/bulk-action-modal.tsx`

Move only the bulk modal JSX.

Keep in coordinator:

- selected product IDs
- bulk mode state
- reservation context state
- `submitBulkAction`
- `closeBulkModal`
- `renderReservationContextFields` until the reservation fields are extracted or moved carefully

Expected result:

- `admin-inventory-view.tsx`: about 1,200-1,300 lines -> about 1,050-1,150 lines
- Risk: medium
- Reason: The modal has many conditional states and action labels, but API logic can remain in coordinator

### Slice 3: Extract Product Card

Create:

`src/features/admin/inventory/components/product-card.tsx`

Move one product card's rendered JSX into a component.

Keep in coordinator:

- product list mapping
- action handlers
- working key state
- edit/reserve/sell/delete/restore callbacks
- selection state

Pass callbacks and status booleans as props.

Expected result:

- `admin-inventory-view.tsx`: about 1,050-1,150 lines -> about 650-850 lines
- Risk: medium to high
- Reason: This has the biggest payoff but touches many callbacks and conditional action buttons

### Slice 4: Extract Reservation Modal

Create:

`src/features/admin/inventory/components/reservation-modal.tsx`

Move only the single-product reservation modal JSX and reservation context fields needed by that modal.

Keep in coordinator:

- `reserveProductId`
- `reserveAtLocal`
- `reservationContext`
- `submitReserve`
- `closeReserveDraft`
- `preventImplicitReservationSubmit`

Expected result:

- `admin-inventory-view.tsx`: about 650-850 lines -> about 550-750 lines
- Risk: medium
- Reason: Reservation form has keyboard behavior and context fields that must remain exact

### Slice 5: Extract Sell Modal

Create:

`src/features/admin/inventory/components/sell-modal.tsx`

Move only the sell modal JSX.

Keep in coordinator:

- `sellProductId`
- `sellPrice`
- `sellChannel`
- `submitSell`

Expected result:

- `admin-inventory-view.tsx`: about 550-750 lines -> about 500-700 lines
- Risk: low to medium
- Reason: Smaller modal with simpler state than reservation or bulk actions

## Optional Later Step: Extract Action Hooks

Do not do this until the UI is split.

Possible later files:

```text
src/features/admin/inventory/hooks/use-inventory-actions.ts
src/features/admin/inventory/hooks/use-bulk-inventory-actions.ts
```

This may make the coordinator even smaller, but it is riskier because it moves API behavior. Only consider it after all UI extractions are verified.

## Verification Required After Every Slice

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
git diff --check
npm run build
```

If `npm run build` is too slow in the environment, stop after structure and whitespace checks and ask the user to run the build manually.

Manual smoke check after every slice:

1. Admin inventory loads.
2. Product images still show.
3. Status badges still show.
4. Filters still produce the same visible products.
5. Create/edit product forms still open and save.
6. Reservation modal still opens and submits.
7. Sell modal still opens and submits.
8. Bulk actions still open, submit, and show the same labels.
9. Product card buttons appear in the same places.

## Current Recommendation

Start with Slice 1: `inventory-filters.tsx`.

Reason:

- It removes a meaningful amount of JSX.
- It does not move API logic.
- It prepares the file for later product card extraction.
- It is safer than starting with product card because product card has many action callbacks.

## Approval Checkpoint

Choose the next step:

```text
A. Create the detailed Slice 1 filters extraction plan.
B. Adjust this roadmap/spec first.
C. Stop here.
```
