# Repository Data Adapter Structure Refactor Spec

## Problem

The app already has a useful repository pattern, but the boundaries are not fully documented or standardized across features.

Current feature domains with repositories:

- `src/features/catalog`
- `src/features/fields`
- `src/features/reservations`
- `src/features/reports`

Each domain generally has:

- `dto/`
- `domain/` where needed
- `repositories/<domain>-repository.ts`
- `repositories/<domain>-repository.factory.ts`
- `repositories/use-<domain>-data.ts`
- `adapters/mock/<domain>-repository.mock.ts`
- `adapters/supabase/<domain>-repository.supabase.ts`

This works, but there are some structure issues:

- API response parsing is duplicated in multiple Supabase adapters.
- repository factories duplicate source selection and missing-env fallback behavior.
- the folder name `adapters/supabase` is slightly misleading because these adapters call Next API routes with `fetch`; they do not directly query Supabase.
- mock adapters share `src/features/mock-runtime/store.ts`, but the ownership rules for mock state are not written down.
- hooks, repositories, adapters, DTOs, and domain validation need clearer boundaries before larger refactors start.

## Goal

Define a consistent data access structure for frontend feature code while keeping runtime behavior exactly the same.

This is a structure refactor, not a data behavior redesign.

## Current Code Shape

Catalog:

- `src/features/catalog/dto/catalog-dto.ts`
- `src/features/catalog/domain/catalog-validation.ts`
- `src/features/catalog/domain/catalog-discount.ts`
- `src/features/catalog/repositories/catalog-repository.ts`
- `src/features/catalog/repositories/catalog-repository.factory.ts`
- `src/features/catalog/repositories/use-catalog-data.ts`
- `src/features/catalog/adapters/mock/catalog-repository.mock.ts`
- `src/features/catalog/adapters/supabase/catalog-repository.supabase.ts`

Fields:

- `src/features/fields/dto/field-dto.ts`
- `src/features/fields/repositories/field-repository.ts`
- `src/features/fields/repositories/field-repository.factory.ts`
- `src/features/fields/repositories/use-field-data.ts`
- `src/features/fields/adapters/mock/field-repository.mock.ts`
- `src/features/fields/adapters/supabase/field-repository.supabase.ts`

Reservations:

- `src/features/reservations/dto/reservation-dto.ts`
- `src/features/reservations/dto/reservation-comment-context.ts`
- `src/features/reservations/repositories/reservation-repository.ts`
- `src/features/reservations/repositories/reservation-repository.factory.ts`
- `src/features/reservations/repositories/use-reservation-data.ts`
- `src/features/reservations/adapters/mock/reservation-repository.mock.ts`
- `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`

Reports:

- `src/features/reports/dto/report-dto.ts`
- `src/features/reports/domain/report-date-range.ts`
- `src/features/reports/repositories/report-repository.ts`
- `src/features/reports/repositories/report-repository.factory.ts`
- `src/features/reports/repositories/use-report-data.ts`
- `src/features/reports/adapters/mock/report-repository.mock.ts`
- `src/features/reports/adapters/supabase/report-repository.supabase.ts`

Shared support:

- `src/features/mock-runtime/store.ts`
- `src/features/shared/domain/errors.ts`
- `src/features/shared/freshness/invalidation.ts`
- `src/features/shared/freshness/use-focus-freshness.ts`
- `src/lib/feature-flags.ts`
- `src/lib/auth/request-headers.ts`
- `src/lib/supabase/client.ts`

## Target Structure

Keep the existing feature-first layout, but standardize each data-backed feature:

```txt
src/features/<feature>/
  dto/
    <feature>-dto.ts
  domain/
    <feature>-domain-files.ts
  repositories/
    <feature>-repository.ts
    <feature>-repository.factory.ts
    use-<feature>-data.ts
  adapters/
    api/
      <feature>-repository.api.ts
    mock/
      <feature>-repository.mock.ts
```

Add shared client-data helpers:

```txt
src/features/shared/data/
  api-response.ts
  data-source.ts
  repository-cache.ts
```

Keep compatibility re-export files during migration:

```txt
src/features/<feature>/adapters/supabase/<feature>-repository.supabase.ts
```

Those compatibility files should re-export the new `adapters/api` implementations until all imports move.

## Naming Rules

Use these terms consistently:

- `dto`: app-facing data shapes used by UI and API responses.
- `domain`: pure business rules, validation, date math, and formatting that do not depend on React or network calls.
- `repository`: feature-facing interface that UI code depends on.
- `api adapter`: client/browser implementation that calls Next API routes with `fetch`.
- `mock adapter`: client/browser implementation backed by `mockRuntimeStore`.
- `server service`: server-only implementation that queries Supabase admin client. This belongs to the backend structure spec under `src/server/`, not frontend feature adapters.

The current `supabase` adapter name should be treated as a compatibility name. Its actual responsibility is API-route fetching, not direct Supabase access.

## Responsibility Rules

Repository interfaces:

- define the feature-facing contract
- import DTO/domain types only
- do not import React
- do not import Next route handlers
- do not import Supabase clients

Repository factories:

- select mock or API adapter from feature flags
- cache one repository per active data source
- handle missing public Supabase env fallback consistently
- do not contain request-specific business logic

API adapters:

- call `/api/...` routes with `fetch`
- use `getAuthHeaders()` and `getJsonAuthHeaders()`
- parse API envelopes consistently
- throw shared domain errors such as `AdapterError` and `ValidationError`
- do not import `getServerSupabaseAdminClient()`
- do not import server services

Mock adapters:

- use `mockRuntimeStore`
- clone returned DTOs to avoid accidental shared mutation
- mirror API adapter behavior closely enough for local/demo use
- keep mock-only helpers private unless another mock adapter needs them

Hooks:

- are React client hooks and keep `"use client"`
- own loading, refreshing, stale, error, and reload state
- use repositories through factories
- use freshness invalidation helpers when the feature already exposes stale or background refresh state
- do not directly call `fetch`
- do not import mock runtime store

DTO files:

- define transport-safe app data shapes
- do not import React
- do not import Supabase clients
- do not import repository factories

Domain files:

- contain pure functions
- do not depend on React, browser APIs, API routes, or Supabase clients

## Shared Data Helpers

`api-response.ts`

- owns the common `ApiResponse<T>` type
- owns response JSON parsing
- owns detail-message extraction
- produces consistent `AdapterError` messages

`data-source.ts`

- centralizes data source resolution for catalog, fields, reservations, and reports
- keeps `mock` and `supabase` source names compatible with existing env vars
- keeps missing-env warnings consistent

`repository-cache.ts`

- provides a small helper for caching repository instances by source
- prevents every factory from reimplementing the same cache shape

## Supabase Guardrails

- Client feature adapters must not use Supabase service role keys.
- Client feature adapters must not import `getServerSupabaseAdminClient()`.
- Direct Supabase database reads/writes belong in server services, not feature adapters.
- Public env checks stay client-side through `hasSupabasePublicEnv()` unless a separate backend spec changes that boundary.
- Do not change RLS policies, grants, triggers, storage policies, or migrations in this refactor.
- If a repository change requires schema or policy changes, stop and create a separate database spec first.

## Refactor Approach

Use careful extraction in layers.

Layer 1: Add shared data helpers.

- Add shared API envelope parsing.
- Add shared data-source/fallback helper.
- Add shared repository cache helper.
- Keep all existing repository APIs unchanged.

Layer 2: Standardize API adapters.

- Move duplicated `ApiResponse<T>` and detail parsing into shared helpers.
- Keep request URLs, methods, headers, and error messages behavior-compatible.
- Keep `adapters/supabase` compatibility files as re-exports if moving to `adapters/api`.

Layer 3: Standardize factories.

- Replace repeated source selection and cache logic with shared helpers.
- Preserve existing env variable behavior:
  - `NEXT_PUBLIC_DATA_SOURCE`
  - `NEXT_PUBLIC_CATALOG_DATA_SOURCE`
  - `NEXT_PUBLIC_RESERVATION_DATA_SOURCE`
  - `NEXT_PUBLIC_FIELD_DATA_SOURCE`
  - `NEXT_PUBLIC_REPORT_DATA_SOURCE`

Layer 4: Standardize hooks.

- Keep each hook small and feature-specific.
- Align return shapes where useful: `isLoading`, `isRefreshing`, `error`, `reload`, `isStale`, `lastRefreshAt`.
- Do not force all hooks to expose freshness fields if the feature does not need them.

Layer 5: Add static guards.

- Verify feature adapters do not import server-only Supabase clients.
- Verify repository interfaces do not import React.
- Verify hooks do not import mock runtime store.
- Verify `adapters/api` do not import `src/server`.

## Non-Goals

- Do not change API route URLs.
- Do not change request payloads or response DTO shapes.
- Do not change frontend page behavior.
- Do not change database schema, RLS, policies, triggers, storage buckets, or migrations.
- Do not introduce React Query, SWR, Redux, Zustand, or another data library in this pass.
- Do not rewrite mock data behavior.
- Do not move server services into feature folders.
- Do not remove mock mode.

## Acceptance Criteria

- Catalog, fields, reservations, and reports follow the same repository/adapters/factory/hook layout.
- API response parsing duplication is removed.
- data-source fallback behavior is centralized.
- repository factory caching behavior is centralized or consistently implemented.
- current imports continue to work through compatibility re-exports during migration.
- client adapters do not import server-only Supabase code.
- hooks do not import mock runtime store directly.
- DTO and domain files stay framework-independent.
- `npm run build` passes.

## Verification

Run automated checks:

```powershell
npm run build
```

Add and run a repository structure guard:

```powershell
node docs\tests\verify-repository-structure.mjs
```

The guard should verify:

```text
1. `src/features/*/repositories/*-repository.ts` files do not import React.
2. `src/features/*/adapters/api/*.ts` files do not import `src/server`.
3. `src/features/*/adapters/api/*.ts` files do not import `getServerSupabaseAdminClient`.
4. `src/features/*/repositories/use-*.ts` files do not import `mockRuntimeStore`.
5. compatibility `adapters/supabase` files are re-exports after the API adapter move.
```

Run manual smoke checks:

```text
1. Run in mock data mode and open public shop, admin inventory, fields, reports, and reservations.
2. Run in Supabase-backed mode and open the same screens.
3. Create/edit a product.
4. Create/edit a field.
5. Reserve/cancel a reservation.
6. Open reports.
7. Confirm loading, error, refresh, and stale indicators behave as before.
```

## Follow-Up Candidates

After this pass is complete and verified:

- Add lightweight test doubles for repository interfaces.
- Consider typed error codes for repository failures.
- Consider query caching only after the structure refactor is stable and verified.
