# Admin Inventory Product Form Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the admin inventory `ProductForm` component into a focused component file while keeping the UI and behavior exactly the same.

**Architecture:** This is the second safe slice of the admin inventory refactor. `AdminInventoryView` remains the page coordinator for state, API actions, filters, modals, product list rendering, and callbacks. The extracted `ProductForm` remains a presentational form component that receives all data and callbacks through props.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node `.mjs` verification scripts.

---

## Scope

This plan extracts only the existing `ProductForm` function from:

`src/features/admin/admin-inventory-view.tsx`

into:

`src/features/admin/inventory/components/product-form.tsx`

The moved form keeps its current internal helper functions:

- `setImages`
- `updateFieldValue`
- `changeCategory`
- `renderImageField`
- `renderCustomField`
- `renderCoreField`
- `renderFieldLayoutItem`

This plan does not change labels, classes, spacing, layout, colors, image behavior, field layout behavior, API routes, database code, Supabase policies, migrations, filters, product cards, modals, or hooks.

This plan does not extract:

- inventory filters
- product cards
- create/edit modal wrappers
- reservation/sell/bulk modals
- API action handlers
- data hooks
- shared field renderer helpers

## Files

- Modify: `src/features/admin/admin-inventory-view.tsx`
- Create: `src/features/admin/inventory/components/product-form.tsx`
- Verify: `node docs\tests\verify-structure-baseline.mjs`
- Verify: `git diff --check`
- Verify: `npm run build`

## Expected File Responsibilities

`src/features/admin/admin-inventory-view.tsx`

- Owns admin inventory page state.
- Owns create/edit/reserve/sell/bulk/delete/restore action handlers.
- Owns product filtering and product list rendering.
- Owns modal visibility and selected product IDs.
- Imports and renders `ProductForm`.

`src/features/admin/inventory/components/product-form.tsx`

- Renders the existing product form UI.
- Renders image preview/upload controls.
- Renders configured core fields and custom fields.
- Calls `onChange` with updated `ProductFormDraft` values.
- Calls `onSubmit`, `onClose`, and `onImageFileSelected` from props.
- Does not call catalog APIs, reservation APIs, Supabase APIs, or page reload functions.

## Task 1: Baseline Verification

**Files:**
- Verify only

- [ ] **Step 1: Confirm current structure baseline**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
```

Expected:

```text
Structure baseline verification passed.
```

- [ ] **Step 2: Confirm current git state before implementation**

Run:

```powershell
git status --short --untracked-files=all
```

Expected:

```text
 M src/features/admin/admin-inventory-view.tsx
?? docs/plans/2026-05-27-admin-inventory-safe-extraction.md
?? docs/plans/2026-05-29-admin-inventory-product-form-extraction.md
?? src/features/admin/inventory/components/product-image.tsx
?? src/features/admin/inventory/components/reservation-customer-summary.tsx
?? src/features/admin/inventory/components/status-badge.tsx
?? src/features/admin/inventory/constants.ts
?? src/features/admin/inventory/types.ts
?? src/features/admin/inventory/utils/api-errors.ts
?? src/features/admin/inventory/utils/date.ts
?? src/features/admin/inventory/utils/inventory-copy.ts
?? src/features/admin/inventory/utils/money.ts
?? src/features/admin/inventory/utils/product-draft.ts
```

The exact list may include this plan file only after Task 1 is written. Do not stage, commit, or push.

## Task 2: Create Product Form Component

**Files:**
- Create: `src/features/admin/inventory/components/product-form.tsx`

- [ ] **Step 1: Create the new component file**

Create `src/features/admin/inventory/components/product-form.tsx` with this import block:

```tsx
'use client';

import { useRef } from 'react';
import type { FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  type ProductCategory,
  type AttributeDTO,
} from '@/features/catalog';
import {
  buildFieldLayoutItems,
  coreFieldOptions,
  loadFieldLayoutConfig,
  type FieldLayoutItem,
} from '@/features/fields/field-layout';
import type { ProductFormDraft } from '@/features/admin/inventory/types';
import { ProductImage } from '@/features/admin/inventory/components/product-image';
import { valuesForCategory } from '@/features/admin/inventory/utils/product-draft';
import {
  categoryLabel,
  driveTypeLabel,
  fieldNameLabel,
  useI18n,
} from '@/lib/i18n';
```

- [ ] **Step 2: Add the exported `ProductForm` function**

Move the existing `ProductForm` function body from `src/features/admin/admin-inventory-view.tsx` into `product-form.tsx`.

Change only the function declaration from:

```tsx
function ProductForm({
```

to:

```tsx
export function ProductForm({
```

Keep the props, JSX, class names, labels, helper functions, and render logic exactly the same.

The exported component signature must remain:

```tsx
export function ProductForm({
  title,
  draft,
  attributes,
  onChange,
  onSubmit,
  onClose,
  canChangeCategory,
  isSaving,
  canUploadImage,
  isUploadingImage,
  onImageFileSelected,
}: {
  title: string;
  draft: ProductFormDraft;
  attributes: AttributeDTO[];
  onChange: (next: ProductFormDraft) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  canChangeCategory: boolean;
  isSaving: boolean;
  canUploadImage: boolean;
  isUploadingImage: boolean;
  onImageFileSelected: (file: File) => void | Promise<void>;
}) {
```

- [ ] **Step 3: Keep internal helper behavior unchanged**

Inside `ProductForm`, keep this existing draft image logic unchanged:

```tsx
const images = draft.images.length > 0 ? draft.images : draft.image ? [draft.image] : [];
const setImages = (nextImages: string[]) => {
  const normalized = nextImages.map((image) => image.trim()).filter(Boolean).slice(0, 5);
  onChange({ ...draft, images: normalized, image: normalized[0] ?? '' });
};
```

Keep this existing category change behavior unchanged:

```tsx
const changeCategory = (category: ProductCategory) => {
  onChange({
    ...draft,
    category,
    type: category === 'Parts' ? 'Manual' : draft.type,
    values: valuesForCategory(draft.values, category, attributes),
  });
};
```

- [ ] **Step 4: Do not add new behavior**

Do not add memoization, new props, new helper files, new labels, new validation, new UI states, or new error handling in this extraction.

## Task 3: Update Admin Inventory Coordinator

**Files:**
- Modify: `src/features/admin/admin-inventory-view.tsx`

- [ ] **Step 1: Import the extracted form**

Add this import near the other inventory component imports:

```tsx
import { ProductForm } from '@/features/admin/inventory/components/product-form';
```

- [ ] **Step 2: Remove the local `ProductForm` function**

Delete the local `ProductForm` function from `src/features/admin/admin-inventory-view.tsx`, starting at:

```tsx
function ProductForm({
```

and ending at the final closing brace of that function.

Keep these existing render calls unchanged:

```tsx
<ProductForm
  title={t('inventory.addProduct')}
  draft={createDraft}
  attributes={attributes}
  onChange={setCreateDraft}
  onSubmit={submitCreate}
  onClose={() => setShowCreate(false)}
  canChangeCategory
  isSaving={workingKey === 'create'}
  canUploadImage={canUploadToStorage}
  isUploadingImage={workingKey === 'upload:create'}
  onImageFileSelected={(file) => uploadImageIntoDraft('create', file)}
/>
```

and:

```tsx
<ProductForm
  title={t('inventory.editProduct')}
  draft={editDraft}
  attributes={attributes}
  onChange={setEditDraft}
  onSubmit={submitEdit}
  onClose={() => setEditProductId(null)}
  canChangeCategory={false}
  isSaving={workingKey === 'edit'}
  canUploadImage={canUploadToStorage}
  isUploadingImage={workingKey === 'upload:edit'}
  onImageFileSelected={(file) => uploadImageIntoDraft('edit', file)}
/>
```

- [ ] **Step 3: Remove imports used only by the moved form**

After deleting the local form, remove imports from `admin-inventory-view.tsx` only if they are no longer used there:

```tsx
useRef
type ProductCategory
type FieldLayoutItem
buildFieldLayoutItems
loadFieldLayoutConfig
```

Keep these imports if the coordinator still uses them:

```tsx
type FormEvent
type KeyboardEvent
Loader2
X
type AttributeDTO
coreFieldOptions
categoryLabel
driveTypeLabel
fieldNameLabel
reservationSourceLabel
useI18n
```

At the time of writing this plan, `coreFieldOptions`, `categoryLabel`, `driveTypeLabel`, and `fieldNameLabel` are still used by the coordinator outside `ProductForm`, so they should stay.

## Task 4: Verify Extraction

**Files:**
- Verify only

- [ ] **Step 1: Check the expected file list**

Run:

```powershell
git status --short --untracked-files=all
```

Expected changed files should include:

```text
 M src/features/admin/admin-inventory-view.tsx
?? docs/plans/2026-05-27-admin-inventory-safe-extraction.md
?? docs/plans/2026-05-29-admin-inventory-product-form-extraction.md
?? src/features/admin/inventory/components/product-form.tsx
?? src/features/admin/inventory/components/product-image.tsx
?? src/features/admin/inventory/components/reservation-customer-summary.tsx
?? src/features/admin/inventory/components/status-badge.tsx
?? src/features/admin/inventory/constants.ts
?? src/features/admin/inventory/types.ts
?? src/features/admin/inventory/utils/api-errors.ts
?? src/features/admin/inventory/utils/date.ts
?? src/features/admin/inventory/utils/inventory-copy.ts
?? src/features/admin/inventory/utils/money.ts
?? src/features/admin/inventory/utils/product-draft.ts
```

No `.superpowers` files should appear.

- [ ] **Step 2: Run structure baseline**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
```

Expected:

```text
Structure baseline verification passed.
```

- [ ] **Step 3: Check whitespace**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

Git may print an LF/CRLF warning for existing files. That warning is acceptable if the command exits with code `0`.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected:

```text
✓ Compiled successfully
✓ Linting and checking validity of types
```

## Manual Smoke Check

After automated verification passes, open the admin inventory UI and confirm:

1. Active admin inventory loads.
2. Create product modal opens.
3. Edit product modal opens.
4. Product image previews still render in create and edit forms.
5. Upload image button still opens the file picker when upload is enabled.
6. Remove, remove all, and make primary image buttons still behave the same.
7. Category, drive type, serial, price, stock, discount, image, description, and custom fields still appear in the same order.
8. Save and cancel buttons remain sticky at the bottom of the form.

## Self-Review

Spec coverage:

- Extracts only `ProductForm`: covered by Task 2 and Task 3.
- Keeps coordinator behavior in `admin-inventory-view.tsx`: covered by Expected File Responsibilities and Task 3.
- Keeps UI and behavior unchanged: covered by Scope, Task 2, Task 3, and Manual Smoke Check.
- Avoids filters/product cards/modals/hooks/API extraction: covered by Scope.
- Verifies structure, whitespace, and build: covered by Task 4.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified implementation steps are included.

Type consistency:

- `ProductFormDraft`, `AttributeDTO`, `ProductCategory`, `FieldLayoutItem`, and `FormEvent` match the current component usage.

## Approval Checkpoint

This plan is ready for review. Choose the next step:

```text
A. Implement this ProductForm extraction plan now.
B. Adjust the plan first.
C. Stop here.
```
