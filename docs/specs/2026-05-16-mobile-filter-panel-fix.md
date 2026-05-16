# Mobile Filter Panel Fix Spec

## Problem

On the user catalog page, the detailed filter panel opens inside the sticky header. On mobile this makes the expanded filters sit above the product list and feel like they are hiding the products. The panel also lacks a close action inside the opened area, so users have to return to the top filter button or submit/clear the form to collapse it.

## Goal

Make user-side detailed filters behave like normal page content on mobile: opening filters should push products down instead of covering them, and the open panel must include an obvious close action.

## Scope

- Keep the compact search/category/stock/filter row inside the sticky header.
- Move the expanded detailed filter panel outside the sticky nav in `src/app/page.tsx`.
- Add a visible close button inside the detailed filter panel.
- Make the basic search submit collapse detailed filters when they are open.
- Update the V3 docs preview so mobile catalog visuals show products first, with detailed filters represented as a closed action rather than an always-open block.
- Add a lightweight verifier for the source structure.

## Non-Goals

- Do not change product filtering logic.
- Do not change admin or seller filters.
- Do not redesign the full catalog page.
- Do not add new dependencies.

## Acceptance Criteria

- The detailed filter panel appears after the sticky `</nav>` in `src/app/page.tsx`.
- The detailed filter panel has a close button that calls `setIsDetailedOpen(false)`.
- Basic search collapses detailed filters.
- `docs/tests/verify-mobile-filter-panel.mjs` passes.
- `docs/v3/verify-v3.mjs` passes.
- `npm run build` passes.
