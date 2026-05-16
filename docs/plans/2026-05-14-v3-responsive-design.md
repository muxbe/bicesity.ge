# V3 Responsive Design Preview Implementation Plan

## Goal

Build a standalone PC-first `docs/v3/index.html` preview for reviewing all main Bicycle Shop pages before tablet and mobile work.

## Files

- Create `docs/specs/2026-05-14-v3-responsive-design.md` for scope and acceptance criteria.
- Create `docs/plans/2026-05-14-v3-responsive-design.md` for implementation steps.
- Create `v3/verify-v3.mjs` for structural verification.
- Create `v3/index.html` for the PC-first page visual preview.

## Steps

1. Add the spec and this plan.
2. Add `v3/verify-v3.mjs` before creating the route.
3. Run `node v3/verify-v3.mjs` and confirm it fails because `v3/index.html` is missing.
4. Create `v3/index.html` as a standalone page with HTML, CSS, and JS.
5. Include the existing public catalog filters: search, category, stock, bike type, min/max price, and public product attributes.
6. Include an all-pages view plus individual page selectors for public, admin, seller, and auth pages.
7. Add the Bike City logo and align the palette around logo blue/cyan, navy, and yellow.
8. Update Product Detail with the approved A1 compact layout: price/action bar, key spec strip, and two-column spec matrix.
9. Update Fields Settings to match the current card-based page structure.
10. Strengthen admin and seller sidebar active states against the logo-navy sidebar without an added outline border.
11. Polish detailed filter input/select visuals while preserving the current layout.
12. Run `node v3/verify-v3.mjs` again and confirm it passes.
13. Open or inspect the page for visual sanity in PC-first full-page mode.

## Testing Strategy

Use a lightweight Node verification script because this repo has no package manager or browser test framework for docs previews. The script checks that the preview exists and contains the required PC page controls, existing filter controls, and page coverage.

## Risks

- This is a prototype route with mock product data, not a live data integration.
- Remote Unsplash images may not load when offline, but the layout should remain usable because image containers have stable dimensions and background colors.
- The design preview does not change the existing production rules in `upload-form-preview.html`.
