# Supabase Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Supabase public grants and helper functions before final domain launch while preserving current app behavior.

**Architecture:** Add one focused SQL migration that narrows public table privileges, moves privileged role resolution into a private non-exposed schema, replaces public role helpers with invoker wrappers, hardens function search paths, and keeps existing RLS policies intact for the first pass. Dashboard-only Auth/SMTP/backups items remain documented manual launch gates.

**Tech Stack:** Supabase Postgres, Supabase CLI 2.105.0+, Next.js 14, Vercel production deployment.

---

### Task 1: Create Migration File

**Files:**
- Create: `supabase/migrations/<generated>_harden_public_grants_and_functions.sql`

- [ ] **Step 1: Create migration with Supabase CLI**

Run:

```powershell
supabase migration new harden_public_grants_and_functions
```

Expected:

```txt
Created new migration at supabase/migrations/<timestamp>_harden_public_grants_and_functions.sql
```

- [ ] **Step 2: Replace generated migration content**

Open the generated file and replace its content with:

```sql
-- Harden public grants and function exposure before final domain launch.
--
-- This migration intentionally keeps existing RLS policies in place.
-- It changes privilege boundaries and function execution posture without
-- changing application routes or table shapes.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  with claims as (
    select auth.jwt() as jwt
  ),
  amr_methods as (
    select lower(
      case
        when jsonb_typeof(entry.value) = 'string' then trim(both '"' from entry.value::text)
        else entry.value ->> 'method'
      end
    ) as method
    from claims,
    jsonb_array_elements(
      case
        when jsonb_typeof(jwt -> 'amr') = 'array' then jwt -> 'amr'
        when jwt ? 'amr' then jsonb_build_array(jwt -> 'amr')
        else '[]'::jsonb
      end
    ) as entry(value)
  )
  select
    case
      when exists (select 1 from amr_methods where method = 'password') then
        lower(
          coalesce(
            (
              select case when p.is_active then p.role::text else 'user' end
              from public.profiles p
              where p.user_id = auth.uid()
              limit 1
            ),
            nullif(auth.jwt() ->> 'app_role', ''),
            nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', ''),
            'user'
          )
        )
      else 'user'
    end;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select private.current_app_role() = 'admin';
$$;

create or replace function private.is_seller_or_admin()
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select private.current_app_role() in ('admin', 'seller');
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_seller_or_admin() from public;
grant execute on function private.current_app_role() to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_seller_or_admin() to anon, authenticated, service_role;

create or replace function public.current_app_role()
returns text
language sql
stable
security invoker
set search_path = private, public, auth
as $$
  select private.current_app_role();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = private, public, auth
as $$
  select private.is_admin();
$$;

create or replace function public.is_seller_or_admin()
returns boolean
language sql
stable
security invoker
set search_path = private, public, auth
as $$
  select private.is_seller_or_admin();
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_seller_or_admin() from public;
grant execute on function public.current_app_role() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_seller_or_admin() to anon, authenticated, service_role;

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.ensure_bicycle_parent_type() set search_path = public, pg_temp;
alter function public.ensure_part_parent_type() set search_path = public, pg_temp;
alter function public.ensure_attribute_value_category_match() set search_path = public, pg_temp;
alter function public.enforce_catalog_item_status_transition() set search_path = public, pg_temp;
alter function public.prevent_hard_delete_catalog_items() set search_path = public, pg_temp;
alter function public.prevent_hard_delete_attributes() set search_path = public, pg_temp;
alter function public.enforce_reservation_state() set search_path = public, pg_temp;
alter function public.sync_item_status_from_reservation() set search_path = public, pg_temp;
alter function public.apply_sale_effects() set search_path = public, pg_temp;
alter function public.enforce_sales_edit_window() set search_path = public, pg_temp;
alter function public.log_sale_correction() set search_path = public, pg_temp;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.ensure_bicycle_parent_type() from public, anon, authenticated;
revoke all on function public.ensure_part_parent_type() from public, anon, authenticated;
revoke all on function public.ensure_attribute_value_category_match() from public, anon, authenticated;
revoke all on function public.enforce_catalog_item_status_transition() from public, anon, authenticated;
revoke all on function public.prevent_hard_delete_catalog_items() from public, anon, authenticated;
revoke all on function public.prevent_hard_delete_attributes() from public, anon, authenticated;
revoke all on function public.enforce_reservation_state() from public, anon, authenticated;
revoke all on function public.sync_item_status_from_reservation() from public, anon, authenticated;
revoke all on function public.apply_sale_effects() from public, anon, authenticated;
revoke all on function public.enforce_sales_edit_window() from public, anon, authenticated;
revoke all on function public.log_sale_correction() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
revoke all on function public.clear_archived_catalog_item(uuid) from public, anon, authenticated;
grant execute on function public.clear_archived_catalog_item(uuid) to service_role;

do $$
declare
  app_table text;
begin
  foreach app_table in array array[
    'app_settings',
    'attribute_options',
    'attributes',
    'audit_logs',
    'bicycles',
    'catalog_items',
    'item_attribute_values',
    'parts',
    'product_images',
    'profiles',
    'reservations',
    'sales'
  ]
  loop
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      app_table
    );
  end loop;
end
$$;

grant select on public.app_settings to anon, authenticated;
grant select on public.attribute_options to anon, authenticated;
grant select on public.attributes to anon, authenticated;
grant select on public.bicycles to anon, authenticated;
grant select on public.catalog_items to anon, authenticated;
grant select on public.item_attribute_values to anon, authenticated;
grant select on public.parts to anon, authenticated;
grant select on public.product_images to anon, authenticated;

grant select on public.audit_logs to authenticated;
grant select on public.profiles to authenticated;
grant select on public.reservations to authenticated;
grant select on public.sales to authenticated;

grant insert, update on public.app_settings to authenticated;
grant insert, update on public.attribute_options to authenticated;
grant insert, update on public.attributes to authenticated;
grant insert, update on public.audit_logs to authenticated;
grant insert, update on public.bicycles to authenticated;
grant insert, update on public.catalog_items to authenticated;
grant insert, update on public.item_attribute_values to authenticated;
grant insert, update on public.parts to authenticated;
grant insert, update on public.product_images to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.reservations to authenticated;
grant insert, update on public.sales to authenticated;

notify pgrst, 'reload schema';
```

### Task 2: Review Migration Before Applying

**Files:**
- Review: `supabase/migrations/<generated>_harden_public_grants_and_functions.sql`

- [ ] **Step 1: Verify no user-metadata role fallback remains**

Run:

```powershell
rg "user_metadata|raw_user_meta_data" supabase\migrations\<generated>_harden_public_grants_and_functions.sql
```

Expected:

```txt
No matches.
```

- [ ] **Step 2: Verify migration references expected objects only**

Run:

```powershell
rg "private\.|public\.|grant |revoke |alter function|notify" supabase\migrations\<generated>_harden_public_grants_and_functions.sql
```

Expected:

```txt
Output lists only the private helpers, public helpers, public trigger/business functions, public app tables, clear_archived_catalog_item, rls_auto_enable, and PostgREST reload.
```

- [ ] **Step 3: Run local build before touching production**

Run:

```powershell
npm run build
```

Expected:

```txt
Compiled successfully
```

### Task 3: Apply Migration After Explicit Approval

**Files:**
- Apply: `supabase/migrations/<generated>_harden_public_grants_and_functions.sql`

- [ ] **Step 1: Confirm approval**

Ask:

```txt
Approve applying the Supabase hardening migration to the linked production project?
```

Expected:

```txt
User explicitly approves applying the migration.
```

- [ ] **Step 2: Apply migration**

Run:

```powershell
supabase db push
```

Expected:

```txt
Finished supabase db push.
```

If the CLI reports pending migrations and asks for confirmation, confirm only the new hardening migration is included before proceeding.

### Task 4: Verify Migration State

**Files:**
- Read: `supabase/migrations/<generated>_harden_public_grants_and_functions.sql`

- [ ] **Step 1: Verify migration history**

Run:

```powershell
supabase migration list --linked
```

Expected:

```txt
The new hardening migration appears in both Local and Remote columns.
```

- [ ] **Step 2: Verify table grants**

Run:

```powershell
supabase db query --linked -o json "select c.relname as table_name, has_table_privilege('anon', c.oid, 'SELECT') as anon_select, has_table_privilege('anon', c.oid, 'INSERT') as anon_insert, has_table_privilege('anon', c.oid, 'UPDATE') as anon_update, has_table_privilege('anon', c.oid, 'DELETE') as anon_delete, has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select, has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert, has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update, has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('app_settings','attribute_options','attributes','audit_logs','bicycles','catalog_items','item_attribute_values','parts','product_images','profiles','reservations','sales') order by c.relname;"
```

Expected:

```txt
anon_insert=false, anon_update=false, anon_delete=false for every listed table.
authenticated_delete=false for every listed table.
anon_select=true only on public read tables.
authenticated_select=true on all listed app tables.
authenticated_insert/authenticated_update=true only where intentionally re-granted.
```

- [ ] **Step 3: Verify public definer exposure**

Run:

```powershell
supabase db query --linked -o json "select n.nspname as schema_name, p.proname as function_name, p.prosecdef as security_definer, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute from pg_proc p join pg_namespace n on n.oid = p.pronamespace where (n.nspname = 'public' and p.proname in ('current_app_role','is_admin','is_seller_or_admin','rls_auto_enable')) or (n.nspname = 'private' and p.proname in ('current_app_role','is_admin','is_seller_or_admin')) order by n.nspname, p.proname;"
```

Expected:

```txt
public.current_app_role security_definer=false.
public.is_admin security_definer=false.
public.is_seller_or_admin security_definer=false.
public.rls_auto_enable anon_can_execute=false and authenticated_can_execute=false.
private.current_app_role security_definer=true.
private.is_admin security_definer=true.
private.is_seller_or_admin security_definer=true.
```

### Task 5: Run Supabase Advisors

**Files:**
- Read: `docs/audits/2026-07-08-supabase-production-readiness.md`

- [ ] **Step 1: Run Security Advisor**

Run:

```powershell
supabase db advisors --linked --type security --level info --fail-on none
```

Expected:

```txt
No warnings for public executable SECURITY DEFINER functions on public.current_app_role, public.is_admin, public.is_seller_or_admin, or public.rls_auto_enable.
No function_search_path_mutable warnings for the listed trigger/business functions.
Leaked password protection may remain until dashboard follow-up is complete.
```

- [ ] **Step 2: Run Performance Advisor**

Run:

```powershell
supabase db advisors --linked --type performance --level warn --fail-on none
```

Expected:

```txt
Existing duplicate permissive policy warnings may remain.
No new hardening-related performance warnings are introduced.
```

### Task 6: Smoke Test Production App

**Files:**
- Read: `docs/specs/2026-07-08-production-deploy-readiness.md`

- [ ] **Step 1: Smoke test public routes**

Run:

```powershell
$base = 'https://bicesity-ge.vercel.app'
$paths = @('/', '/login', '/reset-password', '/api/shop/bootstrap', '/api/catalog')
foreach ($path in $paths) {
  $response = Invoke-WebRequest -Uri ($base + $path) -Method Get -UseBasicParsing -TimeoutSec 30
  "$path $([int]$response.StatusCode)"
}
```

Expected:

```txt
/ 200
/login 200
/reset-password 200
/api/shop/bootstrap 200
/api/catalog 200
```

- [ ] **Step 2: Smoke test local build**

Run:

```powershell
npm run build
```

Expected:

```txt
Compiled successfully
```

### Task 7: Dashboard Follow-Ups

**Files:**
- Update if needed: `docs/audits/2026-07-08-supabase-production-readiness.md`

- [ ] **Step 1: Enable leaked-password protection**

In Supabase Dashboard:

```txt
Authentication -> Security -> Password security -> Enable leaked password protection.
```

Expected:

```txt
Security Advisor no longer reports auth_leaked_password_protection.
```

- [ ] **Step 2: Configure custom SMTP**

In Supabase Dashboard:

```txt
Authentication -> Emails / SMTP -> configure production SMTP provider.
```

Expected:

```txt
Password reset email works for a non-team production email address.
```

- [ ] **Step 3: Confirm launch gates**

Confirm in Supabase Dashboard:

```txt
Backups/PITR or plan decision documented.
SSL enforcement confirmed.
Owner access confirmed.
Organization MFA confirmed.
Final domain redirect URLs ready after domain connection.
Seller/admin account plan confirmed.
```

Expected:

```txt
All manual dashboard launch gates are either complete or explicitly accepted as launch risks.
```

### Task 8: Commit Documentation And Migration

**Files:**
- Add: `docs/specs/2026-07-08-supabase-security-hardening.md`
- Add: `docs/superpowers/plans/2026-07-08-supabase-security-hardening.md`
- Add: `docs/audits/2026-07-08-supabase-production-readiness.md`
- Add: `docs/specs/2026-07-08-production-deploy-readiness.md`
- Add: `supabase/migrations/<generated>_harden_public_grants_and_functions.sql`

- [ ] **Step 1: Check status**

Run:

```powershell
git status --short --branch
```

Expected:

```txt
Only the approved docs and hardening migration are changed.
```

- [ ] **Step 2: Stage files**

Run:

```powershell
git add docs/specs/2026-07-08-supabase-security-hardening.md docs/superpowers/plans/2026-07-08-supabase-security-hardening.md docs/audits/2026-07-08-supabase-production-readiness.md docs/specs/2026-07-08-production-deploy-readiness.md supabase/migrations/<generated>_harden_public_grants_and_functions.sql
```

Expected:

```txt
Files staged.
```

- [ ] **Step 3: Commit**

Run:

```powershell
git commit -m "Harden Supabase production security posture"
```

Expected:

```txt
Commit created.
```
