# Database Code Contract Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit the live Supabase schema against local migrations and app code expectations without changing data, schema, storage, GitHub, Linear, or Neon.

**Architecture:** Treat the live Supabase database as real business data and perform metadata-only introspection. Compare live tables, columns, constraints, indexes, policies, grants, functions, and storage metadata against `supabase/migrations/*` and code usage in `src/app/api/**` and `src/features/**`. Produce a written audit report and follow-up implementation plan before any migration or refactor.

**Tech Stack:** Supabase Postgres, Supabase Auth/Storage/RLS, Next.js App Router, TypeScript, local docs, optional GitHub/Linear tracking after approval.

---

## User Decisions

- Data safety: treat Supabase as real business data.
- Source of truth: compare live Supabase schema plus local migrations.
- Supabase access: read-only schema introspection through Supabase tools/SQL.
- Audit scope: full foundation audit.
- Audit output: spec plus audit report plus implementation plan.
- Storage: include bucket policy and image cleanup behavior.
- Auth/security: include staff roles, RLS, `service_role`, and role-resolution security.
- Row access: schema/security metadata only; no business row details.
- Tracking: local docs only for now.
- Missing live schema in Git: create a migration plan to bring Git up to date.
- Unused local schema: document as unused, keep for now.
- Project cleanup style: conservative cleanup only.

## Files

- Read: `supabase/migrations/*.sql`
- Read: `supabase/sql/*.sql`
- Read: `src/app/api/**/*.ts`
- Read: `src/features/**/*.ts`
- Read: `src/features/**/*.tsx`
- Read: `src/lib/supabase/*.ts`
- Read: `src/lib/auth/*.ts`
- Read: `src/lib/feature-flags.ts`
- Read: `.env.example`
- Create: `docs/audits/2026-05-17-database-code-contract-audit.md`
- Create after audit: `docs/plans/2026-05-17-database-foundation-fixes.md`
- Modify after audit only if needed: `docs/specs/2026-05-17-data-and-design-foundation.md`

## Safety Rules

- Do not run writes against Supabase.
- Do not apply migrations.
- Do not call `supabase migration`, `db push`, `db reset`, `db diff`, or destructive SQL.
- Do not read business row details.
- Do not read customer/product/staff sample rows.
- Do not delete or modify storage objects.
- Do not create GitHub commits, pushes, PRs, or Linear issues during the audit.
- Stop if Supabase tools are unavailable or if the only available method requires broad access beyond metadata.

Allowed live Supabase reads:

- `information_schema`
- `pg_catalog`
- `pg_policies`
- grants/privileges metadata
- function metadata
- storage bucket/object policy metadata
- RLS enabled flags

Not allowed without a new approval:

- selecting rows from business tables
- counting rows in business tables
- updating schema
- inserting test rows
- deleting rows or objects

## Task 1: Confirm Local Baseline

**Files:**
- Read: `supabase/migrations/*.sql`
- Read: `src/app/api/**/*.ts`
- Read: `src/features/**/*.ts`
- Read: `src/features/**/*.tsx`

- [ ] **Step 1: Verify working tree context**

Run:

```powershell
git status --short
```

Expected: only already-known documentation changes are present.

- [ ] **Step 2: List local migrations**

Run:

```powershell
Get-ChildItem -Path supabase\migrations | Select-Object Name,Length,LastWriteTime
```

Expected: migration list includes the core schema, business rules/indexes, RLS/RBAC, staff profiles, app settings, customer context, translations, and auth hardening migrations.

- [ ] **Step 3: Identify app-side Supabase table usage**

Run:

```powershell
rg -n "from\(|select\(|insert\(|update\(|delete\(|rpc\(|storage|bucket|auth\.admin|auth\.getUser|service_role|SUPABASE" src
```

Expected: output lists Supabase usage in catalog, fields, reservations, reports, settings, staff, auth, and storage code.

## Task 2: Extract Local Migration Contract

**Files:**
- Read: `supabase/migrations/*.sql`
- Create section in: `docs/audits/2026-05-17-database-code-contract-audit.md`

- [ ] **Step 1: Extract tables and enums from migrations**

Run:

```powershell
rg -n "create type|create table|alter table" supabase\migrations
```

Expected: local schema contract includes `catalog_items`, `bicycles`, `parts`, `attributes`, `item_attribute_values`, `product_images`, `reservations`, `sales`, `audit_logs`, `profiles`, and `app_settings`.

- [ ] **Step 2: Extract indexes and constraints from migrations**

Run:

```powershell
rg -n "create index|unique index|constraint|check \(|foreign key|references" supabase\migrations
```

Expected: output captures serial uniqueness, product status indexes, image primary uniqueness, one active reservation per item, profile indexes, and customer search indexes.

- [ ] **Step 3: Extract RLS, grants, policies, and security-definer functions**

Run:

```powershell
rg -n "enable row level security|create policy|grant |revoke |security definer|create or replace function" supabase\migrations
```

Expected: output captures RLS for public tables, role functions, app settings policies, profile policies, and controlled clear archived RPC.

- [ ] **Step 4: Confirm suspected local gaps**

Run:

```powershell
rg -n "attribute_options|input_mode" supabase\migrations
```

Expected before live audit: no migration creates `attribute_options` or `attributes.input_mode`.

## Task 3: Extract App Code Contract

**Files:**
- Read: `src/app/api/**/*.ts`
- Read: `src/features/**/*.ts`
- Read: `src/features/**/*.tsx`
- Create section in: `docs/audits/2026-05-17-database-code-contract-audit.md`

- [ ] **Step 1: Extract business table names used by app code**

Run:

```powershell
rg -n "\.from\(\" src
```

Expected: output references app-used tables including `catalog_items`, `bicycles`, `parts`, `product_images`, `attributes`, `attribute_options`, `item_attribute_values`, `reservations`, `sales`, `profiles`, and `app_settings`.

- [ ] **Step 2: Extract RPC names used by app code**

Run:

```powershell
rg -n "\.rpc\(" src
```

Expected: output includes `clear_archived_catalog_item`.

- [ ] **Step 3: Extract storage operations used by app code**

Run:

```powershell
rg -n "storage\.|getBucket|createBucket|upload\(|remove\(|getPublicUrl|NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET" src
```

Expected: output identifies image upload, public URL, and cleanup behavior.

- [ ] **Step 4: Extract auth/admin/service-role usage**

Run:

```powershell
rg -n "auth\.admin|auth\.getUser|getServerSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY|current_app_role|app_role|user_metadata|app_metadata" src supabase\migrations
```

Expected: output identifies staff APIs, role lookup, service-role usage, and hardened role migration.

## Task 4: Read-Only Live Supabase Schema Introspection

**Files:**
- Create section in: `docs/audits/2026-05-17-database-code-contract-audit.md`

- [ ] **Step 1: Confirm Supabase tool access**

Use the available Supabase tool or MCP connection to confirm the project can run read-only SQL metadata queries.

Expected: connection is available. If not available, stop and document the blocker.

- [ ] **Step 2: Query live tables and columns**

Run a read-only metadata query equivalent to:

```sql
select
  table_schema,
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema in ('public', 'storage')
order by table_schema, table_name, ordinal_position;
```

Expected: metadata only. No business rows.

- [ ] **Step 3: Query live constraints and indexes**

Run read-only metadata queries equivalent to:

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname in ('public', 'storage')
order by schemaname, tablename, indexname;
```

```sql
select
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema as foreign_table_schema,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
 and tc.table_schema = ccu.table_schema
where tc.table_schema in ('public', 'storage')
order by tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;
```

Expected: metadata only.

- [ ] **Step 4: Query live RLS and policies**

Run read-only metadata queries equivalent to:

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind = 'r'
order by n.nspname, c.relname;
```

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

Expected: policy metadata only.

- [ ] **Step 5: Query live functions and grants**

Run read-only metadata queries equivalent to:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_app_role',
    'is_admin',
    'is_seller_or_admin',
    'clear_archived_catalog_item',
    'set_updated_at'
  )
order by n.nspname, p.proname;
```

Expected: function metadata only.

- [ ] **Step 6: Query live storage buckets metadata**

Run a read-only metadata query equivalent to:

```sql
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
order by name;
```

Expected: bucket metadata only. Do not query storage object rows.

## Task 5: Compare Live Schema To Local Migrations

**Files:**
- Create: `docs/audits/2026-05-17-database-code-contract-audit.md`

- [ ] **Step 1: Build comparison table**

In the audit report, create sections:

```md
## Live Exists And Local Migration Exists
## Live Exists But Local Migration Missing
## Local Migration Exists But App Does Not Use
## App Uses But Live Missing
## App Uses But Local Migration Missing
## Security/RLS Findings
## Storage Findings
## Neon Compatibility Notes
```

Expected: every app-used table/column lands in one section.

- [ ] **Step 2: Confirm `attribute_options` status**

Document whether `attribute_options` exists live, exists locally, and is used by code.

Expected: one of:

- live exists, local migration missing
- live missing, code expects it
- both live and local missing, code is currently broken for Supabase field options

- [ ] **Step 3: Confirm `attributes.input_mode` status**

Document whether `attributes.input_mode` exists live, exists locally, and is used by code.

Expected: one of:

- live exists, local migration missing
- live missing, code expects it
- both live and local missing, code fallback hides the issue only partially

## Task 6: Produce Audit Report

**Files:**
- Create: `docs/audits/2026-05-17-database-code-contract-audit.md`

- [ ] **Step 1: Write report header**

Use this header:

```md
# Database Code Contract Audit

Date: 2026-05-17
Scope: live Supabase metadata, local migrations, app code contract
Mode: read-only, metadata-only
Data safety: real business data assumed
```

- [ ] **Step 2: Write executive summary**

Include:

- confirmed safe/no-write audit mode
- whether live schema matches migrations
- whether code expects missing schema
- highest-risk gaps
- recommended next plan

- [ ] **Step 3: Write findings with severity**

Use severity:

- P0: app cannot safely run against Supabase
- P1: schema drift or security risk needing planned fix
- P2: cleanup or maintainability concern
- P3: documentation gap

- [ ] **Step 4: Write no-change verification**

Document that no business rows, schema changes, storage objects, GitHub, Linear, or Neon resources were modified.

## Task 7: Produce Follow-Up Implementation Plan

**Files:**
- Create: `docs/plans/2026-05-17-database-foundation-fixes.md`

- [ ] **Step 1: Create fix plan only after report is complete**

The plan must not apply fixes. It should define proposed fixes for confirmed gaps.

- [ ] **Step 2: If missing migration is confirmed, plan additive migration**

If `attribute_options` or `attributes.input_mode` are confirmed missing locally, plan a new migration using `supabase migration new <name>` during implementation, not by inventing a filename.

- [ ] **Step 3: Include rollback and verification**

The fix plan must include:

- SQL preview/introspection queries
- migration generation command
- RLS/grants review
- local build verification
- no-destructive rollback notes

## Task 8: Tracking And Publishing Decision

**Files:**
- Read: Git status only.

- [ ] **Step 1: Keep Linear local-docs-only**

Do not create Linear issues unless the user later provides team/project/priority and confirms issue creation.

- [ ] **Step 2: Keep GitHub local-only**

Do not commit, push, or create a PR unless the user explicitly asks for publish flow.

- [ ] **Step 3: Keep Neon out of implementation scope**

Document Neon compatibility notes only. Do not create Neon projects, branches, or migrations.

## Acceptance Criteria

- Audit plan exists at `docs/plans/2026-05-17-database-code-contract-audit.md`.
- Audit report is planned at `docs/audits/2026-05-17-database-code-contract-audit.md`.
- Plan follows read-only metadata-only Supabase rules.
- Plan includes local migration, app code, RLS, auth/staff, storage, GitHub, Linear, and Neon boundaries.
- Plan does not authorize database writes or app refactors.

## Stop Conditions

Stop and ask the user before continuing if:

- Supabase tool access is unavailable.
- The only available audit path would expose business rows.
- A query needs service-role access beyond metadata.
- Live schema differs from migrations in a way that could break production.
- Any proposed action would write to Supabase, storage, GitHub, Linear, or Neon.
