# Production Deploy Readiness Spec

Status: approved
Date: 2026-07-08
Project: VeloHub / Bike City

## Problem

The project is close to being made real online, but the production release has to happen in a controlled order before buying or connecting the final domain.

Known current state:

- GitHub PR #2, `Split catalog service into focused modules`, is open and mergeable.
- PR #2 is still marked as a draft at approval time.
- PR #2 has a Ready Vercel preview deployment for branch `codex/catalog-service-split`.
- Local `main` is ahead of `origin/main` by the catalog service split spec and implementation plan commits.
- Local working tree has one duplicate untracked file, `src/app/api/catalog/services/catalog-commands.ts`, matching the PR #2 version.
- The linked Vercel project has all required production environment variable names present.
- The current production Vercel deployment is Ready, but it predates PR #2.

## Goal

Merge PR #2, deploy the updated `main` branch to Vercel production, and verify that the production build works on Vercel before any domain purchase or custom-domain connection work.

## Production Release Scope

This release covers:

1. PR #2 merge into `main`.
2. `main` deployment to Vercel production.
3. Production environment variable presence check.
4. Vercel production build/deployment inspection.
5. Basic production smoke checks.

This release does not cover:

1. Domain purchase.
2. Custom domain connection.
3. Supabase project plan upgrade.
4. Supabase SMTP setup.
5. Business/legal page authoring.
6. Online payment setup.

Those remain follow-up readiness tracks after production deployment is confirmed.

## Required Vercel Production Environment Variables

The production Vercel environment must include:

```txt
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_CATALOG_DATA_SOURCE=supabase
NEXT_PUBLIC_RESERVATION_DATA_SOURCE=supabase
NEXT_PUBLIC_FIELD_DATA_SOURCE=supabase
NEXT_PUBLIC_REPORT_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=product-images
NEXT_PUBLIC_MESSENGER_TARGET_URL
```

Production should also keep:

```txt
ALLOW_INSECURE_ROLE_HEADER=false
```

## Release Steps

1. Confirm PR #2 metadata is still open, mergeable, and targeting `main`.
2. Confirm PR #2 head status is successful.
3. Remove or move the duplicate local untracked file before syncing `main`.
4. Mark PR #2 ready for review if GitHub requires it before merge.
5. Merge PR #2 into `main`.
6. Pull `origin/main` into local `main`.
7. Run local verification:

```powershell
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
npm run build
```

8. Confirm Vercel production environment variable names are present.
9. Confirm Vercel production deployment for the merged `main` commit is Ready.
10. Inspect the production deployment.
11. Run smoke checks against the production URL.

## Smoke Checks

Minimum production smoke checks:

1. Public shop home page returns HTTP 200.
2. Admin login page returns HTTP 200.
3. Reset password page returns HTTP 200.
4. Public shop bootstrap API returns a non-500 response.
5. Catalog API returns a non-500 response.
6. Production Vercel runtime logs show no new errors during the smoke window, if log access is available.

## Supabase Production Readiness Notes

Supabase production readiness is a separate gate from the Vercel deploy itself. Before the shop is treated as fully launched on a purchased domain, confirm:

1. Real Supabase project is connected by Vercel production env vars.
2. Migrations in `supabase/migrations` are applied.
3. Storage bucket `product-images` exists and accepts product image flows.
4. Real admin and staff users exist.
5. RLS policies and security advisor findings have been reviewed.
6. Backups or plan upgrade decisions are made.
7. Custom SMTP is configured if password reset, invites, or email confirmations are needed for real users.

## Acceptance Criteria

1. PR #2 is merged into `main`.
2. `origin/main` contains the merged catalog service split.
3. Vercel has a Ready production deployment created from the merged `main` state.
4. Required production environment variable names are present in Vercel.
5. Local build passes after syncing the merged `main`.
6. Smoke checks do not show production 500s for the covered public/admin pages and APIs.

## Follow-Up Order

After this production deployment is confirmed:

1. Complete Supabase production readiness review.
2. Decide custom SMTP provider if auth emails are required.
3. Add or update contact, privacy, terms, reservation, and shop information pages.
4. Buy the final domain.
5. Connect the domain to Vercel.
6. Add Supabase auth redirect URLs for the final domain.
7. Run final smoke tests on the real domain.
