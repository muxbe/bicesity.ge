# Database Code Contract Audit

Date: 2026-05-17
Project: `bicesity.ge`
Supabase project ref: `blfjalavufthhsouifhq`

## Scope

This audit compares three contracts:

- Live Supabase metadata pasted from the Supabase SQL Editor.
- Local migrations under `supabase/migrations`.
- App code usage in `src/app/api`, `src/features`, and `src/lib/supabase`.

The audit intentionally did not read business rows, customer rows, product rows, staff rows, storage objects, or sales data. It only used schema metadata, policy metadata, function metadata, trigger metadata, and storage bucket metadata.

## User Decisions

- Live Supabase is the current business truth.
- Git migrations should catch up to live schema before behavior changes.
- Reservation writes should move to API-only server routes.
- Live `attribute_options` and `attributes.input_mode` should be preserved and added to Git migrations.
- `attributes.display_name_translations` should be added to live through the next planned migration.
- RLS should support public storefront reads and defensive staff access, while writes go through server APIs.
- Service-role usage should stay server-only and be documented with strict route-level role checks.
- The `product-images` bucket should stay public and documented.
- The live `public.rls_auto_enable` function was inspected on 2026-05-18; preserve and document it as an RLS safety guard, but keep it out of the first narrow schema-alignment migration.
- `sales.currency_code` should default to `GEL`.

## Summary

The live database and the local migration history have drifted. The app currently works against a schema contract that cannot be recreated from Git alone because live Supabase contains `attribute_options` and `attributes.input_mode`, while local migrations do not. At the same time, local migrations contain `attributes.display_name_translations`, but the pasted live metadata does not show that column.

The most important repair is to create a migration that makes a fresh database reproduce the app-required field schema, then normalize the small live/local drift items around translations, profile updated timestamps, sales currency, and RLS policy intent.

## Evidence

### Live Supabase Metadata

The pasted live metadata shows:

- `public.attribute_options` table exists.
- `public.attributes.input_mode` exists with default `'free_text'::text`.
- `public.attributes.display_name_translations` does not appear in the live column list.
- `public.product-images` storage bucket exists as `product-images`, public, 5 MB file limit, with JPEG, PNG, WebP, and AVIF MIME types.
- RLS is enabled for public tables including `attribute_options`, `attributes`, `catalog_items`, `reservations`, `sales`, `profiles`, and `app_settings`.
- Live policies are mostly public-read policies plus profile/app settings policies.
- Live functions include `public.rls_auto_enable`, which local migrations do not define.
- `public.rls_auto_enable()` is attached to enabled event trigger `ensure_rls` on `ddl_command_end`, owned by `postgres`. It enables RLS automatically on newly created tables in the `public` schema.
- Live triggers do not show `trg_profiles_set_updated_at`.
- Live `sales.currency_code` default is `'USD'::bpchar`.

### Local Migration Evidence

Local migrations create the core tables:

- `catalog_items`
- `bicycles`
- `parts`
- `attributes`
- `item_attribute_values`
- `product_images`
- `reservations`
- `sales`
- `audit_logs`
- `profiles`
- `app_settings`

Local migrations define `attributes.sort_order` and later add `attributes.display_name_translations`.

Local migrations do not define:

- `public.attribute_options`
- `public.attributes.input_mode`

Local migration `202604190007_profiles_and_staff_roles.sql` creates `trg_profiles_set_updated_at`, but the pasted live trigger list does not show it.

Local migration `202604130001_initial_schema.sql` sets `sales.currency_code` default to `GEL`, while live metadata shows `USD`.

### App Code Evidence

The app uses `attribute_options` in:

- `src/app/api/fields/field-service.ts`
- `src/app/api/catalog/catalog-service.ts`

The app uses `attributes.input_mode` in:

- `src/app/api/fields/field-service.ts`
- `src/app/api/catalog/catalog-service.ts`

The app expects `display_name_translations` in `src/app/api/fields/field-service.ts`, but it also has fallback handling for a missing column.

The app uses the server admin Supabase client in most API routes through `src/lib/supabase/admin.ts`, which requires `SUPABASE_SERVICE_ROLE_KEY`. This means RLS is not the main write enforcement mechanism for those routes. Route-level role checks must remain strict.

The reservation feature also has a browser-side Supabase repository in `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`. Since live `reservations` has RLS enabled and the pasted live policies do not include reservation policies, this path is a likely runtime risk when `NEXT_PUBLIC_RESERVATION_DATA_SOURCE=supabase`.

## Findings

### Finding 1: Git Cannot Recreate Live Field Options

Severity: High

Live has `public.attribute_options`, but local migrations do not create it. App code depends on this table for single-select custom fields and field option validation.

Impact: A fresh database created from Git migrations would not support the current app field UI.

Decision: Preserve live behavior and add a migration to recreate `attribute_options`.

### Finding 2: Git Cannot Recreate `attributes.input_mode`

Severity: High

Live has `public.attributes.input_mode`, but local migrations do not add it. App code depends on it to distinguish `free_text` and `single_select` fields.

Impact: A fresh database created from Git migrations would fail field and catalog validation paths that select or write `input_mode`.

Decision: Preserve live behavior and add a migration to add `attributes.input_mode`.

### Finding 3: Live Is Missing `attributes.display_name_translations`

Severity: Medium

Local migrations add `display_name_translations`, and app code tries to use it. The pasted live metadata does not show the column.

Impact: The app has fallback logic, so this is less urgent than `attribute_options`, but live and Git remain inconsistent. Multilingual field names are not fully represented live.

Decision: Add the column to live in the planned migration and backfill English labels from `display_name`.

### Finding 4: Reservation Browser Writes Are Not Aligned With Live RLS

Severity: High

The reservation Supabase repository writes from the browser client, while live `reservations` has RLS enabled and the pasted live policies do not include reservation policies.

Impact: Browser reservation operations may fail under the Supabase data-source configuration.

Decision: Move reservation writes to API-only server routes and keep RLS defensive.

### Finding 5: Live RLS Policies Drift From Local Migrations

Severity: Medium

Local migrations define many insert/update/select policies that are not visible in the pasted live policy metadata. Live instead shows public-read policies and app/profile policies.

Impact: The intended access model is unclear. Some paths work through service role, but the database policy story is not reproducible from Git.

Decision: Normalize policy intent after the API-only reservation decision: public storefront reads, staff writes through server APIs, and defensive RLS for exposed tables.

### Finding 6: Live `public.rls_auto_enable` Event Trigger Is Active

Severity: Medium

Live has a `security definer` function named `public.rls_auto_enable`, but local migrations do not define it. Follow-up metadata inspection on 2026-05-18 showed it is wired to enabled event trigger `ensure_rls` on `ddl_command_end`, owned by `postgres`.

Impact: The function is a security guard rather than business logic. It automatically enables RLS on new tables created in the `public` schema, which helps avoid accidentally exposing future tables without RLS.

Decision: Preserve and document it. Do not include it in the first schema-alignment migration because that migration should stay focused on app-contract drift. Recreate or normalize it later only as part of a dedicated RLS/security migration.

### Finding 7: Live Missing `trg_profiles_set_updated_at`

Severity: Low

Local migrations create `trg_profiles_set_updated_at`, but live trigger metadata does not show it.

Impact: `profiles.updated_at` may not update automatically when staff profiles change.

Decision: Add the missing trigger in the planned migration if it is still absent at implementation time.

### Finding 8: Live Sales Currency Default Is `USD`

Severity: Low

Local migration and app behavior use `GEL`, but live `sales.currency_code` defaults to `USD`.

Impact: Current app inserts `GEL`, so this is not an immediate runtime problem. The schema default is still wrong for the shop context.

Decision: Change the live default to `GEL` in the planned migration.

### Finding 9: Storage Bucket Exists And Matches App Needs

Severity: Informational

Live bucket `product-images` is public, has a 5 MB file-size limit, and allows JPEG, PNG, WebP, and AVIF.

Impact: This matches current product-image behavior.

Decision: Keep the public bucket and document expected setup. Do not change storage in the first repair unless verification finds missing policies or bucket settings.

## Recommended Fix Order

1. Create a schema-alignment migration plan for field schema drift: `attribute_options`, `attributes.input_mode`, `attributes.display_name_translations`, profile trigger, and sales currency default.
2. Refactor reservation writes to API-only routes, then remove or disable browser-side reservation writes.
3. Normalize RLS policies around the chosen model: public storefront reads, server-only writes, and defensive staff policies.
4. Document the active `public.rls_auto_enable` / `ensure_rls` safety guard and decide later whether it belongs in a dedicated RLS/security migration.
5. Document the public `product-images` bucket setup and verification query.

## Stop Conditions For Implementation

Stop before applying any migration if:

- The generated migration would drop tables, columns, policies, or functions.
- A future migration would drop, disable, or replace `public.rls_auto_enable` / `ensure_rls` without a dedicated security review.
- The reservation data source is not clearly routed through server APIs.
- Supabase CLI or connector access is unavailable and the user has not approved a manual SQL process.
- Any step requires reading business rows instead of metadata.
