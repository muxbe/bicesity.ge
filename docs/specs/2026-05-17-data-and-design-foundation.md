# Data And Project Design Foundation Spec

## Problem

The app has grown into a real shop system with catalog, reservations, staff roles, settings, reports, storage-backed images, mock adapters, Supabase adapters, and V3 UI work. The database is already partly normalized, but the current foundation needs a careful audit before we make more schema or design changes.

The main risk is changing database or project structure blindly. This app touches product visibility, reservations, staff roles, storage deletion, and public customer-facing pages, so the next work must be planned from the current schema and code, not from taste alone.

## Goal

Define the first foundation pass for a well-structured database and a well-structured project design.

This spec does not implement anything. It documents what we have, what looks weak, and the order to fix things safely.

## Current Database Shape

The current Supabase schema is migration-driven under `supabase/migrations/`.

### Core Catalog

- `catalog_items`
  - Main product table.
  - Stores shared product fields: `item_type`, `name`, `serial_number`, `price_cents`, `stock_count`, `status`, `description`, `rating`, discount fields, timestamps, and actor metadata.
  - Uses `item_status`: `active`, `reserved`, `sold`, `archived`.

- `bicycles`
  - One-to-one extension of `catalog_items`.
  - Stores `drive_type`.

- `parts`
  - One-to-one extension of `catalog_items`.
  - Stores `part_kind`.

- `product_images`
  - One-to-many product image table.
  - Supports either Supabase Storage objects with `bucket_name` + `object_path`, or external URLs.
  - Has `is_primary` and `sort_order`.

### Product Attributes

- `attributes`
  - Stores configurable fields per category.
  - Has `category`, `field_key`, `display_name`, `display_name_translations`, `data_type`, `is_public`, `sort_order`, and archive metadata.

- `item_attribute_values`
  - Join/value table between `catalog_items` and `attributes`.
  - Primary key is `(catalog_item_id, attribute_id)`.

### Reservations And Sales

- `reservations`
  - Tracks reservation lifecycle with `active`, `completed`, `cancelled`, and `expired`.
  - Has `reserved_for_at`, `expires_at`, cancellation fields, customer context, `seller_comment`, and source fields.

- `sales`
  - Stores sale records with `sale_channel`, `sale_price_cents`, `currency_code`, and optional `reservation_id`.

### Staff/Auth

- `profiles`
  - Links staff profiles to `auth.users`.
  - Stores `email`, `full_name`, `role`, and `is_active`.
  - Roles are currently `admin` and `seller`.

- `current_app_role()`
  - Resolves role from `profiles` first, then `app_role` claims.
  - Later migration hardens this by removing user-editable `user_metadata` role trust.

### Settings And Reports

- `app_settings`
  - Singleton table for shop name, currency, messenger URL, and public contact info.

- Reports are computed from `sales`, `reservations`, `catalog_items`, and `product_images`.

### Audit

- `audit_logs`
  - Exists for entity/action history.
  - Current app usage should be reviewed before relying on it as a complete audit trail.

## Current Database Strengths

- Product data is not stored as one flat table.
- Product type-specific fields are separated into `bicycles` and `parts`.
- Custom public/internal fields are modeled with `attributes` and `item_attribute_values`.
- Product images are normalized and support ordered galleries.
- Reservations and sales have separate lifecycle tables.
- There are indexes for common product, reservation, sales, and profile access patterns.
- RLS exists on main public tables.
- Hard deletes are mostly blocked for catalog items and attributes.
- The latest role migration avoids user-editable `user_metadata` for authorization.

## Current Database Gaps To Audit First

These are not instructions to change production yet. They are the first audit targets.

1. **Code expects `attribute_options`, but migrations do not appear to create it**

   The API uses `attribute_options` for `single_select` fields:

   - `src/app/api/fields/field-service.ts`
   - `src/app/api/catalog/catalog-service.ts`

   But `rg "attribute_options|input_mode" supabase/migrations` found no migration creating `attribute_options` or adding `input_mode`. This must be confirmed against the live database before writing a migration.

2. **Code expects `attributes.input_mode`, but migrations do not show it**

   The app supports `free_text` and `single_select` in DTOs and services. The schema history in this repo does not currently show the migration that adds this field.

3. **Storage policies are not represented in local migrations**

   The app creates/uses a public bucket for product images through server APIs, but bucket policy and storage access rules should be documented explicitly.

4. **RLS/Data API exposure needs a table-by-table review**

   Public catalog data is intentionally visible, but staff, reservations, sales, profiles, and audit data must stay protected.

5. **Security definer functions need review**

   `current_app_role()` and `clear_archived_catalog_item()` are security-sensitive. They should stay tightly scoped and verified against their intended callers.

6. **Audit trail completeness is unclear**

   `audit_logs` exists, but the app should verify which actions actually write audit rows.

7. **Neon compatibility is not automatic**

   Neon can run Postgres, but this app currently depends on Supabase Auth, Storage, RLS conventions, and Supabase client/admin APIs. Any Neon move would be a separate architecture decision, not a simple database swap.

## Current Project Design Shape

The project is a Next.js App Router app.

### App Routes

- Public/customer:
  - `src/app/page.tsx`
  - `src/app/shop/[id]/page.tsx`
  - `src/app/login/`
  - `src/app/register/`
  - `src/app/reset-password/`

- Admin:
  - `src/app/admin/*`
  - inventory, reservations, reports, deleted, fields, staff, settings

- Seller:
  - `src/app/seller/*`
  - inventory/reserved/reservations/reports/fields

- API:
  - `src/app/api/catalog/*`
  - `src/app/api/fields/*`
  - `src/app/api/reservations/*`
  - `src/app/api/reports/*`
  - `src/app/api/settings/*`
  - `src/app/api/staff/*`
  - `src/app/api/auth/me`
  - `src/app/api/shop/bootstrap`

### Feature Folders

- `src/features/catalog`
- `src/features/fields`
- `src/features/reservations`
- `src/features/reports`
- `src/features/auth`
- `src/features/admin`
- `src/features/shared`
- `src/features/shop`

### Shared Libraries

- `src/lib/supabase`
- `src/lib/auth`
- `src/lib/i18n`
- `src/lib/feature-flags.ts`
- `src/lib/settings.ts`
- `src/lib/mock-data.ts`

## Current Project Design Strengths

- The app already has feature folders instead of only page-level code.
- Supabase and mock adapters are separated for catalog, fields, reservations, and reports.
- DTOs exist for catalog, fields, reservations, and reports.
- API routes are grouped by domain.
- Public, admin, and seller surfaces are separated in routes.
- i18n is centralized.
- The V3 mobile polish now has verification scripts.

## Current Project Design Gaps To Audit First

1. **Large files carry too much responsibility**

   First refactor candidates:

   - `src/features/admin/admin-inventory-view.tsx`
   - `src/app/page.tsx`
   - `src/app/admin/fields/page.tsx`
   - `src/app/api/catalog/catalog-service.ts`
   - `src/app/api/fields/field-service.ts`

2. **API services mix mapping, validation, persistence, storage cleanup, and workflow rules**

   This is workable today, but risky as the app grows.

3. **Catalog status behavior is spread across UI, API, and database triggers**

   Status transitions should be documented as one lifecycle contract.

4. **Storage deletion behavior is sensitive**

   Image replacement and archived-item clearing can remove files. This needs a clear safety contract and tests.

5. **Mock and Supabase behavior may drift**

   Mock adapters should mirror production rules closely enough for development.

6. **Design system boundaries are informal**

   The app has good V3 styling, but reusable UI primitives and layout patterns should be made explicit before deeper refactors.

## Target Database Design

The target database should keep the current normalized direction, with these improvements:

- Every app-used table and column must exist in migrations.
- Every relationship should be enforced with foreign keys.
- Every status/lifecycle rule should have one documented owner: database, API service, or UI.
- Public catalog access should be explicit and minimal.
- Staff/reservation/sales/audit access should require authenticated staff roles.
- Product image storage should have clear database rows, bucket policy, and cleanup rules.
- Custom field options should be first-class if `single_select` remains part of the product model.
- RLS policies should be tested with anon, user, seller, admin, and service-role paths.
- Destructive actions should stay opt-in and reversible where possible.

## Target Project Design

The target app structure should keep the current feature folders and make their boundaries clearer:

- `catalog`
  - product DTOs, validation, repository interfaces, mock adapter, Supabase adapter, product status contract

- `fields`
  - field DTOs, option handling, field layout contract, repository interfaces

- `reservations`
  - reservation DTOs, lifecycle rules, customer context, seller comments

- `reports`
  - report DTOs, date range logic, report queries

- `auth`
  - client/server auth, role resolution, protected route behavior

- `settings`
  - app settings DTOs and service logic should become a named feature if it grows

- `shared`
  - errors, freshness/invalidation, common server helpers

## First Fix Order

1. **Database/code contract audit**

   Compare migrations against every Supabase table/column used by code. First known focus: `attribute_options` and `attributes.input_mode`.

2. **Live database verification plan**

   Decide how to verify the actual Supabase database safely:

   - schema introspection only
   - no writes
   - no migration apply
   - record missing tables/columns/policies

3. **Database foundation spec update**

   Update this spec with live findings before writing SQL.

4. **Database migration plan**

   If gaps are confirmed, write a plan for additive migrations with rollback notes.

5. **Project design refactor spec**

   After database contract is stable, write a separate spec for splitting large files and formalizing feature boundaries.

6. **Implementation**

   Implement only after the migration/refactor plan is approved.

## Non-Goals

- Do not switch from Supabase to Neon in this pass.
- Do not apply migrations in this pass.
- Do not change live RLS policies in this pass.
- Do not change storage buckets in this pass.
- Do not refactor large files in this pass.
- Do not create or modify Linear issues until the user chooses the Linear team/project and confirms issue creation.

## Linear Tracking

Linear can be used after this spec is reviewed. Recommended issue structure:

- Issue 1: Database/code contract audit
- Issue 2: Live Supabase schema verification
- Issue 3: Missing migration plan for field options/input mode if confirmed
- Issue 4: Project design refactor spec

No Linear issue should be created until team/project, priority, labels, and ownership are confirmed.

## Acceptance Criteria For This Foundation Step

- The current database shape is documented.
- The current project structure is documented.
- Known database/code contract risks are named.
- The first fix order is clear.
- No database or app behavior changes are made.

## Next Recommended Action

Create a database/code contract audit plan that compares:

- `supabase/migrations/*`
- Supabase table/column usage in `src/app/api/**`
- repository adapters under `src/features/**`
- DTO expectations under `src/features/**/dto`

The audit should produce a concrete list of missing migrations, unused schema, risky policies, and table/column mismatches.
