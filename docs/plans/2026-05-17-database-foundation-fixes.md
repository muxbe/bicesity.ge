# Database Foundation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align live Supabase, Git migrations, and app code so the database can be recreated safely and the app uses one clear access model.

**Architecture:** Treat live Supabase as the current business-data source of truth, then create a forward-only repair migration that preserves live field behavior and adds missing Git-backed columns. Move reservation writes behind server API routes so browser code no longer needs direct write policies. Keep RLS defensive and document storage/service-role rules.

**Tech Stack:** Supabase Postgres, Supabase Auth, Supabase Storage, RLS, Next.js App Router, TypeScript, React, `@supabase/supabase-js`.

---

## Decisions This Plan Implements

- Live Supabase is truth for current business data.
- Git migrations must catch up to live before broad behavior changes.
- Reservation writes should be API-only.
- `attribute_options` and `attributes.input_mode` should be preserved and added to Git.
- `attributes.display_name_translations` should be added to live.
- Server APIs may use `SUPABASE_SERVICE_ROLE_KEY`, but only after route-level auth and role checks.
- Public storefront reads are allowed; staff writes go through API routes.
- `product-images` remains a public bucket.
- `public.rls_auto_enable` must be investigated before a preserve/remove decision.
- `sales.currency_code` default should be `GEL`.

## Files

- Create migration with Supabase CLI using `supabase migration new align_live_database_contract`; use the exact path printed by the CLI.
- Modify: `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`
- Modify or create: `src/app/api/reservations/route.ts`
- Modify or create: `src/app/api/reservations/[id]/route.ts`
- Read: `src/app/api/catalog/role.ts`
- Read: `src/lib/auth/server.ts`
- Read: `src/lib/supabase/admin.ts`
- Modify: `docs/specs/2026-05-17-data-and-design-foundation.md`
- Modify or create: `docs/supabase-storage-contract.md`
- Verify with: `npm run build`

## Safety Rules

- Do not drop business tables.
- Do not delete business data.
- Do not read business row contents during migration planning.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Do not run migration SQL against live until the user approves the generated SQL.
- Use `supabase migration new align_live_database_contract` to create the migration file. If Supabase CLI is unavailable, stop and ask whether to use a manual migration file name.
- Run metadata verification before and after applying SQL.

## Task 1: Reconfirm Live Metadata Before Writing SQL

**Files:**
- Read: `docs/audits/2026-05-17-database-code-contract-audit.md`
- Read: `supabase/migrations/*.sql`

- [ ] **Step 1: Verify local worktree**

Run:

```powershell
git status --short
```

Expected: documentation changes are visible; no unexpected code or migration edits are present.

- [ ] **Step 2: Re-run metadata query for exact target fields**

Run in Supabase SQL Editor:

```sql
select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    table_name in ('attributes', 'attribute_options', 'profiles', 'sales')
  )
order by table_name, ordinal_position;
```

Expected: confirms current state of `attribute_options`, `attributes.input_mode`, `attributes.display_name_translations`, profile columns, and `sales.currency_code`.

- [ ] **Step 3: Inspect unknown function body**

Run in Supabase SQL Editor:

```sql
select pg_get_functiondef('public.rls_auto_enable()'::regprocedure) as function_definition;
```

Expected: returns the body of `public.rls_auto_enable`. If it errors because the signature is different, run:

```sql
select
  p.oid::regprocedure::text as signature,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'rls_auto_enable';
```

Expected: returns every matching `rls_auto_enable` function definition.

## Task 2: Create Forward-Only Schema Alignment Migration

**Files:**
- Create: the exact migration path printed by `supabase migration new align_live_database_contract`

- [ ] **Step 1: Create migration file**

Run:

```powershell
supabase migration new align_live_database_contract
```

Expected: Supabase CLI prints the generated migration path under `supabase/migrations`.

- [ ] **Step 2: Add field schema repair SQL**

Add this SQL to the generated migration file:

```sql
alter table public.attributes
  add column if not exists input_mode text not null default 'free_text';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attributes_input_mode_check'
      and conrelid = 'public.attributes'::regclass
  ) then
    alter table public.attributes
      add constraint attributes_input_mode_check
      check (input_mode in ('free_text', 'single_select'));
  end if;
end
$$;

alter table public.attributes
  add column if not exists display_name_translations jsonb not null default '{}'::jsonb;

update public.attributes
set display_name_translations = jsonb_build_object('en', display_name)
where display_name_translations = '{}'::jsonb
   or display_name_translations is null;

create table if not exists public.attribute_options (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.attributes(id) on delete cascade,
  label text not null,
  value text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attribute_id, value)
);

alter table public.attribute_options enable row level security;
```

Expected: the migration preserves live `attribute_options` shape and adds the missing local contract.

- [ ] **Step 3: Add profile trigger and sales currency repair**

Add this SQL after the field schema repair:

```sql
drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.sales
  alter column currency_code set default 'GEL';
```

Expected: profile updates refresh `updated_at`, and new sales default to `GEL` when the app does not explicitly send a currency.

- [ ] **Step 4: Add conservative grants for `attribute_options`**

Add this SQL:

```sql
grant select on public.attribute_options to anon, authenticated;
grant insert, update on public.attribute_options to authenticated;
```

Expected: database privileges match the table being exposed through the Data API. RLS policies still decide row access.

- [ ] **Step 5: Add defensive `attribute_options` policies**

Add this SQL:

```sql
drop policy if exists attribute_options_public_read on public.attribute_options;
drop policy if exists attribute_options_staff_insert on public.attribute_options;
drop policy if exists attribute_options_staff_update on public.attribute_options;

create policy attribute_options_public_read
on public.attribute_options
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.attributes a
    where a.id = attribute_options.attribute_id
      and a.archived_at is null
      and a.is_public = true
  )
);

create policy attribute_options_staff_insert
on public.attribute_options
for insert
to authenticated
with check (public.is_admin());

create policy attribute_options_staff_update
on public.attribute_options
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

Expected: public clients can read only active options for public fields. Staff writes remain restricted.

- [ ] **Step 6: Add PostgREST schema reload**

Add this SQL at the end:

```sql
notify pgrst, 'reload schema';
```

Expected: Supabase Data API refreshes schema cache after migration.

## Task 3: Refactor Reservation Writes To API-Only

**Files:**
- Modify: `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`
- Modify: `src/app/api/reservations/route.ts`
- Modify or create: `src/app/api/reservations/[id]/route.ts`
- Read: `src/app/api/catalog/role.ts`
- Read: `src/lib/auth/server.ts`

- [ ] **Step 1: Identify current browser writes**

Run:

```powershell
rg -n "getBrowserSupabaseClient|from\\(\"reservations\"|insert\\(|update\\(" src\features\reservations src\app\api\reservations
```

Expected: direct browser writes are visible in `reservation-repository.supabase.ts`.

- [ ] **Step 2: Add or confirm API route handlers for reservation create/update/cancel/complete**

Use `src/app/api/reservations/route.ts` for list/create/upsert and `src/app/api/reservations/[id]/route.ts` or existing product-based endpoints for updates. Each write handler must:

```ts
const role = await getCatalogRole(request);
if (role !== "admin" && role !== "seller") {
  return NextResponse.json({ error: "Only staff can manage reservations." }, { status: 403 });
}
```

Expected: every reservation write checks staff role before using the admin Supabase client.

- [ ] **Step 3: Replace browser direct writes with fetch calls**

In `src/features/reservations/adapters/supabase/reservation-repository.supabase.ts`, replace direct `.from("reservations").insert` and `.from("reservations").update` write paths with `fetch` calls to the API routes and authenticated headers from `getJsonAuthHeaders("seller")`.

Expected: browser code no longer writes directly to `reservations`.

- [ ] **Step 4: Keep browser reads only if policy supports them**

If reservation browser reads remain, either route them through `/api/reservations` or confirm the live RLS select policy supports the exact authenticated role. Preferred result:

```powershell
rg -n "getBrowserSupabaseClient|from\\(\"reservations\"" src\features\reservations
```

Expected after refactor: no direct browser table writes remain. Direct browser reads may remain only if intentionally approved.

## Task 4: Normalize RLS Policy Direction

**Files:**
- Modify: generated migration from Task 2 or create a follow-up migration after code refactor
- Read: `supabase/migrations/202604140004_enable_rls_and_rbac.sql`
- Read: `supabase/migrations/202605130014_harden_auth_role_metadata.sql`

- [ ] **Step 1: Preserve hardened role resolution**

Confirm `current_app_role()` does not use user-editable `user_metadata` as a trusted source.

Run:

```powershell
Get-Content supabase\migrations\202605130014_harden_auth_role_metadata.sql
```

Expected: role resolution uses profile/app metadata and only grants elevated roles for password-authenticated sessions.

- [ ] **Step 2: Confirm public storefront read policies**

In the migration, keep or create public read policies for:

- `catalog_items`
- `bicycles`
- `parts`
- `product_images`
- `attributes`
- `item_attribute_values`
- `attribute_options`
- `app_settings`

Expected: anonymous storefront can read safe public catalog data, but cannot read reservations, sales, audit logs, or profiles.

- [ ] **Step 3: Keep staff write policies defensive**

For staff-owned tables, either keep existing local policies or restrict writes to API routes while keeping defensive `authenticated` policies for admin/seller. Do not create anon write policies.

Expected: there is no anonymous write policy.

## Task 5: Document Storage Contract

**Files:**
- Create or modify: `docs/supabase-storage-contract.md`
- Read: `src/app/api/catalog/images/route.ts`

- [ ] **Step 1: Document bucket settings**

Create `docs/supabase-storage-contract.md` with:

```markdown
# Supabase Storage Contract

Bucket: `product-images`

Required settings:

- Public bucket: yes
- File size limit: 5242880 bytes
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- Upload path prefix: `catalog/`

The app uploads product images through `src/app/api/catalog/images/route.ts`.
The browser receives public URLs for storefront and admin previews.
Storage writes must stay server-side behind admin role checks.
```

Expected: future setup can recreate the bucket without guessing.

- [ ] **Step 2: Add verification SQL**

Append:

````markdown
Verification query:

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'product-images';
```
````

Expected: docs include a metadata-only verification query.

## Task 6: Verification

**Files:**
- All modified files

- [ ] **Step 1: Run red-flag scan on docs and migration**

Run:

```powershell
$patterns = @('T'+'BD','TO'+'DO','FIX'+'ME','place'+'holder','?'+'??','implement '+'later','fill '+'in')
rg -n ($patterns -join '|') docs supabase\migrations
```

Expected: no matches in newly created docs or migration. Existing historical matches must be reviewed before ignoring.

- [ ] **Step 2: Run build**

Run:

```powershell
npm run build
```

Expected: Next.js build exits with code 0.

- [ ] **Step 3: Verify Supabase metadata after approved migration**

Run in Supabase SQL Editor after migration approval and application:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'attributes' and column_name in ('input_mode', 'display_name_translations'))
    or table_name = 'attribute_options'
  )
order by table_name, column_name;
```

Expected: shows `attribute_options` columns plus `attributes.input_mode` and `attributes.display_name_translations`.

- [ ] **Step 4: Verify reservation direct browser writes are removed**

Run:

```powershell
rg -n "getBrowserSupabaseClient\\(\\).*reservations|from\\(\"reservations\"\\)\\.insert|from\\(\"reservations\"\\)\\.update" src\features\reservations
```

Expected: no direct browser insert/update calls to `reservations`.

## Implementation Handoff

Plan is not approval to apply database changes. Before implementation, review:

- The migration SQL.
- The `public.rls_auto_enable` function body.
- The reservation API route shape.
- The RLS policy direction.

Recommended execution path after approval: inline execution with checkpoints after each task, because live database safety matters more than speed here.
