# Supabase Catalog Rollout

Last updated: April 13, 2026

## 1) Apply migrations

Run in order:
1. `supabase/migrations/202604130001_initial_schema.sql`
2. `supabase/migrations/202604130002_business_rules_and_indexes.sql`
3. `supabase/migrations/202604130003_seed_mock_baseline.sql`
4. `supabase/migrations/202604140004_enable_rls_and_rbac.sql`

Optional validation script:
1. `supabase/sql/verify_step3_constraints.sql`

## 2) Configure environment variables

Use `.env.local`:

```env
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_CATALOG_DATA_SOURCE=mock
NEXT_PUBLIC_RESERVATION_DATA_SOURCE=mock
NEXT_PUBLIC_FIELD_DATA_SOURCE=mock
NEXT_PUBLIC_REPORT_DATA_SOURCE=mock
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=product-images
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Notes:
1. `NEXT_PUBLIC_CATALOG_DATA_SOURCE=supabase` enables Supabase adapter for catalog reads/writes.
2. `NEXT_PUBLIC_RESERVATION_DATA_SOURCE`, `NEXT_PUBLIC_FIELD_DATA_SOURCE`, and `NEXT_PUBLIC_REPORT_DATA_SOURCE` can be switched per feature.
3. `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` is used by admin image uploads.
4. If Supabase env vars are missing, app falls back to mock adapter.
5. RLS migration expects JWT app role claim in one of:
   - `app_role`
   - `app_metadata.app_role`
   - `user_metadata.app_role`
6. Supported app-role values: `admin`, `seller`, `user`.

## 3) Critical fields command endpoint

Endpoint:
1. `PATCH /api/catalog/:id/critical`

Body:

```json
{
  "price": 9999,
  "stockCount": 2
}
```

Rules:
1. At least one of `price` or `stockCount` is required.
2. Validation failures return `400`.
3. Product not found returns `404`.
