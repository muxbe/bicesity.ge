# Bicycle Shop: Supabase + Vercel Roadmap

## Locked Decisions

- Keep all current routes/URLs unchanged until planned route updates.
- Keep current visuals/UI unchanged during migration.
- Keep mock data in place until each feature is switched to real data.
- Use server as source of truth (no global client state store for now).
- Critical data to refresh on tab focus and after admin save:
  - price
  - inventory stock count
  - most report metrics
- Non-critical data can refresh on navigation/manual reload.
- Migration approach: incremental (feature by feature), app remains runnable after each step.

## Recommended Starting Step

Start with **Step 1: Data Contract + Database Design**.
This avoids rework in Supabase schema, API layer, and report queries later.

## Implementation Steps

### Step 1: Data Contract + Database Design

Define how current mock structures map to real entities and relationships.

- Identify entities (products, inventory, reservations, fields, reports)
- Define table schema, keys, enums, constraints, timestamps
- Define read/write paths for admin and shop flows

Output:
- approved schema + data contract document

### Step 2: Supabase Foundation

Set up reproducible database environments.

- Create Supabase projects (dev/staging/prod)
- Add SQL migrations
- Add seed scripts for baseline data
- Set RLS policies and roles

Output:
- repeatable Supabase setup for all environments

### Step 3: Vercel Environment Setup

Prepare deployment and environment variable management.

- Connect repository to Vercel
- Configure env vars per environment
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - server-side Supabase key(s)
- Confirm preview/staging/prod deployments

Output:
- stable deployment pipeline with isolated environment configs

### Step 4: Data Access Layer in Feature Structure

Keep feature-based layout and hide data source behind adapters.

- Add feature-local repositories/adapters (`mock` + `supabase`)
- Keep route files thin (`src/app` for routing only)
- Route UI/business logic through `src/features/*`

Output:
- app still works on mocks, and each feature can be switched independently

### Step 5: First Real Data Slice (Price + Inventory Stock)

Migrate highest-impact fields first without UI changes.

- Move reads/writes for price and stock count to Supabase
- Keep same pages/routes/visuals
- Validate admin updates are reflected by the defined refresh policy

Output:
- first production-grade feature slice live on real data

### Step 6: Freshness Policy Implementation

Apply agreed update behavior across features.

- Critical fields: refetch on focus + after admin save
- Non-critical fields: navigation/manual reload
- Keep server as source of truth

Output:
- predictable and consistent freshness behavior

### Step 7: Reports Migration

Move report calculations to Supabase-friendly queries.

- Replace mock report data with DB queries/views/RPC where needed
- Optimize heavy report reads

Output:
- reports backed by real data with acceptable performance

### Step 8: Reservations and Fields Migration

Complete remaining admin/shop feature migration.

- Migrate reservations
- Migrate field management
- Preserve current route and UI behavior

Output:
- full feature set running on Supabase

### Step 9: Cutover and Cleanup

Finish migration and stabilize production.

- Remove mock-only paths after feature cutover
- Add monitoring, logging, and rollback notes
- Run final regression checks

Output:
- clean production-ready codebase with real data end-to-end
