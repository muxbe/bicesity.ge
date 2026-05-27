# Admin Support Pages Structure Refactor Spec

## Problem

Several admin pages are not as large as admin inventory, but they still keep full feature implementations inside route files:

- `src/app/admin/staff/page.tsx` is about 341 lines.
- `src/app/admin/reports/page.tsx` is about 310 lines.
- `src/app/admin/reservations/page.tsx` is about 240 lines.
- `src/app/admin/settings/page.tsx` is about 206 lines.

Each page is understandable today, but continuing to add UI and behavior directly in route files will recreate the same problem as admin inventory.

## Goal

Move admin support page implementations into focused feature folders while keeping the visible UI and behavior exactly the same.

This is a structure refactor, not a redesign.

## Current Code Shape

Primary files:

- `src/app/admin/staff/page.tsx`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/reservations/page.tsx`
- `src/app/admin/settings/page.tsx`

Current responsibilities:

- staff page owns staff profile loading, role updates, active status updates, invite/create state, API error parsing, and table UI
- reports page owns report date range state, comparison labels, formatting helpers, loading/error states, and report cards/table UI
- reservations page owns reservation formatting helpers, image UI, customer summary UI, comment editing integration, and reservation list UI
- settings page owns app settings form state, API save behavior, error parsing, and settings form UI

## Target Structure

Create focused admin feature folders:

```txt
src/features/admin/staff/
  staff-management-view.tsx
  components/
    staff-form.tsx
    staff-table.tsx
    staff-row.tsx
  hooks/
    use-staff-management.ts
  utils/
    staff-errors.ts

src/features/admin/reports/
  admin-reports-view.tsx
  components/
    report-date-controls.tsx
    report-summary-cards.tsx
    report-table.tsx
  hooks/
    use-admin-report-view.ts
  utils/
    report-formatters.ts

src/features/admin/reservations/
  admin-reservations-view.tsx
  components/
    reservation-card.tsx
    reservation-customer-summary.tsx
    reservation-image.tsx
    reservation-list.tsx
  utils/
    reservation-formatters.ts

src/features/admin/settings/
  admin-settings-view.tsx
  components/
    settings-form.tsx
  hooks/
    use-admin-settings.ts
  utils/
    settings-errors.ts
```

Then reduce route files to small wrappers that render the feature views.

## Refactor Approach

Use careful extraction in layers.

Layer 1: Extract pure helpers.

- Move error parsing helpers out of staff and settings pages.
- Move currency, delta, comparison label, date, and time formatters into feature utils.
- Keep JSX in route files during this layer.

Layer 2: Extract presentational components.

- Move tables, rows, cards, lists, images, summaries, forms, and date controls.
- Components should receive explicit props and callbacks.
- UI text, Tailwind classes, spacing, and button placement should stay the same.

Layer 3: Extract page hooks where state is non-trivial.

- Staff page gets `use-staff-management.ts`.
- Reports page gets `use-admin-report-view.ts`.
- Settings page gets `use-admin-settings.ts`.
- Reservations page may stay mostly component-based unless state grows, because reservation data already has feature-level repository hooks.

Layer 4: Keep route pages as wrappers.

- Route files should stay small and route-focused.
- Feature views own the page implementation.

## Non-Goals

- Do not change visible UI.
- Do not change staff role or active-status behavior.
- Do not change reports calculations.
- Do not change reservation comment behavior.
- Do not change settings save behavior.
- Do not change API routes.
- Do not change database schema, Supabase policies, or migrations.
- Do not refactor admin inventory or fields in this pass.

## Acceptance Criteria

- Admin staff route renders the same visible UI and behavior.
- Admin reports route renders the same visible UI and behavior.
- Admin reservations route renders the same visible UI and behavior.
- Admin settings route renders the same visible UI and behavior.
- Each route file becomes a small wrapper.
- New implementation code lives under `src/features/admin/<area>/`.
- `npm run build` passes.

## Verification

Run automated checks:

```powershell
npm run build
```

Run manual smoke checks:

```text
1. Open admin staff page and update a staff member role/status.
2. Open admin reports and change report date range.
3. Open admin reservations and edit a seller comment.
4. Open admin settings and save a settings change.
5. Confirm visible layouts match the current UI.
```

