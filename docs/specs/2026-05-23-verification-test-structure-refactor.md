# Verification Test Structure Refactor Spec

## Problem

The project already has useful verification scripts in `docs/tests`, but verification rules are still scattered across individual specs and manual notes.

Current verification scripts:

- `docs/tests/verify-mobile-filter-panel.mjs`
- `docs/tests/verify-mobile-visual-polish.mjs`
- `docs/tests/verify-product-form-actions.mjs`
- `docs/tests/verify-reservation-api-refactor.mjs`
- `docs/tests/verify-reservation-modal-safety.mjs`
- `docs/tests/verify-reservation-service-ownership.mjs`

The new structure specs also introduce several future guards:

- i18n dictionary guard
- repository structure guard
- shared UI import-boundary guard
- backend service boundary guard
- max-file-size guard
- cross-spec conflict guard

Without one shared verification structure, each refactor can accidentally choose a different definition of "done."

## Goal

Create one verification structure for all upcoming refactors.

Every implementation plan should define:

- the baseline checks to run before changing code
- the static guards to add or update
- the build command to run
- the manual smoke checks to perform
- the cross-spec conflict checks to revisit

This is a verification structure refactor, not an app behavior change.

## Current Code Shape

Existing verification location:

```txt
docs/tests/
```

Existing planning/spec locations:

```txt
docs/specs/
docs/plans/
docs/audits/
```

Existing build command:

```powershell
npm run build
```

Existing structure specs that need shared verification:

- `docs/specs/2026-05-22-admin-inventory-structure-refactor.md`
- `docs/specs/2026-05-22-admin-fields-structure-refactor.md`
- `docs/specs/2026-05-22-public-shop-structure-refactor.md`
- `docs/specs/2026-05-22-admin-support-pages-structure-refactor.md`
- `docs/specs/2026-05-22-auth-access-pages-structure-refactor.md`
- `docs/specs/2026-05-22-api-backend-service-structure-refactor.md`
- `docs/specs/2026-05-22-i18n-dictionary-structure-refactor.md`
- `docs/specs/2026-05-23-shared-ui-component-structure-refactor.md`
- `docs/specs/2026-05-23-repository-data-adapter-structure-refactor.md`

## Target Structure

Keep verification scripts in `docs/tests`:

```txt
docs/tests/
  verify-structure-boundaries.mjs
  verify-max-file-lines.mjs
  verify-i18n-dictionaries.mjs
  verify-repository-structure.mjs
  verify-shared-ui-boundaries.mjs
  verify-backend-service-boundaries.mjs
```

Keep human review outputs in `docs/audits`:

```txt
docs/audits/
  2026-05-23-structure-spec-conflict-audit.md
```

Use implementation plans to list the exact subset of checks required for each task.

## Verification Layers

Layer 1: Spec review.

- Check for incomplete markers, incomplete sections, and vague requirements.
- Check that scope, non-goals, and acceptance criteria agree.
- Check that the spec does not conflict with another active structure spec.

Layer 2: Static boundary guards.

- Verify imports match the intended architecture.
- Verify compatibility wrappers are re-exports after migration.
- Verify shared UI does not import feature DTOs, server code, or Supabase clients.
- Verify client repositories do not import server services or Supabase admin clients.
- Verify server services do not move into client component paths.

Layer 3: Static size guards.

- Track files that were intentionally split.
- Fail if a refactored page, feature view, route, or component grows past the agreed size limit.
- Allow explicit exceptions only when a spec or plan names the exception.

Layer 4: Build verification.

- Run `npm run build`.
- Treat build failures as blockers unless the implementation plan has already marked them as pre-existing.

Layer 5: Domain-specific guards.

- Reservation refactors run reservation API and ownership guards.
- i18n refactors run dictionary parity and duplicate-key guards.
- repository refactors run repository import-boundary guards.
- backend refactors run server service boundary guards.
- shared UI refactors run shared UI import and accessibility guards.

Layer 6: Manual smoke checks.

- Run the manual checklist from the spec being implemented.
- For UI-identical refactors, compare visible behavior before and after.
- For admin/customer flows, verify the route still renders and the main action still works.

Layer 7: Supabase/database checks.

- Structure refactors do not change schema, RLS, policies, triggers, storage buckets, or migrations.
- If a task requires a database change, stop and create a separate database spec and migration plan.
- Supabase behavior changes require current Supabase documentation checks before implementation.

## Cross-Spec Conflict Rules

Every implementation plan should check these ownership boundaries:

```txt
src/app/* page files
  owned by page structure specs; should become small wrappers.

src/features/*/<feature components>
  owned by feature/page structure specs; can use shared UI primitives.

src/components/ui/*
  owned by shared UI spec; generic only, no domain DTO imports.

src/features/*/repositories and src/features/*/adapters
  owned by repository/data adapter spec; client-facing only.

src/server/*
  owned by API backend service spec; server-only direct Supabase access.

src/lib/i18n/dictionaries/*
  owned by i18n dictionary spec.

docs/tests/*
  owned by verification structure spec and specific task plans.
```

Conflict policy:

- If two specs mention the same file path, the more specific feature/domain spec owns the implementation details.
- If a shared spec and a feature spec overlap, the shared spec owns generic primitives and the feature spec owns domain-specific composition.
- If repository and backend specs overlap, repository specs own client adapters and backend specs own server services.
- If a refactor needs to cross a non-goal boundary, create a separate spec before implementation.

## Proposed Static Guards

`verify-structure-boundaries.mjs`

- checks broad import boundaries across `src/app`, `src/features`, `src/components/ui`, and `src/server`
- reports possible cross-layer imports before build

`verify-max-file-lines.mjs`

- checks page, component, hook, route, service, and dictionary size limits after refactors
- uses an allowlist for intentionally large compatibility files during migration

`verify-i18n-dictionaries.mjs`

- checks locale parity for `en`, `ru`, and `ka`
- checks duplicate keys
- checks merged dictionary key count during migration

`verify-repository-structure.mjs`

- checks repository interfaces do not import React
- checks API adapters do not import `src/server`
- checks API adapters do not import Supabase admin clients
- checks hooks do not import `mockRuntimeStore`

`verify-shared-ui-boundaries.mjs`

- checks `src/components/ui` does not import feature DTOs, API routes, server services, or Supabase clients
- checks shared interactive controls expose accessible labels where required

`verify-backend-service-boundaries.mjs`

- checks `src/server` modules stay server-only
- checks route files stay thin after migration
- checks compatibility service files are re-exports after migration

## Non-Goals

- Do not introduce a full test framework in this pass.
- Do not add Playwright, Vitest, Jest, Cypress, or Storybook in this pass.
- Do not require every manual smoke check to be automated immediately.
- Do not change app behavior.
- Do not change API routes.
- Do not change database schema, RLS, policies, triggers, storage buckets, or migrations.
- Do not block implementation on guards that require files not created yet; add guards in the same implementation pass that creates the relevant structure.

## Acceptance Criteria

- A verification structure spec exists and is referenced by future implementation plans.
- Each structure implementation plan includes baseline, static, build, and manual checks.
- Cross-spec conflict checks are documented.
- Static guard names and responsibilities are defined.
- Existing verification scripts remain valid.
- `npm run build` remains the required build verification command.
- No app code changes are required by this spec alone.

## Verification

Run documentation checks with the standard wording scan used for structure specs.

```powershell
node docs\tests\verify-spec-wording.mjs docs\specs\2026-05-23-verification-test-structure-refactor.md
```

After guard scripts are implemented, standard verification should become:

```powershell
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-i18n-dictionaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-shared-ui-boundaries.mjs
node docs\tests\verify-backend-service-boundaries.mjs
npm run build
```
