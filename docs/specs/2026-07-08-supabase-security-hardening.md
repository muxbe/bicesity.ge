# Supabase Security Hardening Spec

Status: proposed
Date: 2026-07-08
Project: VeloHub / Bike City

## Problem

The production Supabase project is connected and functional, but the production readiness audit found several hardening gaps that should be fixed before final domain launch.

Primary findings:

1. `anon` and `authenticated` have broad table-level privileges on public app tables.
2. Public roles can execute several `SECURITY DEFINER` helper functions in the exposed `public` schema.
3. Several trigger/business-rule functions have mutable `search_path`.
4. Supabase Auth leaked-password protection is disabled.
5. Custom SMTP is not confirmed for production auth email flows.
6. Performance Advisor reports duplicate permissive SELECT policies and one RLS init-plan warning.

RLS is enabled and migrations are applied, so the app is currently functional. This work is hardening, not feature repair.

## Goal

Reduce Supabase production risk without changing app behavior:

- Narrow table privileges to the minimum currently needed.
- Keep RLS enabled on all public app tables.
- Remove public `SECURITY DEFINER` RPC exposure where possible.
- Harden function `search_path` settings.
- Preserve public shop, admin, staff, reservation, report, and image flows.
- Leave dashboard-only Auth/SMTP/backups settings as explicit launch tasks.

## Current App Access Model

The application mostly accesses Supabase tables through Next.js server API routes using `SUPABASE_SERVICE_ROLE_KEY`.

Browser-side Supabase usage is limited to Auth/session flows:

- email/password sign in
- sign up
- Google OAuth
- password reset email
- password update after reset
- sign out/session refresh

The public shop and admin UI do not directly query public database tables from the browser. They call app API routes.

## Migration Strategy

Use a single focused migration after approval:

```txt
supabase/migrations/<generated>_harden_public_grants_and_functions.sql
```

The migration should:

1. Create a non-exposed helper schema named `private`.
2. Move privileged role resolution into `private.current_app_role()`.
3. Replace public role helpers with `SECURITY INVOKER` wrappers that call private helpers.
4. Keep public helper wrappers executable so existing RLS policies do not need to be rewritten in the same migration.
5. Revoke public execution of `public.rls_auto_enable()`.
6. Revoke direct execution of trigger/business-rule functions from `public`, `anon`, and `authenticated`.
7. Set explicit `search_path` on all functions flagged by Security Advisor.
8. Revoke over-broad table privileges from `public`, `anon`, and `authenticated`.
9. Re-grant only intended table privileges from the existing migration contract.
10. Notify PostgREST to reload schema cache.

## Required Table Grants

After hardening, direct table grants should be limited to the currently intended contract.

`anon` should only have `SELECT` on:

- `app_settings`
- `attribute_options`
- `attributes`
- `bicycles`
- `catalog_items`
- `item_attribute_values`
- `parts`
- `product_images`

`authenticated` should have `SELECT` on:

- all `anon` SELECT tables
- `audit_logs`
- `profiles`
- `reservations`
- `sales`

`authenticated` should have `INSERT, UPDATE` on:

- `app_settings`
- `attribute_options`
- `attributes`
- `audit_logs`
- `bicycles`
- `catalog_items`
- `item_attribute_values`
- `parts`
- `product_images`
- `profiles`
- `reservations`
- `sales`

No `anon` or `authenticated` table grant should include:

- `DELETE`
- `TRUNCATE`
- `MAINTAIN`
- `REFERENCES`
- `TRIGGER`

RLS policies remain responsible for row-level authorization within those table privileges.

## Required Function Changes

Create private helpers:

- `private.current_app_role()`
- `private.is_admin()`
- `private.is_seller_or_admin()`

Replace public helpers with non-definer wrappers:

- `public.current_app_role()`
- `public.is_admin()`
- `public.is_seller_or_admin()`

Revoke public direct execution for:

- `public.rls_auto_enable()`
- `public.set_updated_at()`
- `public.ensure_bicycle_parent_type()`
- `public.ensure_part_parent_type()`
- `public.ensure_attribute_value_category_match()`
- `public.enforce_catalog_item_status_transition()`
- `public.prevent_hard_delete_catalog_items()`
- `public.prevent_hard_delete_attributes()`
- `public.enforce_reservation_state()`
- `public.sync_item_status_from_reservation()`
- `public.apply_sale_effects()`
- `public.enforce_sales_edit_window()`
- `public.log_sale_correction()`

Keep `public.clear_archived_catalog_item(uuid)` service-role only.

## Non-Goals

Do not include these in the first hardening migration:

1. Do not rewrite every RLS policy to call `private.*` directly.
2. Do not remove app table RLS policies.
3. Do not change app API route behavior.
4. Do not change storage bucket visibility.
5. Do not change Auth providers or SMTP settings through SQL.
6. Do not remove seed/mock data unless separately approved.
7. Do not consolidate duplicate permissive policies in the same migration unless the first migration verifies cleanly.

## Verification Requirements

After writing the migration but before applying to production:

1. Run local build:

```powershell
npm run build
```

2. Review generated migration SQL.
3. Apply only after explicit approval.

After applying to Supabase:

1. Run linked migration list.
2. Query table grants.
3. Query function privileges.
4. Run Supabase Security Advisor.
5. Run Supabase Performance Advisor.
6. Smoke test production routes:

```txt
/
/login
/reset-password
/api/shop/bootstrap
/api/catalog
```

7. Manually test admin login and at least one admin read flow.

## Dashboard Follow-Ups

These cannot be fully handled by SQL migration:

1. Enable leaked-password protection.
2. Configure production custom SMTP.
3. Confirm Auth redirect URLs after domain connection.
4. Confirm backups/PITR or Supabase plan decision.
5. Confirm SSL, network restrictions, owner access, and organization MFA.
6. Decide whether seller staff accounts are needed before launch.

## Acceptance Criteria

1. `supabase migration list --linked` shows the hardening migration applied.
2. No `anon` direct table grants include write/admin privileges.
3. No `authenticated` direct table grants include delete/truncate/trigger/admin-style privileges.
4. Security Advisor no longer reports public executable `SECURITY DEFINER` functions for `public.current_app_role()`, `public.is_admin()`, or `public.is_seller_or_admin()`.
5. `public.rls_auto_enable()` is not executable by `anon` or `authenticated`.
6. Function search-path warnings are resolved for the listed trigger/business functions.
7. Public production smoke checks still return HTTP 200.
8. Admin/staff API flows still work.
