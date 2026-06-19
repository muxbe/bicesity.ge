# Homepage Decomposition Design

## Status

Approved for specification on June 19, 2026. Implementation remains blocked until this written design is reviewed and an implementation plan is separately approved.

## Goal

Decompose `src/app/page.tsx` into small, focused homepage feature files without changing the rendered interface or runtime behavior.

The current route file is 1,043 physical lines and combines:

- Authentication gating and logout.
- Catalog bootstrap loading and freshness refresh.
- Product and attribute state.
- Draft and applied filter state.
- Product filtering and filter-option derivation.
- Hash-based navigation.
- Rental Messenger behavior.
- Desktop and mobile navigation markup.
- Filter forms and detailed filter markup.
- Product cards and image fallback handling.
- Rental page markup.

The refactor will preserve all existing visuals, CSS classes, translations, routes, hashes, API calls, authentication behavior, filtering behavior, and user workflows.

## Scope

### In Scope

- Move homepage-only types and pure helpers into dedicated files.
- Split catalog loading, filters, navigation, and rental messaging into focused hooks.
- Split the homepage UI into focused presentational components.
- Replace `src/app/page.tsx` with a thin route wrapper.
- Add a static verifier that protects the new boundaries and file-size limits.
- Verify the existing homepage behavior on desktop and mobile.

### Out of Scope

- Visual redesign or CSS cleanup.
- Changes to labels, translations, icons, spacing, breakpoints, or animation.
- Server-side data loading.
- Changes to `/api/shop/bootstrap`.
- Changes to catalog, authentication, freshness, or repository behavior.
- New filters, sorting, pagination, caching, or search behavior.
- Changes to Messenger configuration or rental copy.
- Refactoring `src/app/shop/[id]/page.tsx` or any admin page.

## Considered Approaches

### 1. Focused Hooks And Components

Split state by responsibility and keep `HomeView` as the explicit coordinator.

Advantages:

- Each unit has one clear purpose.
- Data dependencies remain visible.
- Hooks and components stay within manageable size limits.
- Future catalog, filter, navigation, and rental changes can be isolated.

Trade-off:

- `HomeView` must wire several explicit props and callbacks.

This is the selected approach.

### 2. One Homepage Controller Hook

Move all state and actions into a single `useHomeController`.

Advantages:

- Fastest initial extraction.
- Simple top-level component consumption.

Disadvantages:

- Likely creates another 500-line or larger file.
- Catalog, filters, navigation, and rental behavior remain tightly coupled.
- Moves the original problem instead of solving it.

This approach is rejected.

### 3. Homepage Context Provider

Expose homepage state through React context.

Advantages:

- Less prop wiring.

Disadvantages:

- Hides dependencies between components.
- Adds unnecessary provider complexity for one route.
- Makes isolated component tests and reuse harder.

This approach is rejected.

## Target Structure

```text
src/app/page.tsx

src/features/shop/home/
  home-view.tsx
  home-types.ts
  home-helpers.ts

  hooks/
    use-home-catalog.ts
    use-home-filters.ts
    use-home-navigation.ts
    use-rent-messenger.ts

  components/
    home-navigation.tsx
    home-filter-toolbar.tsx
    detailed-filter-panel.tsx
    product-grid.tsx
    product-card.tsx
    product-card-image.tsx
    rent-view.tsx

docs/tests/
  verify-homepage-decomposition.mjs
```

## Architecture

### Thin Route

`src/app/page.tsx` will only import and render `HomeView`.

Target shape:

```tsx
import { HomeView } from "@/features/shop/home/home-view";

export default function HomePage() {
  return <HomeView />;
}
```

The route file must remain at or below 20 physical lines.

### Home View

`home-view.tsx` is the composition root for the homepage.

It will:

- Use the existing authentication and internationalization hooks.
- Preserve the unauthenticated redirect and authentication loading state.
- Create the catalog, filter, navigation, and rental Messenger hooks.
- Coordinate cross-domain actions explicitly.
- Pass state and callbacks into presentational components.
- Preserve the existing page-level section order and markup wrappers.

It will not:

- Fetch shop data directly.
- Implement product filtering.
- Parse prices or construct Messenger URLs.
- Own detailed filter calculations.
- Contain full product card, navigation, filter panel, or rental markup.

Authentication remains in `HomeView` because access gating, redirect, and logout are route-level responsibilities. Authentication state will be passed to `HomeNavigation` as display values and callbacks.

## Hook Ownership

### `use-home-catalog.ts`

Owns:

- `products`.
- `attributes`.
- Configured Messenger URL returned by the bootstrap endpoint.
- Initial loading state.
- Initial load error.
- Background freshness refresh.
- The loaded-data guard used to preserve current data when a background refresh fails.
- The translated error reference needed by the existing callback behavior.

Inputs:

- Translation function or translated load-error message.

Outputs:

- Products and attributes.
- Messenger URL.
- Loading, refreshing, and error state.

Behavioral constraints:

- Continue fetching `/api/shop/bootstrap` with `cache: "no-store"`.
- Continue using `CATALOG_CRITICAL` focus freshness.
- Initial failure shows the current translated error.
- Background refresh failure does not clear products or replace the page with an error.
- Existing loading and refresh presentation remains unchanged.

### `use-home-filters.ts`

Owns:

- Draft filters.
- Applied filters.
- Detailed filter panel open state.
- Visible public attributes.
- Detailed attribute options.
- Bicycle type options.
- Filtered products.
- Active filter count.
- Basic and detailed search submission.
- Category changes.
- Filter reset and category-selection actions required by navigation.

Inputs:

- Products.
- Attributes.

Outputs:

- All filter state needed by the toolbar and detailed panel.
- Derived products and option lists.
- Typed actions for changing, applying, resetting, and closing filters.

Behavioral constraints:

- Keep draft and applied filters separate.
- Search only changes displayed products after the current submit actions.
- Category changes sanitize incompatible attribute values.
- Selecting Parts resets bicycle type to All.
- Price values remain optional and invalid or negative values remain ignored.
- Filter order and matching semantics remain unchanged.

### `use-home-navigation.ts`

Owns:

- Active homepage view: products or rent.
- Reading and reacting to `#rent`, `#bicycles`, and `#components`.
- Updating the URL hash without adding history entries.
- Smooth scrolling to the existing section IDs.

Inputs:

- Whether the authenticated shop can render.
- Explicit callbacks for category selection and detailed-filter closing.
- Explicit callback for clearing rental notices.

Outputs:

- Active view.
- `showCatalogCategory`.
- `showRentView`.

Behavioral constraints:

- `#rent` opens the rental view.
- `#bicycles` opens products with only the Bicycle category active.
- `#components` opens products with only the Parts category active.
- Other or missing hashes open products with the initial All filters.
- Category navigation resets filters exactly as the current page does.
- Navigation continues using the existing section IDs and smooth-scroll behavior.

The navigation hook must not import or call the filter or rental hooks. `HomeView` supplies coordination callbacks so dependencies remain explicit.

### `use-rent-messenger.ts`

Owns:

- Rental Messenger success message.
- Rental Messenger error message.
- Rental message construction.
- Clipboard write.
- Opening the configured Messenger URL.
- Clearing previous rental notices.

Inputs:

- Configured Messenger URL.
- Translation function.

Outputs:

- Success and error messages.
- `openMessengerForRent`.
- `clearRentMessengerNotices`.

Behavioral constraints:

- Keep the current rental message text and rental URL.
- Preserve the current missing-link error.
- Preserve clipboard behavior.
- Preserve the current opened/copied success message distinction.
- Preserve the current caught-error fallback behavior.

## Shared Types And Helpers

### `home-types.ts`

Owns homepage-only types:

- `CategoryFilter`.
- `StockFilter`.
- `BikeTypeFilter`.
- `HomeView`.
- `FilterState`.
- `ShopBootstrapApiResponse`.
- Named hook return shapes.

It also owns the immutable initial filter value.

### `home-helpers.ts`

Owns pure, non-React logic:

- Account role label selection.
- Price parsing.
- Fallback Messenger target URL lookup.
- Messenger URL construction.
- Rental message construction.
- Attribute-value sanitization.
- Pure product filtering.
- Active-filter counting.

Helpers must not import React hooks or mutate input values.

The `/api/shop/bootstrap` request and response validation remain inside `use-home-catalog.ts` because they are catalog-loading responsibilities.

## Component Responsibilities

### `home-navigation.tsx`

Renders:

- Existing desktop navigation.
- Existing mobile navigation.
- Logo.
- Language switcher placement.
- Account role and user display.
- Logout control.

Receives:

- Active view.
- Current user and role display data.
- Existing navigation callbacks.
- Logout callback.
- Translation function or translated labels.

It does not own authentication or navigation state.

### `home-filter-toolbar.tsx`

Renders:

- Basic search form.
- Category selection.
- Detailed filter toggle.
- Product and active-filter counts.

It receives draft values, counts, and callbacks from `useHomeFilters`.

### `detailed-filter-panel.tsx`

Renders:

- Stock filter.
- Minimum and maximum price.
- Bicycle type.
- Public dynamic attributes.
- Detailed search action.

It receives all values, options, and callbacks. It does not calculate options or filter products.

### `product-grid.tsx`

Renders:

- Existing catalog loading state.
- Existing initial error state.
- Existing empty-result state.
- Existing product grid.

It maps products into `ProductCard` without implementing filter logic.

### `product-card.tsx`

Renders one product card with the existing:

- Link and card layout.
- Product name and description.
- Category, drive type, stock, and discount labels.
- Public attributes.
- Price display.
- CSS classes and responsive behavior.

It delegates image fallback state to `ProductCardImage`.

### `product-card-image.tsx`

Owns:

- Current image source state.
- Product image updates.
- Category fallback image.
- `next/image` error fallback.

The existing image classes, sizing hints, alt text, and hover behavior remain unchanged.

### `rent-view.tsx`

Renders:

- Existing rental hero and informational cards.
- Message Seller and Browse Bicycles actions.
- Existing Messenger success and error messages.

It receives callbacks and messages and does not construct URLs or access the clipboard.

## Explicit Coordination Rules

`HomeView` coordinates cross-domain behavior. Hooks do not import one another.

### Category Navigation

When a navigation control selects Bicycles or Components:

1. `useHomeNavigation` switches to the products view and updates the hash.
2. `HomeView` calls the filter hook's category-reset action.
3. Detailed filters close.
4. Rental notices clear.
5. The page scrolls to `#explore`.

### Rent Navigation

When Rent is selected:

1. `useHomeNavigation` switches to the rent view and updates the hash.
2. Detailed filters close through an explicit filter action.
3. Rental notices clear.
4. The page scrolls to `#rent`.

### Hash Changes

When the browser hash changes:

- The navigation hook interprets the hash.
- It invokes explicit coordination callbacks supplied by `HomeView`.
- The result must match the current initial-load and `hashchange` behavior.

### Catalog Refresh

When catalog data refreshes:

- Current filters remain unchanged.
- Derived filter options and filtered products recalculate from the new data.
- Existing products remain visible during background refresh.

## Error Handling

- Authentication bootstrapping keeps the current loading screen.
- Unauthenticated users keep the current redirect to `/login?next=<pathname>`.
- A failed initial bootstrap shows the same translated shop-data error.
- A failed background refresh keeps existing catalog data visible.
- Broken product images use the same category fallback.
- Invalid prices remain ignored rather than producing an error.
- Missing or invalid Messenger configuration shows the same rental error.
- Clipboard or window-opening errors use the existing caught-error behavior.
- No new error boundary, toast system, retry UI, or logging behavior is introduced.

## File-Size And Boundary Rules

- `src/app/page.tsx`: at most 20 physical lines.
- New UI components: at most 300 physical lines.
- New hooks: at most 350 physical lines.
- Types and pure-helper files: at most 200 physical lines.
- No single replacement file may absorb the majority of the original route logic.
- Presentational components must not fetch data.
- Hooks must not render JSX.
- Homepage hooks must not import one another.
- Cross-domain coordination belongs in `HomeView`.

If a component or hook exceeds its preferred limit during implementation, the implementation must pause and define an additional responsibility boundary rather than accepting another oversized file.

## Static Verification

Add `docs/tests/verify-homepage-decomposition.mjs`.

It must verify:

- Every target file exists.
- `src/app/page.tsx` imports and renders `HomeView`.
- `src/app/page.tsx` is at most 20 physical lines.
- `HomeView` uses all four focused hooks.
- `HomeView` renders the navigation, filter, product, and rental components.
- The catalog hook retains `/api/shop/bootstrap` and catalog freshness behavior.
- The filter hook retains draft/applied filters and category sanitization.
- The navigation hook retains the three supported hashes.
- The rental hook retains Messenger message and URL behavior.
- Product image fallback remains in `product-card-image.tsx`.
- UI components are at most 300 lines, hooks are at most 350 lines, and type/helper files are at most 200 lines.

The verifier supplements build and browser checks; it does not attempt to prove runtime behavior through string matching alone.

## Verification Strategy

### Automated

Run:

```powershell
node docs\tests\verify-homepage-decomposition.mjs
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
git diff --check
npm run build
```

### Browser Smoke Verification

Verify desktop and mobile widths:

- Authentication loading state renders.
- Unauthenticated redirect retains the `next` path.
- Desktop and mobile navigation match the existing layout.
- Bicycles, Components, and Rent controls update views and hashes.
- Browser hash changes restore the expected view and filters.
- Basic search preserves draft/applied semantics.
- Detailed filters open, apply, and close.
- Stock, price, bicycle type, and dynamic attributes filter correctly.
- Category changes remove incompatible dynamic attribute values.
- Loading, initial error, empty results, and populated grid states render.
- Product cards preserve images, fallback behavior, labels, prices, and links.
- Rental view preserves both actions and all messages.
- Logout still signs out and redirects to `/login`.
- No browser console errors are introduced.

## Implementation Sequence

The later implementation plan should use small, independently verifiable slices:

1. Add the failing static decomposition verifier.
2. Extract homepage types and pure helpers.
3. Extract product image, product card, and product grid.
4. Extract rental view.
5. Extract filter toolbar and detailed filter panel.
6. Extract navigation.
7. Extract catalog hook.
8. Extract filter hook.
9. Extract rental Messenger hook.
10. Extract navigation hook and wire explicit coordination.
11. Create `HomeView` and replace the route with a thin wrapper.
12. Run all automated and browser verification.

Each slice must preserve behavior and pass the production build before proceeding.

## Success Criteria

- The homepage looks and behaves exactly as before.
- `src/app/page.tsx` is a thin wrapper at or below 20 lines.
- Catalog, filters, navigation, and rental messaging have separate hook ownership.
- UI areas are separated into the approved presentational components.
- No new file recreates the original oversized-page problem.
- Existing API, authentication, freshness, translations, hashes, and CSS classes are unchanged.
- Static verifiers and `npm run build` pass.
- Desktop and mobile smoke verification passes without new console errors.

## Approval Gate

This design authorizes writing an implementation plan only after the user reviews the committed spec. It does not authorize source-code implementation.
