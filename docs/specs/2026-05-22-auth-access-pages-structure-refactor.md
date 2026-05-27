# Auth Access Pages Structure Refactor Spec

## Problem

Auth and access pages are mostly smaller than admin inventory, but some implementation details still live directly in app route areas:

- `src/app/login/login-form.tsx` is about 417 lines.
- `src/app/reset-password/page.tsx` is about 203 lines.
- `src/app/login/page.tsx` and `src/app/register/page.tsx` are already small wrappers.

The login and password recovery flows are important user entry points, so their state and helper code should be organized before more auth behavior is added.

## Goal

Move auth form implementations into focused feature files while keeping the visible UI and behavior exactly the same.

This is a structure refactor, not a redesign.

## Current Code Shape

Primary files:

- `src/app/login/login-form.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`

Existing nearby feature code:

- `src/features/auth/auth-provider.tsx`
- `src/features/auth/index.ts`
- `src/lib/auth/server.ts`
- `src/lib/auth/request-headers.ts`
- `src/lib/auth/app-role.ts`

Current responsibilities:

- login form owns input state, submit state, Supabase auth calls, error display, password visibility, reset email flow, and form UI
- reset password page owns recovery URL parsing, password update state, submit handling, and form UI
- login/register route files already mostly act as wrappers

## Target Structure

Create focused auth access feature files:

```txt
src/features/auth/access/
  login-form.tsx
  reset-password-view.tsx
  types.ts
  components/
    auth-card.tsx
    password-field.tsx
    auth-alert.tsx
  hooks/
    use-login-form.ts
    use-password-reset.ts
  utils/
    recovery-url.ts
    auth-errors.ts
```

Then reduce app route files to wrappers:

```txt
src/app/login/login-form.tsx
src/app/reset-password/page.tsx
```

The old login form path may temporarily re-export from `src/features/auth/access/login-form.tsx` if that reduces risk.

## Refactor Approach

Use careful extraction in layers.

Layer 1: Extract pure helpers and shared small components.

- Move recovery URL parsing into `utils/recovery-url.ts`.
- Move repeated error normalization into `utils/auth-errors.ts` when the same parsing logic appears in both login and reset-password flows.
- Move reusable password input and alert UI into components.

Layer 2: Extract state hooks.

- `use-login-form.ts` owns login input state, login submit, reset email submit, loading state, and error/success messages.
- `use-password-reset.ts` owns recovery validation, password input state, password update submit, loading state, and error/success messages.

Layer 3: Move visual forms into feature views.

- Move the login form implementation into `src/features/auth/access/login-form.tsx`.
- Move reset password implementation into `src/features/auth/access/reset-password-view.tsx`.
- Keep route files small and route-focused.

## Non-Goals

- Do not change visible UI.
- Do not change login behavior.
- Do not change password reset behavior.
- Do not change Supabase auth configuration.
- Do not change route URLs.
- Do not change database schema, Supabase policies, or migrations.
- Do not refactor admin or public shop pages in this pass.

## Acceptance Criteria

- Login page looks and behaves the same.
- Register page route behavior is unchanged.
- Password reset page looks and behaves the same.
- Existing route URLs are unchanged.
- Auth implementation code lives under `src/features/auth/access/`.
- App route files remain small wrappers or compatibility re-exports.
- `npm run build` passes.

## Verification

Run automated checks:

```powershell
npm run build
```

Run manual smoke checks:

```text
1. Open login page.
2. Submit invalid credentials and confirm error behavior.
3. Trigger reset email flow.
4. Open reset-password page with and without recovery parameters.
5. Confirm visible layouts match the current UI.
```
