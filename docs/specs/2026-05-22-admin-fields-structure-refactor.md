# Admin Fields Structure Refactor Spec

## Problem

The admin fields settings screen works, but its route file has grown too large:

- `src/app/admin/fields/page.tsx` is about 1,146 lines.
- It contains the page view, field creation modal state, field option editing, core field editing, visibility filters, drag-and-drop layout state, repository calls, option normalization helpers, and action error handling in one route file.
- This makes it harder to safely adjust custom field behavior because UI, state, and data mutations are tightly mixed.

## Goal

Split the admin fields settings screen into a focused feature folder while keeping the visible UI and behavior exactly the same.

This is a structure refactor, not a redesign.

## Current Code Shape

Primary file:

- `src/app/admin/fields/page.tsx`

Existing nearby feature code:

- `src/features/fields/repositories/use-field-data.ts`
- `src/features/fields/repositories/field-repository.ts`
- `src/features/fields/repositories/field-repository.factory.ts`
- `src/features/fields/field-layout.ts`
- `src/features/fields/dto/field-dto.ts`

Current responsibilities inside the route file:

- page shell and tab controls
- field search and visibility filtering
- new field modal state
- new field option draft state
- existing field option editor state
- core field editor state
- option label normalization
- core option normalization
- field visibility updates
- field archive/delete behavior
- drag-and-drop ordering behavior
- action loading and error display

## Target Structure

Create a dedicated fields settings feature folder:

```txt
src/features/fields/settings/
  field-settings-view.tsx
  constants.ts
  types.ts
  components/
    core-field-editor-modal.tsx
    field-create-modal.tsx
    field-list.tsx
    field-list-item.tsx
    field-options-modal.tsx
    field-settings-header.tsx
    field-settings-toolbar.tsx
    visibility-badge.tsx
  hooks/
    use-field-editor-state.ts
    use-field-filters.ts
    use-field-layout-drag.ts
    use-field-settings-actions.ts
  utils/
    field-options.ts
    field-errors.ts
```

Then reduce:

```txt
src/app/admin/fields/page.tsx
```

to a small route wrapper that renders `FieldSettingsView`.

## Refactor Approach

Use careful extraction in layers.

Layer 1: Extract types, constants, and pure utilities.

- Move category and visibility filter types into `types.ts`.
- Move fixed category option values into `constants.ts`.
- Move option normalization and action error parsing into `utils/`.
- Keep all JSX in the route file during this layer.

Layer 2: Extract small presentational components.

- Move badges, header, toolbar, field row, and field list first.
- Move create/options/core editor modals after their props are clear.
- Components should receive explicit props and callbacks.
- Rendered labels, spacing, Tailwind classes, and button placement should stay the same.

Layer 3: Extract focused hooks.

- `use-field-filters.ts` owns active tab, query, visibility filter, and derived visible fields.
- `use-field-editor-state.ts` owns modal draft state for creating and editing fields.
- `use-field-layout-drag.ts` owns dragging field id, drag-over field id, and layout reorder helpers.
- `use-field-settings-actions.ts` owns reusable repository actions and shared error handling.

Layer 4: Keep `FieldSettingsView` as the coordinator.

- It loads field data.
- It wires hooks and components together.
- It remains the place that decides which actions are available.

## Non-Goals

- Do not change visible UI.
- Do not change field creation behavior.
- Do not change field option behavior.
- Do not change core field behavior.
- Do not change drag-and-drop layout behavior.
- Do not change field repository APIs.
- Do not change database schema, Supabase policies, or migrations.
- Do not refactor admin inventory in this pass.

## Acceptance Criteria

- `src/app/admin/fields/page.tsx` becomes a small route wrapper.
- New code lives under `src/features/fields/settings/`.
- Existing custom field creation still works.
- Existing option editing still works.
- Existing core field editing still works.
- Existing visibility filtering still works.
- Existing drag-and-drop field ordering still works.
- UI looks the same before and after the refactor.
- `npm run build` passes.

## Verification

Run automated checks:

```powershell
npm run build
```

Run manual smoke checks:

```text
1. Open admin fields settings.
2. Switch Bicycle and Parts tabs.
3. Search fields.
4. Change visibility filter.
5. Create a custom field.
6. Edit options for a custom field.
7. Edit a core field where editing is allowed.
8. Drag fields to reorder them.
9. Confirm visible layout matches the current UI.
```

