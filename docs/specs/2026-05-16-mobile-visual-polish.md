# Mobile Visual Polish Spec

## Problem

The mobile catalog page still spends too much vertical space before products. The closed state stacks search, category, stock, detailed filters, and search as full-width controls inside the sticky header. Language controls also take separate rows on user-facing pages, and admin/seller mobile screens can be tightened.

## Goal

Make the mobile experience compact before content: the user catalog should expose one search line plus a filter button, language controls should sit in header context, and admin/seller controls should be denser without losing functionality.

## Scope

- User catalog mobile header: logo, compact language, and logout in one row.
- User catalog mobile nav: shorter, always usable horizontal pills.
- User catalog closed filters: one line with search input and filters button.
- User catalog opened filters: category, stock, bike type, price, public attributes, search, clear, and close in the panel below the sticky header.
- Product detail: move language switcher into the nav row and remove the separate language row.
- Admin/seller layouts: use compact language switcher.
- Admin inventory: make mobile metrics and search/filter controls denser.
- V3 preview: update mobile catalog visuals to match the compact pattern.

## Non-Goals

- Do not change product filtering logic.
- Do not change auth, reservations, or API behavior.
- Do not create Canva, Figma, HyperFrames, or imagegen outputs in this implementation pass.
- Do not redesign desktop layouts.

## Acceptance Criteria

- User catalog mobile closed filter row uses search + filters only.
- Category and stock are not visible as stacked full-width controls in the mobile sticky header.
- User catalog detailed panel contains category and stock controls.
- User and product detail pages do not have a separate full language row.
- Admin/seller layouts use compact language switcher.
- V3 mobile preview hides stacked detailed rows and shows compact mobile filters.
- `node docs/tests/verify-mobile-visual-polish.mjs` passes.
- `node docs/tests/verify-mobile-filter-panel.mjs` passes.
- `node docs/v3/verify-v3.mjs` passes.
- `npm run build` passes.
