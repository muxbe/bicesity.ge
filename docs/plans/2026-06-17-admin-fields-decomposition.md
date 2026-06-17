# Admin Fields Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/app/admin/fields/page.tsx` into focused feature files while preserving the exact current admin field settings behavior and visuals.

**Architecture:** Keep the App Router page as a thin route entry and move field settings internals into `src/features/fields/admin/`. Extract pure helpers first, then presentational pieces, then the controller hook, so each step can be verified independently.

**Tech Stack:** Next.js App Router, React client components, TypeScript, existing field repository/data hooks, existing static verifier scripts, `npm run build`.

---

## Scope

This plan implements only the first target from `docs/specs/2026-06-17-large-page-decomposition.md`: `src/app/admin/fields/page.tsx`.

Do not refactor:

- `src/app/page.tsx`
- `src/app/shop/[id]/page.tsx`
- `src/app/admin/staff/page.tsx`
- `src/app/admin/reports/page.tsx`

Do not change:

- Styling classes.
- Visible text.
- Field behavior.
- Field repository calls.
- Invalidation behavior.
- Routes.
- Database behavior.

## Target File Structure

Create this folder:

```text
src/features/fields/admin/
```

Create these files:

```text
src/features/fields/admin/field-settings-types.ts
src/features/fields/admin/field-settings-helpers.ts
src/features/fields/admin/field-option-drafts.tsx
src/features/fields/admin/add-field-modal.tsx
src/features/fields/admin/edit-custom-field-modal.tsx
src/features/fields/admin/edit-core-field-modal.tsx
src/features/fields/admin/field-card.tsx
src/features/fields/admin/field-card-grid.tsx
src/features/fields/admin/field-settings-toolbar.tsx
src/features/fields/admin/use-field-settings-controller.ts
src/features/fields/admin/field-settings-view.tsx
```

Modify this file:

```text
src/app/admin/fields/page.tsx
```

Add this verifier:

```text
docs/tests/verify-admin-fields-decomposition.mjs
```

## Task 1: Add Static Verifier

**Files:**

- Create: `docs/tests/verify-admin-fields-decomposition.mjs`

- [ ] **Step 1: Create the verifier**

Create `docs/tests/verify-admin-fields-decomposition.mjs` with checks for the target structure.

Use this content:

```js
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredFiles = [
  "src/features/fields/admin/field-settings-types.ts",
  "src/features/fields/admin/field-settings-helpers.ts",
  "src/features/fields/admin/field-option-drafts.tsx",
  "src/features/fields/admin/add-field-modal.tsx",
  "src/features/fields/admin/edit-custom-field-modal.tsx",
  "src/features/fields/admin/edit-core-field-modal.tsx",
  "src/features/fields/admin/field-card.tsx",
  "src/features/fields/admin/field-card-grid.tsx",
  "src/features/fields/admin/field-settings-toolbar.tsx",
  "src/features/fields/admin/use-field-settings-controller.ts",
  "src/features/fields/admin/field-settings-view.tsx",
];

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
}

const failures = [];
const missingFiles = requiredFiles.filter((file) => !existsSync(path.join(repoRoot, file)));

if (missingFiles.length > 0) {
  failures.push(`Missing admin fields decomposition files:\n${missingFiles.map((file) => `- ${file}`).join("\n")}`);
}

const pagePath = "src/app/admin/fields/page.tsx";
if (!existsSync(path.join(repoRoot, pagePath))) {
  failures.push("Missing admin fields page.");
} else {
  const page = read(pagePath);
  if (!page.includes("FieldSettingsView")) {
    failures.push("Admin fields page must render FieldSettingsView.");
  }
  if (lineCount(page) > 25) {
    failures.push(`Admin fields page must be thin, found ${lineCount(page)} lines.`);
  }
}

if (missingFiles.length === 0) {
  const view = read("src/features/fields/admin/field-settings-view.tsx");
  const controller = read("src/features/fields/admin/use-field-settings-controller.ts");
  const helpers = read("src/features/fields/admin/field-settings-helpers.ts");
  const types = read("src/features/fields/admin/field-settings-types.ts");
  const grid = read("src/features/fields/admin/field-card-grid.tsx");
  const card = read("src/features/fields/admin/field-card.tsx");
  const toolbar = read("src/features/fields/admin/field-settings-toolbar.tsx");

  if (!view.includes("useFieldSettingsController")) {
    failures.push("FieldSettingsView must use useFieldSettingsController().");
  }
  if (!view.includes("FieldSettingsToolbar")) {
    failures.push("FieldSettingsView must render FieldSettingsToolbar.");
  }
  if (!view.includes("FieldCardGrid")) {
    failures.push("FieldSettingsView must render FieldCardGrid.");
  }
  if (!view.includes("AddFieldModal")) {
    failures.push("FieldSettingsView must render AddFieldModal.");
  }
  if (!view.includes("EditCustomFieldModal")) {
    failures.push("FieldSettingsView must render EditCustomFieldModal.");
  }
  if (!view.includes("EditCoreFieldModal")) {
    failures.push("FieldSettingsView must render EditCoreFieldModal.");
  }

  if (!controller.includes("export function useFieldSettingsController")) {
    failures.push("Controller file must export useFieldSettingsController().");
  }
  if (!controller.includes("useFieldData('all')")) {
    failures.push("Controller must keep loading all fields.");
  }
  if (!controller.includes("publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL)")) {
    failures.push("Controller must keep catalog invalidation.");
  }
  if (!controller.includes("publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI)")) {
    failures.push("Controller must keep reports invalidation.");
  }

  for (const helperName of [
    "parseActionError",
    "normalizeOptionLabels",
    "normalizeCoreOptionLabels",
    "canEditCoreOptions",
  ]) {
    if (!helpers.includes(`export function ${helperName}`)) {
      failures.push(`Helpers must export ${helperName}.`);
    }
  }

  for (const typeName of ["Category", "VisibilityFilter", "CoreFieldEditor"]) {
    if (!types.includes(`export type ${typeName}`)) {
      failures.push(`Types file must export ${typeName}.`);
    }
  }

  if (!grid.includes("FieldCard")) {
    failures.push("FieldCardGrid must render FieldCard.");
  }
  if (!card.includes("GripVertical") || !card.includes("Trash2") || !card.includes("Pencil")) {
    failures.push("FieldCard must keep reorder, delete, and edit controls.");
  }
  if (!toolbar.includes("visibilityFilter") || !toolbar.includes("query")) {
    failures.push("FieldSettingsToolbar must own query and visibility controls.");
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log("Admin fields decomposition static checks passed.");
```

- [ ] **Step 2: Run verifier and confirm RED**

Run:

```powershell
node docs\tests\verify-admin-fields-decomposition.mjs
```

Expected: FAIL, listing missing files and oversized `src/app/admin/fields/page.tsx`.

- [ ] **Step 3: Commit verifier**

Run:

```powershell
git add docs/tests/verify-admin-fields-decomposition.mjs
git commit -m "Add admin fields decomposition verifier"
```

## Task 2: Extract Shared Types And Helpers

**Files:**

- Create: `src/features/fields/admin/field-settings-types.ts`
- Create: `src/features/fields/admin/field-settings-helpers.ts`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create shared types**

Create `src/features/fields/admin/field-settings-types.ts`:

```ts
import type { CoreFieldDefinition } from "@/features/fields/field-layout";

export type Category = "Bicycle" | "Parts";
export type VisibilityFilter = "all" | "public" | "internal";

export type CoreFieldEditor = {
  category: Category;
  field: CoreFieldDefinition;
  isPublic: boolean;
};
```

- [ ] **Step 2: Create pure helpers**

Create `src/features/fields/admin/field-settings-helpers.ts` by moving the existing helper logic from `src/app/admin/fields/page.tsx`.

The resulting file must export:

```ts
import type { FieldOptionDTO } from "@/features/fields";
import type { CoreFieldKey, CoreFieldOption } from "@/features/fields/field-layout";

const CATEGORY_OPTION_VALUES = ["Bicycle", "Parts"] as const;

export function parseActionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Action failed. Please try again.";
}

export function normalizeOptionLabels(
  labels: string[]
): Array<Pick<FieldOptionDTO, "label" | "value" | "sortOrder">> {
  const seen = new Set<string>();
  return labels
    .map((label) => label.trim())
    .filter((label) => {
      if (!label) {
        return false;
      }
      const key = label.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((label, index) => ({
      label,
      value: label,
      sortOrder: index + 1,
    }));
}

export function normalizeCoreOptionLabels(
  fieldKey: CoreFieldKey,
  labels: string[]
): CoreFieldOption[] {
  if (fieldKey === "category") {
    return CATEGORY_OPTION_VALUES.map((value, index) => ({
      value,
      label: labels[index]?.trim() || value,
    }));
  }

  const seen = new Set<string>();
  return labels
    .map((label) => label.trim())
    .filter((label) => {
      if (!label) {
        return false;
      }
      const key = label.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((label) => ({
      label,
      value: label,
    }));
}

export function canEditCoreOptions(fieldKey: CoreFieldKey) {
  return fieldKey === "category" || fieldKey === "drive_type";
}

export const CATEGORY_OPTION_VALUES_FOR_FIELDS = CATEGORY_OPTION_VALUES;
```

- [ ] **Step 3: Update page imports**

In `src/app/admin/fields/page.tsx`:

- Remove local `Category`, `VisibilityFilter`, and `CoreFieldEditor`.
- Remove local helper function definitions.
- Import them from the new files:

```ts
import type {
  Category,
  CoreFieldEditor,
  VisibilityFilter,
} from "@/features/fields/admin/field-settings-types";
import {
  CATEGORY_OPTION_VALUES_FOR_FIELDS,
  canEditCoreOptions,
  normalizeCoreOptionLabels,
  normalizeOptionLabels,
  parseActionError,
} from "@/features/fields/admin/field-settings-helpers";
```

- Replace local `CATEGORY_OPTION_VALUES` usages with `CATEGORY_OPTION_VALUES_FOR_FIELDS`.

- [ ] **Step 4: Verify GREEN for this slice**

Run:

```powershell
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/field-settings-types.ts src/features/fields/admin/field-settings-helpers.ts
git commit -m "Extract admin field settings helpers"
```

## Task 3: Extract Reusable Option Drafts Component

**Files:**

- Create: `src/features/fields/admin/field-option-drafts.tsx`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create component**

Create `src/features/fields/admin/field-option-drafts.tsx`.

It must export:

```ts
export type FieldOptionDraftsProps = {
  drafts: string[];
  onAdd?: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  optionPlaceholder: (index: number) => string;
  addOptionLabel?: string;
  deleteLabel: string;
  upLabel?: string;
  downLabel?: string;
  fixedValues?: readonly string[];
  fixedValueLabel?: (value: string) => string;
  canRemoveFixedValues?: boolean;
};
```

The component renders the existing option input rows from `page.tsx` unchanged:

- Input value from `drafts[index]`.
- `onChange(index, event.target.value)`.
- Delete button calls `onRemove(index)`.
- Optional up/down buttons call `onMove(index, -1)` and `onMove(index, 1)`.
- When `fixedValues` is provided, show the fixed value label instead of the delete button.

- [ ] **Step 2: Replace duplicated option JSX in page**

In `src/app/admin/fields/page.tsx`, replace the option row JSX in:

- Add field modal.
- Custom field editor modal.
- Core field editor modal.

Use `FieldOptionDrafts` and pass the existing state handlers.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/field-option-drafts.tsx
git commit -m "Extract admin field option drafts"
```

## Task 4: Extract Add Field Modal

**Files:**

- Create: `src/features/fields/admin/add-field-modal.tsx`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create modal component**

Create `src/features/fields/admin/add-field-modal.tsx`.

The component must:

- Start with `"use client";`.
- Import `X` from `lucide-react`.
- Import `FieldDataType` from `@/features/fields`.
- Import `FieldOptionDrafts`.
- Render the exact existing add-field modal markup from `page.tsx`.

Use this prop shape:

```ts
export type AddFieldModalProps = {
  isOpen: boolean;
  fieldName: string;
  fieldNameRu: string;
  fieldNameKa: string;
  dataType: FieldDataType;
  isPublic: boolean;
  optionsEnabled: boolean;
  optionDrafts: string[];
  isCreating: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onFieldNameChange: (value: string) => void;
  onFieldNameRuChange: (value: string) => void;
  onFieldNameKaChange: (value: string) => void;
  onDataTypeChange: (value: FieldDataType) => void;
  onPublicChange: (value: boolean) => void;
  onOptionsEnabledChange: (value: boolean) => void;
  onOptionDraftChange: (index: number, value: string) => void;
  onOptionDraftRemove: (index: number) => void;
  onOptionDraftAdd: () => void;
  onSubmit: () => void;
  onClose: () => void;
};
```

- [ ] **Step 2: Replace inline modal in page**

In `src/app/admin/fields/page.tsx`, replace the `{showModal && (...)}` add-field modal block with:

```tsx
<AddFieldModal
  isOpen={showModal}
  fieldName={newFieldName}
  fieldNameRu={newFieldNameRu}
  fieldNameKa={newFieldNameKa}
  dataType={newFieldDataType}
  isPublic={isPublic}
  optionsEnabled={newFieldOptionsEnabled}
  optionDrafts={newFieldOptionDrafts}
  isCreating={workingFieldId === "creating"}
  t={t}
  onFieldNameChange={setNewFieldName}
  onFieldNameRuChange={setNewFieldNameRu}
  onFieldNameKaChange={setNewFieldNameKa}
  onDataTypeChange={setNewFieldDataType}
  onPublicChange={setIsPublic}
  onOptionsEnabledChange={(value) => {
    setNewFieldOptionsEnabled(value);
    if (value && newFieldOptionDrafts.length === 0) {
      setNewFieldOptionDrafts([""]);
    }
  }}
  onOptionDraftChange={updateNewFieldOptionDraft}
  onOptionDraftRemove={removeNewFieldOptionDraft}
  onOptionDraftAdd={() => setNewFieldOptionDrafts((current) => [...current, ""])}
  onSubmit={() => void createField()}
  onClose={() => setShowModal(false)}
/>
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/add-field-modal.tsx
git commit -m "Extract admin add field modal"
```

## Task 5: Extract Custom Field Editor Modal

**Files:**

- Create: `src/features/fields/admin/edit-custom-field-modal.tsx`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create component**

Create `src/features/fields/admin/edit-custom-field-modal.tsx`.

It must:

- Start with `"use client";`.
- Import `X` from `lucide-react`.
- Import `FieldDTO` and `FieldDataType` from `@/features/fields`.
- Import `FieldOptionDrafts`.
- Render the existing `{optionsField && (...)}` custom-field editor modal markup unchanged.

Use this prop shape:

```ts
export type EditCustomFieldModalProps = {
  field: FieldDTO | null;
  fieldName: string;
  fieldNameRu: string;
  fieldNameKa: string;
  dataType: FieldDataType;
  isPublic: boolean;
  optionsEnabled: boolean;
  optionDrafts: string[];
  t: (key: string, params?: Record<string, string | number>) => string;
  onFieldNameChange: (value: string) => void;
  onFieldNameRuChange: (value: string) => void;
  onFieldNameKaChange: (value: string) => void;
  onDataTypeChange: (value: FieldDataType) => void;
  onPublicChange: (value: boolean) => void;
  onOptionsEnabledChange: (value: boolean) => void;
  onOptionDraftChange: (index: number, value: string) => void;
  onOptionDraftRemove: (index: number) => void;
  onOptionDraftMove: (index: number, direction: -1 | 1) => void;
  onOptionDraftAdd: () => void;
  onSave: () => void;
  onClose: () => void;
};
```

- [ ] **Step 2: Replace inline modal in page**

In `src/app/admin/fields/page.tsx`, replace the custom editor modal block with `EditCustomFieldModal` and pass the existing state/actions.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/edit-custom-field-modal.tsx
git commit -m "Extract admin custom field modal"
```

## Task 6: Extract Core Field Editor Modal

**Files:**

- Create: `src/features/fields/admin/edit-core-field-modal.tsx`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create component**

Create `src/features/fields/admin/edit-core-field-modal.tsx`.

It must:

- Start with `"use client";`.
- Import `X` from `lucide-react`.
- Import `CoreFieldEditor` from `field-settings-types`.
- Import `CATEGORY_OPTION_VALUES_FOR_FIELDS` and `canEditCoreOptions`.
- Import `FieldOptionDrafts`.
- Render the existing `{coreFieldEditor && (...)}` modal markup unchanged.

Use this prop shape:

```ts
export type EditCoreFieldModalProps = {
  editor: CoreFieldEditor | null;
  fieldName: string;
  isPublic: boolean;
  optionDrafts: string[];
  t: (key: string, params?: Record<string, string | number>) => string;
  onFieldNameChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
  onOptionDraftChange: (index: number, value: string) => void;
  onOptionDraftRemove: (index: number) => void;
  onOptionDraftAdd: () => void;
  onSave: () => void;
  onClose: () => void;
};
```

- [ ] **Step 2: Replace inline modal in page**

In `src/app/admin/fields/page.tsx`, replace the core editor modal block with `EditCoreFieldModal` and pass the existing state/actions.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/edit-core-field-modal.tsx
git commit -m "Extract admin core field modal"
```

## Task 7: Extract Field Card And Grid

**Files:**

- Create: `src/features/fields/admin/field-card.tsx`
- Create: `src/features/fields/admin/field-card-grid.tsx`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create `FieldCard`**

Create `src/features/fields/admin/field-card.tsx`.

It must:

- Start with `"use client";`.
- Import `Eye`, `EyeOff`, `GripVertical`, `Loader2`, `Pencil`, and `Trash2` from `lucide-react`.
- Import `coreFieldOptions` and `FieldLayoutItem` from `@/features/fields/field-layout`.
- Import `fieldNameLabel` from `@/lib/i18n`.
- Render exactly one existing field card from the current `visibleLayoutItems.map(...)` block.

Use this prop shape:

```ts
export type FieldCardProps = {
  item: FieldLayoutItem;
  index: number;
  locale: string;
  workingFieldId: string | null;
  draggingFieldId: string | null;
  dragOverFieldId: string | null;
  canReorderFields: boolean;
  fieldLayoutConfig: ReturnType<typeof import("@/features/fields/field-layout").loadFieldLayoutConfig>;
  t: (key: string, params?: Record<string, string | number>) => string;
  onToggleCoreVisibility: (fieldKey: import("@/features/fields/field-layout").CoreFieldKey, isPublic: boolean) => void;
  onToggleFieldVisibility: (field: import("@/features/fields").FieldDTO) => void;
  onOpenCoreEditor: (item: Extract<FieldLayoutItem, { kind: "core" }>) => void;
  onOpenOptionsEditor: (field: import("@/features/fields").FieldDTO) => void;
  onArchiveField: (fieldId: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (targetId: string, dataTransferId: string) => void;
  onDragEnd: () => void;
};
```

If the imported `ReturnType` expression is awkward in practice, create a named `FieldLayoutConfig` type in `field-settings-types.ts` using the same source type from existing field-layout exports if one exists. Do not use `any`.

- [ ] **Step 2: Create `FieldCardGrid`**

Create `src/features/fields/admin/field-card-grid.tsx`.

It must:

- Render the existing grid wrapper.
- Render empty state.
- Map `visibleLayoutItems` into `FieldCard`.
- Render the existing dashed add-field button unchanged.

Use this prop shape:

```ts
export type FieldCardGridProps = {
  isLoading: boolean;
  visibleLayoutItems: FieldLayoutItem[];
  locale: string;
  workingFieldId: string | null;
  draggingFieldId: string | null;
  dragOverFieldId: string | null;
  canReorderFields: boolean;
  fieldLayoutConfig: ReturnType<typeof import("@/features/fields/field-layout").loadFieldLayoutConfig>;
  t: (key: string, params?: Record<string, string | number>) => string;
  onAddField: () => void;
  onToggleCoreVisibility: FieldCardProps["onToggleCoreVisibility"];
  onToggleFieldVisibility: FieldCardProps["onToggleFieldVisibility"];
  onOpenCoreEditor: FieldCardProps["onOpenCoreEditor"];
  onOpenOptionsEditor: FieldCardProps["onOpenOptionsEditor"];
  onArchiveField: FieldCardProps["onArchiveField"];
  onDragStart: FieldCardProps["onDragStart"];
  onDragOver: FieldCardProps["onDragOver"];
  onDragLeave: FieldCardProps["onDragLeave"];
  onDrop: FieldCardProps["onDrop"];
  onDragEnd: FieldCardProps["onDragEnd"];
};
```

- [ ] **Step 3: Replace inline grid in page**

In `src/app/admin/fields/page.tsx`, replace the grid and field-card map with `FieldCardGrid`.

Keep the existing `reorderField` function in the page for this task. Pass drag callbacks through props.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/field-card.tsx src/features/fields/admin/field-card-grid.tsx
git commit -m "Extract admin field cards"
```

## Task 8: Extract Toolbar

**Files:**

- Create: `src/features/fields/admin/field-settings-toolbar.tsx`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create toolbar**

Create `src/features/fields/admin/field-settings-toolbar.tsx`.

It must:

- Start with `"use client";`.
- Import `Search` from `lucide-react`.
- Import `VisibilityFilter` from `field-settings-types`.
- Render the existing search, visibility filter, and count wrapper unchanged.

Use this prop shape:

```ts
export type FieldSettingsToolbarProps = {
  query: string;
  visibilityFilter: VisibilityFilter;
  visibleCount: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onQueryChange: (value: string) => void;
  onVisibilityFilterChange: (value: VisibilityFilter) => void;
};
```

- [ ] **Step 2: Replace toolbar JSX in page**

In `src/app/admin/fields/page.tsx`, replace the toolbar block with:

```tsx
<FieldSettingsToolbar
  query={query}
  visibilityFilter={visibilityFilter}
  visibleCount={visibleLayoutItems.length}
  t={t}
  onQueryChange={setQuery}
  onVisibilityFilterChange={setVisibilityFilter}
/>
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/field-settings-toolbar.tsx
git commit -m "Extract admin field settings toolbar"
```

## Task 9: Extract Controller Hook

**Files:**

- Create: `src/features/fields/admin/use-field-settings-controller.ts`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create controller hook**

Create `src/features/fields/admin/use-field-settings-controller.ts`.

Move all state, derived values, and action functions from `src/app/admin/fields/page.tsx` into this hook:

- `activeTab`, `setActiveTab`
- add-field modal state
- custom field editor state
- core field editor state
- query and visibility filters
- working/reorder state
- `fields`, `isLoading`, `error`, `reload`
- `fieldRepository`
- data-source warnings
- `fieldLayoutConfig`
- `orderedLayoutItems`
- `visibleLayoutItems`
- `canReorderFields`
- all action handlers

The hook must export:

```ts
export function useFieldSettingsController() {
  // moved state and actions
  return {
    activeTab,
    setActiveTab,
    showModal,
    setShowModal,
    newFieldName,
    setNewFieldName,
    newFieldNameRu,
    setNewFieldNameRu,
    newFieldNameKa,
    setNewFieldNameKa,
    newFieldDataType,
    setNewFieldDataType,
    isPublic,
    setIsPublic,
    newFieldOptionsEnabled,
    setNewFieldOptionsEnabled,
    newFieldOptionDrafts,
    setNewFieldOptionDrafts,
    query,
    setQuery,
    visibilityFilter,
    setVisibilityFilter,
    workingFieldId,
    actionError,
    draggingFieldId,
    dragOverFieldId,
    optionsField,
    optionsFieldName,
    setOptionsFieldName,
    optionsFieldNameRu,
    setOptionsFieldNameRu,
    optionsFieldNameKa,
    setOptionsFieldNameKa,
    optionsFieldDataType,
    setOptionsFieldDataType,
    optionsFieldIsPublic,
    setOptionsFieldIsPublic,
    optionsEnabled,
    setOptionsEnabled,
    optionDrafts,
    setOptionDrafts,
    coreFieldEditor,
    coreFieldName,
    setCoreFieldName,
    coreOptionDrafts,
    setCoreOptionDrafts,
    coreFieldIsPublic,
    setCoreFieldIsPublic,
    isLoading,
    error,
    isUsingFallbackMock,
    isMockRequested,
    fieldLayoutConfig,
    visibleLayoutItems,
    canReorderFields,
    createField,
    toggleFieldVisibility,
    toggleCoreVisibility,
    archiveField,
    openOptionsEditor,
    closeOptionsEditor,
    saveOptions,
    updateOptionDraft,
    removeOptionDraft,
    moveOptionDraft,
    openCoreEditor,
    closeCoreEditor,
    saveCoreEditor,
    updateCoreOptionDraft,
    removeCoreOptionDraft,
    updateNewFieldOptionDraft,
    removeNewFieldOptionDraft,
    reorderField,
    setDraggingFieldId,
    setDragOverFieldId,
  };
}
```

If the returned object becomes hard to consume, group related values under:

- `addModal`
- `customEditor`
- `coreEditor`
- `toolbar`
- `grid`
- `status`

Use named groups only if that keeps call sites clearer. Do not introduce behavior changes while grouping.

- [ ] **Step 2: Simplify page to consume controller**

In `src/app/admin/fields/page.tsx`, replace state/action definitions with:

```ts
const controller = useFieldSettingsController();
```

Then update JSX to read values from `controller`.

- [ ] **Step 3: Verify**

Run:

```powershell
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/use-field-settings-controller.ts
git commit -m "Extract admin field settings controller"
```

## Task 10: Extract Top-Level View And Thin Page

**Files:**

- Create: `src/features/fields/admin/field-settings-view.tsx`
- Modify: `src/app/admin/fields/page.tsx`

- [ ] **Step 1: Create view**

Create `src/features/fields/admin/field-settings-view.tsx`.

It must:

- Start with `"use client";`.
- Import `useI18n` from `@/lib/i18n`.
- Import `useFieldSettingsController`.
- Import all extracted components.
- Render the remaining JSX from `src/app/admin/fields/page.tsx`.

The component signature:

```ts
export function FieldSettingsView() {
  const { locale, t } = useI18n();
  const controller = useFieldSettingsController();

  return (
    // existing page JSX, now wired to controller
  );
}
```

- [ ] **Step 2: Replace route page with thin wrapper**

Replace `src/app/admin/fields/page.tsx` with:

```tsx
import { FieldSettingsView } from "@/features/fields/admin/field-settings-view";

export default function FieldSettingsPage() {
  return <FieldSettingsView />;
}
```

- [ ] **Step 3: Run admin fields decomposition verifier**

Run:

```powershell
node docs\tests\verify-admin-fields-decomposition.mjs
```

Expected: PASS.

- [ ] **Step 4: Run all relevant static checks**

Run:

```powershell
node docs\tests\verify-admin-fields-decomposition.mjs
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
git diff --check
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/app/admin/fields/page.tsx src/features/fields/admin/field-settings-view.tsx
git commit -m "Extract admin field settings view"
```

## Task 11: Manual Smoke Verification

**Files:**

- No source changes expected.

- [ ] **Step 1: Start dev server**

Run:

```powershell
npm run dev
```

Expected: local server starts.

- [ ] **Step 2: Manually verify `/admin/fields`**

Open:

```text
http://localhost:3000/admin/fields
```

Verify:

- Page loads.
- Bicycle tab works.
- Parts tab works.
- Search filters visible cards.
- Visibility filter works.
- Add field modal opens and closes.
- Edit custom field modal opens and closes.
- Edit core field modal opens and closes.
- Drag reorder still saves.

- [ ] **Step 3: Stop dev server**

Stop the dev server process after verification.

## Task 12: Final Verification And Summary Commit

**Files:**

- No source changes expected unless a verification issue was fixed.

- [ ] **Step 1: Run final verification**

Run:

```powershell
node docs\tests\verify-admin-fields-decomposition.mjs
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
git diff --check
npm run build
```

Expected: all pass.

- [ ] **Step 2: Check largest page files**

Run:

```powershell
Get-ChildItem -Path src\app -Recurse -Filter page.tsx | ForEach-Object { [pscustomobject]@{ Lines=(Get-Content -LiteralPath $_.FullName | Measure-Object -Line).Lines; File=$_.FullName.Replace((Get-Location).Path + '\','') } } | Sort-Object Lines -Descending | Select-Object -First 10 | Format-Table -AutoSize
```

Expected:

- `src/app/admin/fields/page.tsx` is under 25 lines.
- `src/app/page.tsx` becomes the largest remaining route page.

- [ ] **Step 3: Report result**

Report:

- New `admin/fields/page.tsx` line count.
- Largest remaining page.
- Verification commands and pass/fail status.
- Whether `main` is ahead of origin.

## Notes For Implementation

- Use `apply_patch` for small single-file changes.
- For large JSX moves, a careful manual edit or scripted file move is acceptable, but inspect the diff before committing.
- Do not modify user data, Supabase migrations, or Vercel settings in this refactor.
- Do not deploy unless the user explicitly asks.
- If a moved component needs a very large prop list, pause and group props by domain instead of pushing a messy API forward.
- If `use-field-settings-controller.ts` grows too large, split it only after the page is thin and verified.

