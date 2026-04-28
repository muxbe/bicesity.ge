# VeloHub Implementation Execution Plan

Last updated: April 13, 2026

## 1) Purpose

This document converts the locked product spec into an execution-ready delivery plan:
1. task-level implementation order
2. dependencies and rollout gates
3. testing and rollback checkpoints
4. handoff-ready definition of done

Primary source of truth for decisions:
- `docs/whole-product-plan.md`

## 2) Execution Principles

1. Keep current routes/UI behavior stable during migration.
2. Migrate incrementally behind feature flags.
3. Keep server as source of truth.
4. Use strict acceptance gates for each phase.
5. Prefer reversible changes and safe rollback paths.

## 3) Workstreams

1. Platform & Environments
- Supabase projects, Vercel envs, secrets, backups, rollout controls

2. Data Foundation
- schema, migrations, seed/import, RLS/RBAC, constraints/indexes

3. App Architecture
- feature-layer repositories/adapters, DTOs, validation, typed errors

4. Feature Migration
- critical fields, freshness, inventory, reservations, field settings, reports

5. Release & Operations
- reconciliation checks, monitoring/alerts, runbooks, cutover and hypercare

## 4) Milestone Sequence

1. Milestone A: Foundation Ready
- Steps 3-4 complete

2. Milestone B: Runtime Architecture Ready
- Step 5 complete

3. Milestone C: Critical Data Live
- Steps 6-7 complete

4. Milestone D: Core Features DB-Backed
- Steps 8-10 complete

5. Milestone E: Reporting + Production Cutover
- Steps 11-12 complete

## 5) Task Plan by Step

## Step 3: Database Schema

Deliverables:
1. initial SQL migration set
2. tables/relations/enums/constraints/indexes
3. 1-week sold-edit enforcement and audit tables

Implementation tasks:
1. create core tables and enums (`catalog_items`, `bicycles`, `parts`, `attributes`, `item_attribute_values`, `product_images`, `reservations`, `sales`, `audit_logs`)
2. add constraints (one active reservation per item, non-negative stock, status transitions)
3. add indexes for inventory filters and report queries
4. add migration verification script

Done when:
1. migration runs clean on empty DB
2. seed import can insert current mock baseline
3. schema constraints reject invalid states

Rollback gate:
1. keep migrations forward-safe and reversible where possible
2. snapshot before production migration run

## Step 4: Environments

Deliverables:
1. `dev/staging/prod` environment matrix
2. Vercel environment variables
3. backup + rollback checklist

Implementation tasks:
1. configure Supabase projects and roles
2. configure Vercel envs and secret injection
3. enforce preview read-only policy
4. validate admin route protection gate before external exposure

Done when:
1. each environment can connect and run health check
2. secrets are not present in repo
3. backup job and rollback checklist are documented

## Step 5: Data Access Layer

Deliverables:
1. feature folders and repository interfaces
2. `mock` + `supabase` adapters
3. DTO contracts and validation schemas

Implementation tasks:
1. scaffold `src/features/*` modules
2. implement repository contracts for inventory/reservations/fields/reports
3. add adapter switch flags per feature
4. add contract tests for adapter parity

Done when:
1. routes compile against repository contracts
2. both adapters pass contract tests
3. no direct DB row coupling in UI layer

## Step 6: Critical Fields Migration

Deliverables:
1. `price` and `stock_count` live on Supabase for admin + storefront
2. transactional update commands
3. critical read/write rollout flags

Implementation tasks:
1. seed/import current price/stock baseline
2. implement server commands for price and stock updates
3. wire critical reads in storefront and admin
4. add safeguards for non-negative stock and concurrent writes

Done when:
1. admin save reflects in storefront under freshness policy
2. critical write logs and metrics are visible
3. automated checks pass for race/conflict cases

## Step 7: Freshness Rules

Deliverables:
1. critical field registry
2. focus + visibility refresh with cooldown
3. post-save invalidation/refetch behavior

Implementation tasks:
1. add freshness utility and trigger guards
2. add targeted invalidation tags by domain
3. add stale-state UI fallback + retry behavior
4. add freshness integration tests

Done when:
1. no duplicate refetch storms
2. post-save data consistency is verified
3. freshness metrics dashboard is active

## Step 8: Inventory Flows Migration

Deliverables:
1. DB-backed create/edit/archive/sell/reserve flows
2. image upload integration with Supabase Storage
3. action-level audit events

Implementation tasks:
1. migrate create/edit form writes to repositories
2. migrate sold and reserve transactional actions
3. migrate archive behavior
4. wire photo upload and image row persistence

Done when:
1. current admin UX behavior is preserved
2. no hard delete path remains in runtime flow
3. conflict and regression tests pass

## Step 9: Reservations Migration

Deliverables:
1. full reservation lifecycle in DB
2. UTC storage and localized display
3. reservation reporting metrics pipeline

Implementation tasks:
1. replace localStorage reads/writes with repositories
2. enforce lifecycle states and one-active rule
3. auto-close reservation on sell
4. add expiry handling and sold/release operational prompt

Done when:
1. reservations persist across sessions/devices
2. RBAC permissions are respected
3. reservation KPI queries pass validation

## Step 10: Field Settings Migration

Deliverables:
1. DB-backed field CRUD, ordering, visibility
2. dynamic propagation to storefront filters/reports
3. role-safe field operations

Implementation tasks:
1. migrate field management UI to repositories
2. implement `is_public` propagation behavior
3. support image-capable field type and validation rules
4. enforce archive-only field deletion

Done when:
1. admin-configured fields appear in user-side filters/reports as designed
2. seller/user permissions block restricted operations
3. compatibility with existing products is preserved

## Step 11: Reports Migration

Deliverables:
1. DB-backed dashboards via views/RPC + direct queries
2. operational KPI set including reservation metrics
3. reconciliation checks

Implementation tasks:
1. implement report SQL views/RPC for heavy metrics
2. wire dynamic filters from field settings
3. enforce admin-only access
4. add reconciliation suite for aggregate correctness

Done when:
1. reports meet performance target
2. aggregates reconcile with source transactions
3. permission checks pass

## Step 12: Cutover and Cleanup

Deliverables:
1. phased production cutover completion
2. mock-path retirement
3. hypercare and final signoff packet

Implementation tasks:
1. enable final feature flags by rollout sequence
2. remove deprecated mock runtime paths
3. complete UAT and stakeholder signoff
4. run production readiness checklist + rollback drill

Done when:
1. no critical known defects
2. rollback path validated
3. production signoff packet completed

## 6) Testing Matrix

1. Unit tests
- validations, DTO mappers, domain services

2. Contract tests
- `mock` vs `supabase` adapter parity

3. Integration tests
- critical writes, lifecycle transitions, freshness triggers

4. Permission tests
- `admin/seller/user` role behavior

5. Regression checks
- route/UI parity against existing flows

## 7) Feature Flag Rollout Plan

1. Phase 1
- critical reads flag on

2. Phase 2
- critical writes flag on

3. Phase 3
- inventory actions by sub-flag

4. Phase 4
- reservations and field settings flags

5. Phase 5
- reports flag and final cleanup

## 8) Key Risks and Controls

1. Data drift during migration
- control: reconciliation checks + strict constraints

2. Performance regressions
- control: p95 targets + index/view tuning

3. Permission mistakes
- control: RBAC tests + RLS review before cutover

4. Release instability
- control: phased flags + hypercare window

## 9) Main Points to Confirm Before Coding

Please confirm these operational points:
1. Target launch date window
2. Team size and who will implement backend vs frontend
3. Must-have integrations for v1 beyond current scope (if any)
4. Preferred hypercare duration (7 or 14 days)
5. Whether we start coding immediately from Step 3
