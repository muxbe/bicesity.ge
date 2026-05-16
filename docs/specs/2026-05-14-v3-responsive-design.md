# V3 Responsive Design Preview Spec

## Problem

The current project has one standalone public shop prototype in `upload-form-preview.html`. The next design iteration needs a separate `v3` preview area where mobile, tablet, and desktop presentations can be compared without changing the existing prototype.

## Goal

Create a standalone `docs/v3` preview that starts with PC visuals first. The preview should show the full page where useful, let the user switch across the app's main pages, and use the existing catalog filter model from the current app before tablet and mobile work begins.

## Scope

- Add `docs/v3/index.html` as the preview entry.
- Make the default view PC-first.
- Include an "All pages" mode plus individual page buttons.
- Use the existing Bike City logo from `docs/v2/279399999_116543327705069_5323243531129900723_n.jpg`.
- Use the logo palette as the visual foundation, with blue/cyan as the primary color and navy/yellow as supporting brand colors.
- Use a stronger borderless active/selected state on dark admin and seller sidebars so the marked page is clearly visible on logo navy.
- Represent the app's current pages: public catalog, product detail, rent, admin inventory/reserved/sold/deleted/reports/fields/staff/settings, seller inventory/reserved, and auth pages.
- Use the existing public catalog filter model: search, category, stock, bike type, min/max price, and public attribute filters.
- Keep the detailed filters layout, but improve input and select visuals so controls look intentional and readable.
- Match the Fields Settings page to the current card-based UI: Bicycle/Parts tabs, search, visibility filter, count, core/custom badges, public/internal visibility, and edit/archive actions.
- Improve product detail specs with the approved A1 layout: a compact price/action bar, four key spec chips, and a dense two-column spec matrix.
- Use sample bicycle-shop products and keep inactive products hidden from public catalog results.
- Preserve the current project pattern of single-file HTML/CSS/JS prototypes.

## Non-Goals

- Do not replace `upload-form-preview.html`.
- Do not connect to Supabase or live product data.
- Do not create a framework application.
- Do not change reservation, sold, deleted, or seller-contact business behavior in the existing preview.

## User-Facing Behavior

- Opening `v3/index.html` shows a design preview tool.
- The user can switch between all pages and individual pages.
- The first design view is PC-focused.
- The main navigation and staff sidebars display the Bike City logo.
- Product cards, search, category filtering, stock filtering, bike-type filtering, price filtering, and public attribute filtering work inside the preview.
- Only `active` products render in the public shop preview.
- Product detail information stays always visible but uses the compact A1 key-strip and spec-matrix layout.
- Fields Settings visuals follow the current production page structure.

## Acceptance Criteria

- `docs/v3/index.html` exists and opens as a standalone HTML page.
- The page contains controls for PC-first viewing, all pages, and individual pages.
- The page contains the current app's public catalog filters: search, category, stock, bike type, min/max price, and public attributes.
- The page includes visual coverage for public, admin, seller, and auth pages.
- The page references the Bike City logo from `../v2/`.
- The fields page uses card-style field settings rather than a simple table.
- The product detail page uses the compact A1 key-strip and spec-matrix details layout.
- Admin and seller sidebar active states remain high contrast against the logo-navy sidebar without an added outline border.
- Detailed filter inputs/selects have polished borders, focus states, and select indicators without changing the layout.
- A local verification script can confirm the expected route structure.

## Rollback

Delete the `v3` folder and the related docs if the design direction is rejected. Existing project files remain untouched.
