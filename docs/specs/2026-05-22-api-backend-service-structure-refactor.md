# API Backend Service Structure Refactor Spec

## Problem

The API layer works, but several backend files have grown too large and carry too many responsibilities:

- `src/app/api/catalog/catalog-service.ts` is about 974 lines.
- `src/app/api/fields/field-service.ts` is about 639 lines.
- `src/app/api/reservations/reservation-service.ts` is about 462 lines.
- `src/app/api/reports/route.ts` is about 343 lines.
- `src/app/api/staff/route.ts` is about 258 lines.
- `src/app/api/catalog/bulk/route.ts` is about 233 lines.

These files mix route handling, Supabase row types, SQL select strings, mapping, validation, storage cleanup, fallback schema compatibility, business actions, and response shaping.

That makes backend changes harder to reason about. A small catalog change can require reading image storage code, attribute value sync, reservation status sync, discount parsing, and route behavior at the same time.

## Goal

Create a clear backend service structure where:

- API route files stay thin.
- backend service files are split by responsibility.
- Supabase row mapping is isolated from business actions.
- public API endpoints keep the same URLs and request/response behavior.
- no database schema, RLS, policy, or migration changes are made in this refactor.

This is a structure refactor, not a backend behavior redesign.

## Current Code Shape

Primary backend service files:

- `src/app/api/catalog/catalog-service.ts`
- `src/app/api/fields/field-service.ts`
- `src/app/api/reservations/reservation-service.ts`
- `src/app/api/settings/settings-service.ts`

Route files with heavier backend logic:

- `src/app/api/reports/route.ts`
- `src/app/api/staff/route.ts`
- `src/app/api/staff/[id]/route.ts`
- `src/app/api/catalog/bulk/route.ts`
- `src/app/api/catalog/images/route.ts`

Current import relationships:

- catalog routes import `catalog-service`.
- field routes import `field-service`.
- reservation routes import `reservation-service`.
- shop bootstrap route imports catalog, fields, and settings services.
- catalog service imports field service.
- reservation service imports `getProductById()` from catalog service.
- reports and staff routes contain most of their backend logic directly inside route files.

## Target Structure

Create a dedicated server layer:

```txt
src/server/
  catalog/
    catalog-service.ts
    catalog-queries.ts
    catalog-writes.ts
    catalog-mappers.ts
    catalog-images.ts
    catalog-attribute-values.ts
    catalog-reservation-sync.ts
    catalog-selects.ts
    catalog-types.ts
  fields/
    field-service.ts
    field-queries.ts
    field-writes.ts
    field-mappers.ts
    field-options.ts
    field-compat.ts
    field-selects.ts
    field-types.ts
  reservations/
    reservation-service.ts
    reservation-queries.ts
    reservation-writes.ts
    reservation-mappers.ts
    reservation-lifecycle.ts
    reservation-selects.ts
    reservation-types.ts
  reports/
    report-service.ts
    report-queries.ts
    report-mappers.ts
    report-format.ts
    report-types.ts
  staff/
    staff-service.ts
    staff-queries.ts
    staff-writes.ts
    staff-mappers.ts
    staff-types.ts
  settings/
    settings-service.ts
    settings-mappers.ts
    settings-storage.ts
    settings-parse.ts
    settings-types.ts
  shared/
    api-error.ts
    route-auth.ts
```

Keep compatibility re-export files during migration:

```txt
src/app/api/catalog/catalog-service.ts
src/app/api/fields/field-service.ts
src/app/api/reservations/reservation-service.ts
src/app/api/settings/settings-service.ts
```

Those files should become small re-exports from `src/server/...` during the refactor, so existing route imports can be migrated safely.

## Responsibility Rules

Route files:

- parse request params and JSON bodies
- check request role/auth
- call server services
- return `NextResponse`
- map known errors to HTTP responses

Route files should not own:

- Supabase row types
- SQL select strings
- DTO mapping
- business validation
- storage cleanup rules
- cross-table status synchronization

Server service facade files:

- expose the public functions route files need
- coordinate query/write helpers
- preserve existing function names during migration

Query files:

- read from Supabase
- contain select strings or import them from `*-selects.ts`
- return mapped DTOs or row data for service internals

Write files:

- perform inserts, updates, deletes, and storage cleanup
- throw shared domain errors
- avoid response construction

Mapper files:

- convert Supabase rows to DTOs
- convert app DTO values to database values
- contain category/status/image fallback mapping

Compatibility files:

- isolate fallback behavior for missing live database columns while the project supports old database shapes
- keep schema compatibility checks out of core service logic

## Domain-Specific Structure

Catalog backend:

- `catalog-service.ts` remains the public facade for list, get, create, update, sell, archive, restore, clear archived, and critical-field updates.
- `catalog-images.ts` owns product image normalization, storage URL parsing, image row sync, and unused storage cleanup.
- `catalog-attribute-values.ts` owns item attribute value validation and sync.
- `catalog-reservation-sync.ts` owns fallback catalog status synchronization from reservations.
- `catalog-mappers.ts` owns category, drive type, discount, image, and row-to-product mapping.

Fields backend:

- `field-service.ts` remains the public facade for list, create, update, and archive field actions.
- `field-options.ts` owns option normalization and option sync.
- `field-compat.ts` owns legacy select fallback behavior for missing `sort_order`, `input_mode`, or translation columns.
- `field-mappers.ts` owns database row to field DTO mapping.

Reservations backend:

- `reservation-service.ts` remains the public facade for list, upsert, cancel, complete, and product-oriented reservation wrappers.
- `reservation-lifecycle.ts` owns active, cancelled, completed, and expired transition rules.
- `reservation-mappers.ts` owns reservation row to DTO mapping and fallback image mapping.
- `reservation-writes.ts` owns reservation row writes.
- `reservation-queries.ts` owns reservation row reads.

Reports backend:

- Move report data queries and aggregation out of `src/app/api/reports/route.ts`.
- `report-service.ts` should expose one route-facing report function.
- `report-mappers.ts` should own sale/reservation row mapping.
- `report-format.ts` should own report date bucket and trend shaping that is not already in `src/features/reports/domain/`.

Staff backend:

- Move staff profile list/create/update behavior out of route files.
- `staff-service.ts` should expose route-facing staff actions.
- `staff-mappers.ts` should map profile rows.
- `staff-writes.ts` should isolate role/status/profile writes.

Settings backend:

- Move settings mapping, local fallback storage, and parse helpers into dedicated files.
- `settings-service.ts` should remain the route-facing facade.

## Supabase Guardrails

- Do not expose service role keys to frontend code.
- Keep Supabase admin client usage server-only.
- Do not move server services into client component paths.
- Do not change RLS policies, grants, triggers, storage policies, or migrations in this refactor.
- If a future implementation step requires a Supabase schema or policy change, stop and create a separate database spec and migration plan first.
- Any future Supabase feature change must be checked against current Supabase documentation before implementation.

## Refactor Approach

Use careful extraction in layers.

Layer 1: Extract pure types, select strings, and mappers.

- Move row types into `*-types.ts`.
- Move select strings into `*-selects.ts`.
- Move row-to-DTO and DTO-to-db mapping into `*-mappers.ts`.
- Keep exported service functions unchanged.

Layer 2: Extract query/write helpers.

- Move Supabase reads into query files.
- Move Supabase writes into write files.
- Keep route imports unchanged through compatibility service files.

Layer 3: Extract specialized modules.

- Move catalog image sync into `catalog-images.ts`.
- Move catalog attribute value sync into `catalog-attribute-values.ts`.
- Move field option sync into `field-options.ts`.
- Move reservation lifecycle transitions into `reservation-lifecycle.ts`.

Layer 4: Move heavy route logic into services.

- Move reports route logic into `src/server/reports/`.
- Move staff route logic into `src/server/staff/`.
- Keep route files as request/response wrappers.

Layer 5: Update route imports.

- Route files should import directly from `src/server/...` after the matching compatibility wrapper has been reduced to a re-export and verified.
- Existing `src/app/api/*/*-service.ts` files can remain as re-export shims until every import has moved.

## Non-Goals

- Do not change public API endpoint URLs.
- Do not change request payloads.
- Do not change response DTO shapes.
- Do not change frontend repository APIs.
- Do not change Supabase schema or migrations.
- Do not change RLS, grants, storage bucket settings, or database triggers.
- Do not change business rules for catalog, fields, reservations, staff, reports, or settings.
- Do not introduce a new backend framework.

## Acceptance Criteria

- API routes continue to expose the same URLs.
- Existing frontend calls continue to work without payload changes.
- `src/app/api/catalog/catalog-service.ts` is reduced to a compatibility facade or replaced by a route-safe import path.
- `src/app/api/fields/field-service.ts` is reduced to a compatibility facade or replaced by a route-safe import path.
- `src/app/api/reservations/reservation-service.ts` is reduced to a compatibility facade or replaced by a route-safe import path.
- reports and staff route files become thin wrappers.
- Supabase row types and select strings are not mixed into route files.
- backend modules are grouped under `src/server/` by domain.
- `npm run build` passes.
- existing verification scripts continue to pass.

## Verification

Run automated checks:

```powershell
node docs\tests\verify-reservation-api-refactor.mjs
node docs\tests\verify-reservation-service-ownership.mjs
npm run build
```

Run manual smoke checks:

```text
1. List catalog products from admin inventory.
2. Create and edit a product.
3. Upload or keep existing product images.
4. Reserve and cancel a reservation.
5. Create or edit a custom field.
6. Open reports.
7. Open staff management.
8. Open settings and save a settings change.
9. Confirm public shop bootstrap still loads products, fields, and settings.
```

## Follow-Up Specs

After this backend structure spec, the remaining structure specs should cover:

- i18n dictionary structure
- shared UI component structure
- repository/data adapter structure
- verification and test structure
- database contract maintenance
