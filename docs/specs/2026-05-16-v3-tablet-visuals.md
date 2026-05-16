# V3 Tablet Visuals Spec

## Problem

V3 has a PC-first docs preview, but tablet currently inherits a compressed desktop layout or a mobile-like shell. That makes public filters, product detail, and admin inventory feel accidental around 768-1024px.

## Goal

Add a tablet preview mode to `docs/v3/index.html` so public, product detail, rent, admin, seller, fields/settings/staff, reports, and auth pages can be reviewed as intentional tablet layouts before mobile implementation.

## Scope

- Add a Tablet viewport control next to PC mode in the V3 preview.
- Keep PC mode unchanged.
- Tablet mode uses an app-width canvas around 900px with a tablet label in page title bars.
- Public catalog uses a compact header, two-column filter toolbar, two-column detailed filters, and two-column product grid.
- Product detail stacks gallery over copy, keeps the compact price/action bar, uses 2x2 key specs, and keeps details in a dense two-column matrix.
- Admin and seller use a compact icon-rail sidebar with content beside it, matching the production tablet shell direction.
- Admin inventory filters use two-column controls and readable inventory rows.
- Reports, fields, settings, and auth views use tablet-friendly two-column or centered panels where useful.
- The Bike City palette, logo, and V3 control styling remain the visual foundation.

## Non-Goals

- Do not implement production tablet app code in this step.
- Do not generate bitmap UI mockups.
- Do not change Supabase, auth, inventory, reservation, or filter behavior.
- Do not remove the existing PC-first V3 preview.

## Acceptance Criteria

- `docs/v3/index.html` has a `data-viewport="tablet"` mode button.
- Tablet mode toggles a `viewport-tablet` class on the preview stage.
- Page title bars render `Tablet / ...` when Tablet mode is selected.
- The tablet CSS layer contains public, product detail, admin/seller, reports, fields, settings, rent, and auth tablet rules.
- `docs/v3/verify-v3.mjs` checks for the tablet mode snippets.
- Running `node docs/v3/verify-v3.mjs` passes.

## Rollback

Remove the Tablet mode button, tablet state, `.viewport-tablet` CSS block, and the tablet spec/plan docs. PC preview remains usable.
