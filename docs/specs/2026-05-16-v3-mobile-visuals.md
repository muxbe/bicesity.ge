# V3 Mobile Visuals Spec

## Problem

The V3 docs preview now has PC and tablet modes, but it still needs a phone-first visual mode before production mobile work begins. Without a dedicated mobile preview, public filters, product details, and admin/seller pages are hard to judge at phone width.

## Goal

Add a `Mobile` viewport mode to `docs/v3/index.html` so every V3 page can be reviewed as a 390px phone layout inside the existing interactive docs preview.

## Scope

- Add a `Mobile` viewport button beside `PC first` and `Tablet`.
- Keep PC and Tablet modes unchanged.
- Render page title bars as `Mobile / ...` when mobile mode is active.
- Add a `viewport-mobile` class to the preview stage.
- Use a phone canvas around 390px wide.
- Public catalog uses compact header, one-column hero, stacked filters, and one-column product cards.
- Product detail uses image-first layout, compact thumbnails, two-column key specs, one-column detail specs, and stacked purchase action.
- Rent, auth, fields, settings, reports, admin, and seller pages use mobile-friendly single-column layouts.
- Admin and seller screens replace the desktop sidebar with a compact top navigation treatment inside the preview.

## Non-Goals

- Do not change production app routes or shared components in this step.
- Do not generate bitmap mockups, videos, Canva designs, or Figma files.
- Do not change filter behavior, inventory behavior, auth behavior, or data logic.
- Do not remove the existing PC and Tablet preview modes.

## Acceptance Criteria

- `docs/v3/index.html` includes `data-viewport="mobile"`.
- Mobile mode toggles `viewport-mobile` on the preview stage.
- `viewportLabel()` can return `Mobile`.
- Mobile CSS covers public, catalog filters, product detail, rent, admin/seller, reports, fields, settings, and auth views.
- `docs/v3/verify-v3.mjs` checks for the mobile mode snippets.
- Running `node docs/v3/verify-v3.mjs` passes.

## Rollback

Remove the Mobile button, mobile viewport label branch, `.viewport-mobile` CSS block, verifier snippets, and the mobile spec/plan docs. PC and Tablet preview modes remain usable.
