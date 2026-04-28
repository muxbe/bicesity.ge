# VeloHub Product Steps (Decision-First)

Last updated: April 13, 2026

This file now contains only the implementation steps.
For each step, we decide details together before execution.

## Step 1: Lock v1 Scope
- Goal: Confirm what is in v1 and what is postponed.
- Output: Final v1 scope list approved by both of us.

## Step 1 Decisions (Locked)

1. Release strategy: Parity-first (`1A`).
2. Auth sequencing: Build core functionality first, then add admin authentication before any external deployment.
3. Reservation scope: Keep existing admin-managed reservation flow in v1 (`4A` from earlier list).
4. Reports scope: Operational reports only in v1 (`5A` from earlier list).
5. Image storage: Include Supabase Storage in v1 (`6B` from earlier list).
6. Freshness policy: Critical fields refetch on focus and after admin save (`7A` from earlier list).
7. Cutover method: Incremental adapter-based migration (`8A` from earlier list).
8. Stock model: Use numeric `stock_count` model (`1B` from remaining decisions).
9. Reservation conflict rule: One active reservation per product (`2A`).
10. Sale correction policy: Editable sold record window is 1 week with audit note (`3A`).
11. Delete behavior: Archive-only in v1, no hard delete (`4A`).
12. Image upload rules: Enforce limits, validation, and compression (`5A`).

## Step 2: Define Data Contract
- Goal: Map current app data shapes to backend entities.
- Output: Final entity/field mapping document.

## Step 2 Decisions (Locked)

1. Product model: Separate tables for bicycles and parts (`1B`) because domain logic is expected to differ.
2. Specs model: Normalized attributes/value model (`2A`) so admin can add/remove fields and control public visibility.
3. Money storage: Integer cents for prices (`3A`).
4. Inventory lifecycle: Enum status model (`4A`).
5. Stock model: Keep `stock_count` on item records for v1 (`5A`).
6. Reservations model: Dedicated reservations table, one active reservation per product (`6A`).
7. Sold correction policy: Sold record editable for 1 week with mandatory audit note (`7A` + locked time window).
8. Images: `product_images` table + Supabase Storage (`8A`).
9. Actor fields: Include nullable actor columns now for future auth (`9A`).
10. API contract: Feature DTOs between UI and repositories (`10A`).

## Step 3: Design Database Schema
- Goal: Convert data contract into tables, relations, constraints, enums.
- Output: Approved Supabase SQL schema plan.

## Step 3 Decisions (Locked)

1. Table architecture: Shared base table with type-specific extensions (`1A`).
2. Primary keys: UUIDs (`2A`).
3. Reservation one-active rule: Enforce at DB level with constraint/index (`3A`).
4. Sold edit 1-week rule: Enforce at DB level with audit trail (`4A`).
5. Archive model: Use status + `archived_at` timestamp (`5A`).
6. Attribute values: Shared item-attribute-values table (`6A`).
7. Images: Dedicated `product_images` table with primary/sort metadata (`7A`).
8. Index strategy: Add essential v1 indexes up front (`8A`).

## Step 4: Configure Environments
- Goal: Prepare dev/staging/prod setup in Supabase and Vercel.
- Output: Environment matrix and variable checklist.

## Step 4 Decisions (Locked)

1. Environment count: `dev + staging + prod` (`1A`).
2. Vercel structure: Single project with environment-specific configuration (`2A`).
3. Migration management: SQL migrations in repository, applied per environment (`3A`).
4. Seed strategy: Deterministic seed scripts (`dev/staging` full sample, `prod` minimal) (`4A`).
5. Preview DB policy: Preview deployments use staging data with read-only access (`5A`).
6. Secret policy: Keys only in env vars, never in repo (`6A`).
7. Auth safety gate: Admin must be protected before external deployment (`7A`).
8. Reliability: Scheduled backups + rollback checklist/runbook (`8A`).

## Step 5: Build Data Access Layer
- Goal: Add feature adapters/repositories (`mock` + `supabase`) so routes stay unchanged.
- Output: Switchable data layer with no UI/URL breakage.

## Step 5 Decisions (Locked)

1. Folder architecture: `src/features/<feature>/{domain,repositories,adapters,dto}` (`1A`).
2. Supabase execution model: Server-first data access (`2A`).
3. Repository shape: Per-feature repositories (`3A`).
4. Adapter switching: Feature-level toggle (`mock` vs `supabase`) (`4A`).
5. Contract policy: DTOs for UI/use-cases, no raw DB rows in UI layer (`5A`).
6. Validation: Shared schema validation at repository boundaries (`6A`).
7. Consistency: Transactional service methods for critical writes (`7A`).
8. Errors: Typed domain error model (`8A`).
9. Freshness mechanics: Tag-based revalidation after critical admin saves (`9A`).
10. Quality gates: Adapter contract tests for parity (`10A`).
11. Logging: Structured logs for writes, failures, and latency (`11A`).
12. Rollout: Feature-flagged phased rollout (`12A`).

## Step 6: Migrate Critical Fields First
- Goal: Move `price` and `stock` reads/writes to Supabase.
- Output: First production slice live on real data.

## Step 6 Decisions (Locked)

1. Cutover scope: Admin and storefront both read real `price` and `stock` (`1A`).
2. Source of truth: Supabase is authoritative for migrated critical fields (`2A`).
3. Write methods: Dedicated commands for critical updates (`3A`).
4. Concurrency: Transactional stock updates with DB safeguards (`4A`).
5. Freshness: Refetch on tab focus and after admin save (`5A`).
6. Rollout controls: Separate feature flags for critical reads and writes (`6A`).
7. Bootstrap: Seed/import from current mock dataset (`7A`).
8. Validation: Server/repository validation plus DB constraints (`8A`).
9. Observability: Structured logs for critical write events/failures/latency (`9A`).
10. Acceptance: Strict done checklist with automated checks (`10A`).

## Step 7: Apply Freshness Rules
- Goal: Enforce refetch rules for critical vs non-critical data.
- Output: Consistent freshness behavior across app.

## Step 7 Decisions (Locked)

1. Critical data definition: Explicit field registry (`1A`).
2. Focus trigger mechanics: Focus + visibility with debounce/min interval (`2A`).
3. Post-save behavior: Targeted invalidation/refetch after confirmed save (`3A`).
4. Non-critical refresh: Navigation/manual reload only (`4A`).
5. Over-fetch protection: Coalescing + cooldown controls (`5A`).
6. Multi-tab consistency: Cross-tab sync without realtime subscriptions (`6A`, aligned to `7A`).
7. Realtime scope in Step 7: No realtime subscriptions (`7A`).
8. Failure UX: Stale indicator + retry + timestamp (`8A`).
9. Invalidation strategy: Tag-based targeted invalidation (`9A`).
10. Metrics: Freshness/refetch metrics tracked (`10A`).
11. Testing: Contract + integration freshness tests (`11A`).
12. Done strictness: Explicit acceptance checklist required (`12A`).

## Step 8: Migrate Inventory Flows
- Goal: Move add/edit/delete, sold flow, and item details to real DB.
- Output: Admin inventory fully DB-backed.

## Step 8 Decisions (Locked)

1. Migration order: `create/edit` first, then `sold/reserve`, then `archive` (`1A`).
2. Edit UX: Preserve current inline/admin interaction pattern (`2A`).
3. Delete policy implementation: Archive-only behavior in UI and DB (`3A`).
4. Sold flow modeling: Transactional `sales` write + item status update (`4A`).
5. Reservation conflict handling: Server-side enforced checks (`5A`).
6. Photo flow: Upload to Supabase Storage before save and persist image rows (`6A`).
7. Validation: Strict server validation with field-level feedback (`7A`).
8. Audit: Log create/edit/archive/sell/reserve actions (`8A`).
9. Rollout safety: Per-action feature flags (`9A`).
10. Acceptance: Strict parity + conflict + regression checks (`10A`).

## Step 9: Migrate Reservations
- Goal: Replace localStorage reservation logic with Supabase persistence.
- Output: Stable reservation lifecycle across sessions/devices.

## Step 9 Decisions (Locked)

1. Lifecycle statuses: `active -> completed/cancelled/expired` (`1A`).
2. Expiration handling: Automatic expiry when reservation datetime passes (`2A`), with a follow-up operational prompt to mark outcome (sold/release) when needed.
3. One-active rule: Enforce one active reservation per item at DB level (`3A`).
4. Creation scope in v1: Admin/seller-managed reservations only (`4A`).
5. Time model: Store UTC timestamps and render in user locale/timezone (`5A`).
6. Sell transition: Selling an item automatically closes active reservation (`6A`).
7. Edit policy: Editable while active; locked after completion/cancellation/expiry (`7A`).
8. Cancellation reason: Required reason code plus optional note (`8A`).
9. Notifications: Multi-channel notifications (email/messenger/telegram/whatsapp) planned but implemented later; v1 keeps in-app status flow.
10. Reporting linkage: Include reservation KPIs in reporting (`10A`).
11. RBAC policy: `admin/seller` manage reservations; only `admin` gets full reservation analytics (`11A`).
12. Acceptance: Cross-session persistence + lifecycle + conflict + RBAC tests required (`12A`).

## Step 10: Migrate Field Settings
- Goal: Move attribute/visibility management to DB with safe propagation.
- Output: Dynamic field settings backed by real data.

## Step 10 Decisions (Locked)

1. Field scope: Global field definitions per category (`1A`).
2. Visibility behavior: `is_public` controls storefront visibility/filter exposure (`2A`).
3. Field deletion: Archive (soft delete) with historical data retention (`3A`).
4. Rename behavior: Keep stable field IDs, rename display labels (`4A`).
5. Field order: Explicit admin-managed `sort_order` (`5A`).
6. Supported field types in v1: Include image-capable fields in addition to base typed fields (`6A` with image support).
7. Validation model: Field-level validation rules (`7A`).
8. Backward compatibility: Existing items remain valid with null/empty defaults for newly added fields (`8A`).
9. Access model: Three-layer RBAC (`admin`, `seller`, `user`): `admin` has full control including reports and price changes; `seller` handles operational actions (reserve/sell/inventory tasks) without reports access; `user` has storefront/read-only customer access.
10. Acceptance: Strict propagation/validation/permission checks required (`10A`).

## Step 11: Migrate Reports
- Goal: Replace mock report values with real queries/views/RPC.
- Output: Reliable and performant report pages.

## Step 11 Decisions (Locked)

1. Data source strategy: DB views/RPC for heavy metrics and direct queries for light metrics (`1A`).
2. Scope: Operational report metrics in v1 (`2A`).
3. Freshness: Critical report KPIs follow critical refresh policy; non-critical follow navigation/manual reload (`3A`).
4. Granularity: Daily/weekly/monthly aggregates (`4A`).
5. Filters: Report filters are dynamic and include admin-configured fields from field settings (`5A` with dynamic-field extension).
6. Ranking: Top models ranked by units sold with revenue tie-break (`6A`).
7. Reservation integration: Include reservation conversion/cancellation/expiry KPIs (`7A`).
8. Performance: Enforce explicit p95 performance target with optimization if needed (`8A`).
9. Access control: Reports accessible only to `admin` role (`9A`).
10. Exports: No exports in v1 (`10A`).
11. Correctness: Reconciliation checks between source transactions and report aggregates (`11A`).
12. Acceptance: Reports must be DB-backed, performant, permissioned, and reconciled before step closure (`12A`).

## Step 12: Cutover and Cleanup
- Goal: Remove mock-only paths, add monitoring, finalize rollback docs.
- Output: Production-ready v1 on Supabase + Vercel.

## Step 12 Decisions (Locked)

1. Cutover style: Phased feature-flag cutover (`1A`).
2. Mock retirement: Remove mock runtime paths incrementally after stable cutover per feature (`2A`).
3. Release gate: Mandatory pre-production checklist (`3A`).
4. Rollback: App rollback + DB-safe rollback strategy (`4A`).
5. Observability: Structured logs, error tracking, metrics dashboards, and alerts (`5A`).
6. Security hardening: RBAC/RLS audit, secret rotation, and admin route protection checks (`6A`).
7. Data quality verification: Reconciliation checks before and after cutover (`7A`).
8. UAT and communication: Internal UAT script + stakeholder signoff + release notes (`8A`).
9. Hypercare: 7-14 day post-launch hypercare window (`9A`).
10. Final deprecation: Remove stale flags and formalize ownership/docs cleanup (`10A`).
11. Go-live strictness: No critical known defects and rollback validated (`11A`).
12. Acceptance: Full production readiness signoff packet required (`12A`).

## Working Rule
- We do not start a step until we both agree on:
1. what exactly we are implementing
2. how we are implementing it
3. what "done" means for that step
