# Supabase Production Readiness Audit

Status: review complete, fixes pending approval
Date: 2026-07-08
Project: VeloHub / Bike City
Supabase project host: `blfjalavufthhsouifhq.supabase.co`

## Scope

This audit reviewed whether the current Supabase project is ready to support the production Vercel deployment before a custom domain is purchased or connected.

This was a read-only review. No Supabase schema, data, auth, storage, or dashboard configuration was changed.

## Source Checklist

Official Supabase references used:

- Supabase production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
- Supabase custom SMTP guidance: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase product security guidance: https://supabase.com/docs/guides/security/product-security
- Supabase changelog scan: https://supabase.com/changelog.md

Relevant changelog note:

- 2026-04-28: Supabase changed table exposure behavior for Data/GraphQL APIs. New SQL-created tables may need explicit API grants. This project has explicit grants, but they are currently much broader than needed.

## Evidence Collected

### App Configuration

- Local `.env.local` points at Supabase host `blfjalavufthhsouifhq.supabase.co`.
- Local data-source flags are all set to `supabase`.
- Local storage bucket setting is `product-images`.
- Local public anon key is present.
- Local service role key is present.
- Vercel Production has the required Supabase environment variable names present.

Secrets were not printed or copied into this audit.

### CLI And Migration State

- Supabase CLI installed: `2.105.0`.
- CLI reports newer available version: `2.109.1`.
- `supabase migration list --linked` shows every local migration is applied remotely:
  - `202604130001`
  - `202604130002`
  - `202604130003`
  - `202604140004`
  - `202604180005`
  - `202604180006`
  - `202604190007`
  - `202604190008`
  - `202604190009`
  - `202604190010`
  - `202604190011`
  - `202604190012`
  - `202604200010`
  - `202604270013`
  - `202605130014`
  - `202605180001`
  - `20260617101214`

### Live Database State

All reviewed public app tables have RLS enabled:

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

`product-images` storage bucket exists with:

- Public bucket: `true`
- File size limit: `5242880` bytes
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`

Auth/staff counts:

- Auth users: `4`
- Active admin profiles: `3`
- Active seller profiles: `0`

Catalog data sanity:

- Active catalog items: `16`
- Archived catalog items: `14`
- Sold catalog items: `1`

## Findings

### High: Table Grants Are Over-Broad

Raw table ACLs show `anon` and `authenticated` have broad table-level privileges across public app tables, including `DELETE`, `INSERT`, `MAINTAIN`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, and `UPDATE`.

RLS is enabled and should still block unauthorized rows/actions, but production hardening should not depend on RLS as the only boundary. Supabase's production checklist calls for reviewing RLS and security posture before production launch.

Recommended fix:

1. Create a migration that revokes broad privileges from `anon` and `authenticated`.
2. Re-grant only required privileges:
   - `anon`: public read-only tables/views needed by the public shop.
   - `authenticated`: minimum read/write privileges needed if any client-side Supabase table access remains.
   - Most admin/staff table writes can remain service-role-only because the app uses server API routes.
3. Verify public shop reads, login/reset auth flows, admin pages, and API routes after applying.

### High: Public Roles Can Execute Security Definer Helpers

Supabase Security Advisor warns that these `SECURITY DEFINER` functions are executable by `anon` and `authenticated`:

- `public.current_app_role()`
- `public.is_admin()`
- `public.is_seller_or_admin()`
- `public.rls_auto_enable()`

`current_app_role()`, `is_admin()`, and `is_seller_or_admin()` are role helper functions used by policies, but their public RPC exposure should be explicitly justified or removed. `rls_auto_enable()` is especially suspicious as a public RPC surface because it is an internal/event-trigger style helper, not an application API.

Recommended fix:

1. Revoke direct RPC execution from `anon` and `authenticated` where direct execution is not required.
2. Confirm RLS policies still work after revocation.
3. Consider replacing helper grants with safer policy patterns or moving helper functions out of exposed schemas if possible.

### High: Custom SMTP Is Not Confirmed

The app includes:

- Email/password sign in.
- Sign up.
- Password reset.
- Staff user creation through Supabase admin APIs.
- Password reset page.

Supabase's custom SMTP docs say the default SMTP service is not meant for production and can be limited to team-authorized addresses and very low rate limits.

Recommended fix:

1. Choose a production SMTP provider.
2. Configure Supabase Auth SMTP.
3. Add final domain auth redirect URLs after domain connection.
4. Test password reset and any staff invite/signup flow on production.

### Medium: Function Search Paths Need Hardening

Supabase Security Advisor reports mutable search path warnings for these functions:

- `public.set_updated_at`
- `public.ensure_bicycle_parent_type`
- `public.ensure_part_parent_type`
- `public.ensure_attribute_value_category_match`
- `public.enforce_catalog_item_status_transition`
- `public.prevent_hard_delete_catalog_items`
- `public.prevent_hard_delete_attributes`
- `public.enforce_reservation_state`
- `public.sync_item_status_from_reservation`
- `public.apply_sale_effects`
- `public.enforce_sales_edit_window`
- `public.log_sale_correction`

Recommended fix:

1. Add explicit `set search_path = public` or a narrower required schema list to each function.
2. Re-run Security Advisor.

### Medium: Leaked Password Protection Disabled

Supabase Security Advisor reports leaked password protection is disabled.

Recommended fix:

1. Enable leaked password protection in Supabase Auth settings.
2. Re-test sign-in and staff password reset flows.

### Medium: RLS Performance Warnings

Supabase Performance Advisor reports:

- `profiles_select_policy` re-evaluates an auth function per row.
- Multiple permissive SELECT policies exist for `attributes`, `bicycles`, `catalog_items`, `item_attribute_values`, `parts`, and `product_images`.

Recommended fix:

1. Replace direct auth helper calls with `(select auth.uid())` or equivalent patterns where relevant.
2. Consolidate duplicate permissive public read policies.
3. Re-run Performance Advisor.

### Medium: Staff Roles Need Business Confirmation

The live project has 3 active admin profiles and 0 active seller profiles.

This is acceptable only if the shop will be operated entirely by admins at launch. If seller/staff accounts are part of launch operations, create real seller profiles before the final domain smoke test.

### Manual Dashboard Gates Still Open

The following production checklist items were not verifiable from the local CLI review:

- Supabase plan and backup/PITR status.
- SSL enforcement.
- Network restrictions.
- Organization MFA enforcement.
- Multiple owner access.
- Auth email confirmation and OTP expiry settings.
- Custom SMTP status.
- Final-domain redirect URLs.
- Load testing/staging plan.

These must be confirmed in the Supabase dashboard before the domain is treated as fully launched.

## Readiness Decision

Supabase is connected and functional enough for the current Vercel production deployment:

- Production env names are present.
- Migrations are applied.
- RLS is enabled on app tables.
- Storage bucket exists.
- Auth users and admin profiles exist.
- Public production smoke checks returned HTTP 200 after deploy.

Supabase is not yet fully production-hardened for final domain launch because the high-priority security and auth email items above remain open.

## Proposed Fix Order

1. Write and review a privilege/function hardening migration.
2. Apply it to a safe environment first if available.
3. Run local build and API smoke checks.
4. Apply to production after approval.
5. Re-run Supabase Security Advisor and Performance Advisor.
6. Configure custom SMTP.
7. Confirm dashboard-only production gates.
8. Run final production smoke test.
