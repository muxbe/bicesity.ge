# Large Page Decomposition Spec

## Goal

Split the remaining oversized route pages into smaller, focused feature files without changing visuals, behavior, URLs, database logic, or user workflows.

## Current Problem

Several `page.tsx` route files still contain too many responsibilities in one file. They mix data loading, state management, helper functions, action handlers, layout markup, cards, forms, and modals. This makes future fixes slower and riskier because one edit can touch a very large file.

Current largest route pages:

1. `src/app/admin/fields/page.tsx` - 1146 lines
2. `src/app/page.tsx` - 946 lines
3. `src/app/shop/[id]/page.tsx` - 554 lines
4. `src/app/admin/staff/page.tsx` - 341 lines
5. `src/app/admin/reports/page.tsx` - 310 lines

The first target is `src/app/admin/fields/page.tsx` because it is the largest and has the clearest internal boundaries.

## Non-Goals

- Do not redesign the UI.
- Do not change labels, translations, styling, routes, or database behavior.
- Do not change field management behavior.
- Do not refactor unrelated admin inventory, reservations, or auth code.
- Do not split all large files in one commit.

## Success Criteria

- Each decomposed route `page.tsx` becomes a thin entry file, ideally under 20 lines.
- New feature files each have one clear responsibility.
- Prefer keeping new files under 300 lines.
- Existing static structure checks continue to pass.
- `npm run build` continues to pass.
- The admin fields page behaves the same after the split.

## Decomposition Strategy

Use a staged "thin page plus feature folder" structure.

The route file should only import and render a view component:

```tsx
import { FieldSettingsView } from "@/features/fields/admin/field-settings-view";

export default function FieldSettingsPage() {
  return <FieldSettingsView />;
}
```

The feature folder owns the page internals:

```text
src/features/fields/admin/
  field-settings-view.tsx
  use-field-settings-controller.ts
  field-settings-toolbar.tsx
  field-card-grid.tsx
  field-card.tsx
  add-field-modal.tsx
  edit-custom-field-modal.tsx
  edit-core-field-modal.tsx
  field-option-drafts.tsx
  field-settings-helpers.ts
  field-settings-types.ts
```

## Admin Fields Target Design

### `field-settings-view.tsx`

Owns the top-level page composition.

Responsibilities:

- Calls `useFieldSettingsController()`.
- Renders title, warnings, tabs, toolbar, grid, add-card, and modals.
- Does not contain mutation logic.
- Does not contain option normalization logic.

### `use-field-settings-controller.ts`

Owns state, derived data, and actions.

Responsibilities:

- Active tab.
- Search and visibility filters.
- Field data loading.
- Create field action.
- Toggle custom field visibility.
- Toggle core field visibility.
- Archive custom field.
- Open/close add modal.
- Open/close custom field editor.
- Open/close core field editor.
- Save custom field edits.
- Save core field edits.
- Drag reorder state and persistence.
- Publishes invalidation tags after successful mutations.

This hook should expose a typed controller object so UI components stay mostly presentational.

### `field-settings-types.ts`

Owns shared admin-field page-only types.

Types:

- `Category`
- `VisibilityFilter`
- `CoreFieldEditor`
- Controller return/input helper types if needed

### `field-settings-helpers.ts`

Owns pure helper functions.

Functions:

- `parseActionError`
- `normalizeOptionLabels`
- `normalizeCoreOptionLabels`
- `canEditCoreOptions`

These helpers should be independent from React.

### `field-settings-toolbar.tsx`

Owns search, visibility filter, and count display.

Inputs:

- Query value and setter.
- Visibility filter value and setter.
- Visible count.
- Translation function.

### `field-card-grid.tsx`

Owns list layout.

Responsibilities:

- Empty state.
- Maps visible layout items.
- Renders `FieldCard`.
- Renders the add-field card.

### `field-card.tsx`

Owns one field card.

Responsibilities:

- Core/custom field display.
- Visibility toggle button.
- Drag handle.
- Edit button.
- Delete/archive button for custom fields.
- Badges for visibility, data type, key, options/free input.

### `add-field-modal.tsx`

Owns the create-field modal UI.

Responsibilities:

- English/Russian/Georgian labels.
- Data type selection.
- Fixed options toggle.
- Public visibility toggle.
- Submit/cancel buttons.

Mutation is passed in through props, not implemented inside the modal.

### `edit-custom-field-modal.tsx`

Owns the custom field editor modal UI.

Responsibilities:

- Existing custom field label translations.
- Data type selection.
- Public visibility toggle.
- Fixed options editor.
- Submit/cancel buttons.

Mutation is passed in through props.

### `edit-core-field-modal.tsx`

Owns the core field editor modal UI.

Responsibilities:

- Core label editing.
- Core public visibility.
- Category option labels.
- Drive type options.
- Submit/cancel buttons.

Mutation is passed in through props.

### `field-option-drafts.tsx`

Owns reusable option draft UI.

Responsibilities:

- Render option text inputs.
- Add/remove option buttons.
- Optional up/down movement controls.
- Category fixed-value display when editing core category labels.

## Later Page Targets

### Public Home Page

Current file: `src/app/page.tsx`

Future folder:

```text
src/features/shop/home/
  home-view.tsx
  use-home-controller.ts
  home-nav.tsx
  home-filter-bar.tsx
  detailed-filter-panel.tsx
  product-grid.tsx
  product-card.tsx
  rent-view.tsx
  home-helpers.ts
  home-types.ts
```

Split after admin fields is stable.

### Product Detail Page

Current file: `src/app/shop/[id]/page.tsx`

Future folder:

```text
src/features/shop/detail/
  product-detail-view.tsx
  use-product-detail-controller.ts
  product-detail-nav.tsx
  product-gallery.tsx
  product-summary.tsx
  product-spec-grid.tsx
  product-detail-helpers.ts
  product-detail-types.ts
```

Split after public home page is stable.

### Staff And Reports Pages

These are smaller and lower priority:

- `src/app/admin/staff/page.tsx`
- `src/app/admin/reports/page.tsx`

They should only be split after the three largest pages are done.

## Implementation Order

1. Add static verifier for admin fields decomposition.
2. Move helper types/functions out of `admin/fields/page.tsx`.
3. Extract option draft UI.
4. Extract add-field modal.
5. Extract custom field editor modal.
6. Extract core field editor modal.
7. Extract field card and grid.
8. Extract toolbar and top-level view.
9. Move state/actions into `use-field-settings-controller.ts`.
10. Replace route page with a thin wrapper.
11. Run static verifiers and `npm run build`.

## Verification

Run after each implementation slice:

```powershell
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
git diff --check
npm run build
```

If behavior changes are suspected, manually verify:

- `/admin/fields` loads.
- Bicycle and Parts tabs work.
- Search works.
- Visibility filter works.
- Create field modal opens and closes.
- Edit custom field modal opens and closes.
- Edit core field modal opens and closes.
- Drag reorder still saves.

## Risks

- Props can become too large if the controller object is not shaped carefully.
- Moving drag-and-drop handlers can accidentally break reordering.
- Modal extraction can accidentally break form reset behavior.
- The route file may become thin while the controller becomes too large; if the hook grows above roughly 450 lines, split modal state into smaller hooks.

## Approval Gate

Implementation must not start until this spec is reviewed and approved.
