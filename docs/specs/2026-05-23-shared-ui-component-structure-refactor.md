# Shared UI Component Structure Refactor Spec

## Problem

The app has working UI, but many repeated interface patterns are still implemented inline inside pages and feature views:

- primary and secondary buttons
- icon buttons
- text inputs, selects, textareas, and field labels
- modal overlays and modal panels
- sticky modal action footers
- loading indicators with `Loader2`
- success, warning, and error alerts
- empty/loading states
- status badges
- stat/count cards
- product image frames and fallback image handling

Some shared components already exist:

- `src/components/bike-city-logo.tsx`
- `src/features/catalog/components/price-display.tsx`
- `src/features/reservations/components/reservation-comment-editor.tsx`

But most repeated UI still lives directly in files like:

- `src/features/admin/admin-inventory-view.tsx`
- `src/app/admin/fields/page.tsx`
- `src/app/page.tsx`
- `src/app/shop/[id]/page.tsx`
- `src/app/admin/staff/page.tsx`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/login/login-form.tsx`
- `src/app/reset-password/page.tsx`

This makes UI fixes harder because button, modal, input, and alert behavior can drift across screens.

## Goal

Create a small shared UI component layer that removes duplication while keeping the visible UI and behavior exactly the same.

This is a structure refactor, not a visual redesign.

## Current Code Shape

Current global styling lives in:

- `src/app/globals.css`

Important existing global classes:

- `.brand-primary`
- `.brand-control`
- `.brand-filter-panel`
- `.brand-sidebar`
- `.brand-sidebar-active`
- `.brand-cyan-action`
- `.btn-primary`
- `.btn-dark`
- `.card`

Current shared components:

- `src/components/bike-city-logo.tsx`
- `src/features/catalog/components/price-display.tsx`
- `src/features/reservations/components/reservation-comment-editor.tsx`

Current repeated inline patterns:

- buttons with `brand-primary`, `brand-control`, danger, success, and neutral variants
- modal overlay structure using `fixed inset-0`
- modal panels with scroll bounds and rounded white containers
- sticky modal footers for cancel/save actions
- repeated `Loader2` spinner rendering
- repeated rose/emerald/amber/sky alert panels
- repeated empty state panels
- repeated form controls with `h-11`, `rounded-xl`, and border classes
- repeated product image wrappers with fallback images

## Target Structure

Create a shared UI folder for generic app primitives:

```txt
src/components/
  bike-city-logo.tsx
  ui/
    alert.tsx
    badge.tsx
    button.tsx
    card.tsx
    empty-state.tsx
    form-control.tsx
    icon-button.tsx
    image-frame.tsx
    index.ts
    loading-indicator.tsx
    modal.tsx
    modal-actions.tsx
    stat-card.tsx
    toolbar.tsx
```

Keep domain-specific components in feature folders:

```txt
src/features/catalog/components/price-display.tsx
src/features/reservations/components/reservation-comment-editor.tsx
src/features/admin/inventory/components/...
src/features/fields/settings/components/...
src/features/shop/public/components/...
```

Shared UI components should be generic. They should not import catalog, reservation, field, report, staff, auth, or Supabase domain types.

## Component Responsibilities

`button.tsx`

- shared button shell for primary, secondary/control, neutral, danger, success, and ghost-style buttons
- supports icons, loading state, disabled state, `type`, `onClick`, and `className`
- preserves current classes when replacing inline buttons

`icon-button.tsx`

- compact button for close, edit, delete, refresh, drag, and similar icon actions
- requires accessible label

`form-control.tsx`

- shared input/select/textarea wrappers and label/help/error text primitives
- does not own form state

`modal.tsx`

- shared overlay, scroll container, panel, header, and close action structure
- preserves current fixed overlay behavior
- supports sticky footer composition through `modal-actions.tsx`

`alert.tsx`

- success, error, warning, info, and neutral message panels
- supports dismiss action when needed

`loading-indicator.tsx`

- inline spinner and loading row primitives using `Loader2`

`empty-state.tsx`

- reusable empty or loading state panel shell

`badge.tsx`

- generic visual badge primitive
- domain-specific label logic remains in feature components

`card.tsx`

- generic panel/card shell for existing white bordered panels
- should preserve current rounded and border classes when replacing inline markup

`stat-card.tsx`

- small count/metric card used by inventory, reports, and dashboard-like screens

`toolbar.tsx`

- generic responsive toolbar shell for search, filters, and action buttons

`image-frame.tsx`

- generic visual frame for images
- does not decide catalog fallback images; domain components still provide image src and alt text

## Refactor Approach

Use careful extraction in layers.

Layer 1: Add zero-behavior primitives.

- Add `LoadingIndicator`, `Alert`, `Button`, `IconButton`, and `ModalActions`.
- Do not replace large areas yet.
- Match existing Tailwind class output.

Layer 2: Replace repeated low-risk markup.

- Replace repeated spinners.
- Replace repeated alert panels.
- Replace repeated basic buttons where class output can remain identical.

Layer 3: Extract modal shell.

- Replace repeated modal overlay and panel wrappers.
- Preserve sticky action footers and current scroll behavior.
- Keep modal form state in feature components.

Layer 4: Extract form and panel primitives.

- Introduce shared form controls and card/panel shells.
- Replace repeated form wrappers only where props stay simple.

Layer 5: Use shared UI during page/component splits.

- As admin inventory, fields, public shop, auth, and support pages are split, use the shared primitives when they reduce duplication without changing UI.

## Non-Goals

- Do not redesign the app.
- Do not change colors, spacing, radius, typography, text, or button placement.
- Do not introduce a new UI library.
- Do not install shadcn or another component package in this pass.
- Do not move domain-specific components into `src/components/ui`.
- Do not move business state into shared UI components.
- Do not change route behavior, API calls, database logic, or Supabase behavior.
- Do not normalize all historical CSS classes in one pass.

## Acceptance Criteria

- Shared UI components live under `src/components/ui/`.
- Generic shared UI components do not import feature DTOs or server code.
- Domain-specific components remain under their feature folders.
- Replaced UI looks the same before and after the refactor.
- Modal buttons remain visible and sticky where they are currently sticky.
- Existing `brand-*` global classes continue to work.
- Page and feature refactors can import shared primitives without circular dependencies.
- `npm run build` passes.

## Verification

Run automated checks:

```powershell
npm run build
```

Add static guards during implementation:

```text
1. Shared UI files under `src/components/ui/` must not import from `src/app/api`.
2. Shared UI files under `src/components/ui/` must not import feature DTOs.
3. Shared UI files under `src/components/ui/` must not import Supabase clients.
4. Modal components must expose accessible labels for close/cancel actions.
```

Run manual smoke checks:

```text
1. Open admin inventory and verify buttons, modals, alerts, and empty states.
2. Open admin fields and verify modals, controls, drag controls, and action buttons.
3. Open public shop and product detail pages and verify cards/images/buttons.
4. Open login and reset-password pages and verify form controls/buttons.
5. Open staff, reports, reservations, and settings pages and verify panels/forms/buttons.
6. Confirm visible layout matches current behavior.
```

## Follow-Up Candidates

After this pass is complete and verified:

- Add a small Storybook-like local preview only if the app needs visual component review.
- Add a static max-lines guard for shared components.
- Move `bike-city-logo.tsx` into a `src/components/brand/` folder only if more brand components are added.

