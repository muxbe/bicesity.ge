# V2 Auth And Production Access Implementation Plan

Status: draft
Date: 2026-05-13
Spec: `docs/specs/v2-auth-and-production-access-spec.md`

## Phase 0: Confirm Scope

Before implementation, confirm these decisions one final time:

1. Vercel production should use Supabase project `blfjalavufthhsouifhq`.
2. Temporary production domain is `https://bicesity-ge.vercel.app`.
3. Google login is customer-only.
4. Staff login is email/password only.
5. Admin can promote existing customers and reset staff passwords, except their own.
6. Supabase JWT `amr` is used to distinguish password sessions from OAuth sessions.
7. Missing/non-password AMR defaults to customer-only.

No code changes should begin until this plan is approved.

## Phase 1: Production Environment Alignment

Owner: user or agent if Vercel access is available.

Steps:

1. Open Vercel project for `bicesity-ge.vercel.app`.
2. Set Production env vars to match local Supabase project:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://blfjalavufthhsouifhq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local matching anon key>
SUPABASE_SERVICE_ROLE_KEY=<local matching service role key>
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=product-images
```

3. Confirm all data source flags are `supabase`:

```txt
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_CATALOG_DATA_SOURCE=supabase
NEXT_PUBLIC_RESERVATION_DATA_SOURCE=supabase
NEXT_PUBLIC_FIELD_DATA_SOURCE=supabase
NEXT_PUBLIC_REPORT_DATA_SOURCE=supabase
```

4. Add:

```txt
ALLOW_INSECURE_ROLE_HEADER=false
```

5. `AUTH_SESSION_SECRET` is not required by the AMR-based v2 auth model. If it already exists in Vercel, leave it unused.
6. Redeploy production.
7. Verify:

```txt
/api/fields -> 200
/api/catalog -> 200
/api/shop/bootstrap -> 200
```

Risk:

- Vercel env changes do not affect existing deployments. A redeploy is required.

## Phase 2: Supabase Auth Dashboard Configuration

Owner: user, with agent guidance.

Steps:

1. In Supabase project `blfjalavufthhsouifhq`, set Auth Site URL:

```txt
https://bicesity-ge.vercel.app
```

2. Add redirect URLs:

```txt
https://bicesity-ge.vercel.app/**
http://localhost:3000/**
https://*-abelis-projects.vercel.app/**
```

3. Confirm password reset redirect uses:

```txt
https://bicesity-ge.vercel.app/reset-password
http://localhost:3000/reset-password
```

4. Confirm email confirmation returns to `/login`.
5. Enable Google provider.
6. In Google Cloud OAuth client, add authorized redirect URI:

```txt
https://blfjalavufthhsouifhq.supabase.co/auth/v1/callback
```

Risk:

- Wrong redirect URLs produce 404s such as `/auth/confirm`, `/auth/reset-password`, or `/auth/login`.

## Phase 3: Bootstrap Admin Verification

Owner: user or agent if Supabase access is available.

Steps:

1. Confirm `abo.gulbani@gmail.com` exists in `auth.users`.
2. Confirm `public.profiles` has matching row:

```txt
role = admin
is_active = true
```

3. If missing, adapt and run `supabase/sql/set_staff_role.sql` for `abo.gulbani@gmail.com`.
4. Login locally with email/password.
5. Confirm `/admin` opens.

Risk:

- If no active admin exists, `/admin/staff` cannot be used to repair access without SQL.

## Phase 4: Supabase AMR And Metadata Hardening

Files likely to change:

```txt
src/lib/auth/app-role.ts
src/features/auth/auth-provider.tsx
src/lib/auth/server.ts
supabase/migrations/<new>_harden_auth_role_metadata.sql
```

Implementation steps:

1. Add a small helper for reading the Supabase access token `amr` claim after the token has been validated by `supabase.auth.getUser(token)`.
2. Supported staff-eligible AMR:

```txt
password
```

3. Treat these AMR states as customer-only:

```txt
oauth
recovery
magiclink
missing/unknown
```

4. Remove role fallback from user-editable `user_metadata` in TypeScript helpers.
5. Add a database migration so `public.current_app_role()` no longer reads `auth.jwt() -> 'user_metadata' ->> 'app_role'`.
6. Keep `app_metadata.app_role` as supporting server-controlled metadata.

Risk:

- AMR is inside the JWT payload, so the server should only use it after `supabase.auth.getUser(token)` validates the token.
- Removing `user_metadata` role fallback could expose old misconfigured staff users; those users should be repaired with `public.profiles` or `app_metadata`.

## Phase 5: Server Role Resolver Update

Files likely to change:

```txt
src/lib/auth/server.ts
src/app/api/auth/me/route.ts
```

Implementation steps:

1. Validate the bearer token with `supabase.auth.getUser(token)`.
2. Decode/read the already-validated token AMR.
3. If AMR is missing or does not include `password`, role resolves to `user`.
4. If AMR includes `password`, profile role can resolve to `admin` or `seller` when active.
5. Keep `public.profiles` as source of truth for staff.
6. Do not use `user_metadata` for authorization decisions.

Risk:

- Existing OAuth sessions for staff emails will become customer-only, which is intended.
- Password reset/recovery sessions must stay customer-only until the user signs in normally with password.

## Phase 6: Auth Provider And Login UI Update

Files likely to change:

```txt
src/features/auth/auth-provider.tsx
src/app/login/login-form.tsx
src/lib/i18n/dictionaries.ts
```

Implementation steps:

1. Replace `signInWithFacebook` with `signInWithGoogle`.
2. Use Supabase OAuth provider:

```txt
google
```

3. Do not add a custom login-method cookie or session-method API.
4. Let `/api/auth/me` resolve role from the validated token AMR.
5. Keep Google button hidden/blocked when `next` starts with:

```txt
/admin
/seller
```

6. Allow Google safe return only to:

```txt
/
/shop/...
```

7. Update copy from Facebook to Google in all languages.
8. On logout, rely on Supabase sign-out to clear the browser session.

Risk:

- OAuth return timing can still race with the initial session load. If the role fetch happens early, defaulting to `user` is safe.

## Phase 7: Staff API Existing User Promotion

Files likely to change:

```txt
src/app/api/staff/route.ts
src/app/api/staff/[id]/route.ts
src/app/admin/staff/page.tsx
src/lib/i18n/dictionaries.ts
```

Implementation steps:

1. In `POST /api/staff`, when `createUser` fails because user already exists, look up the existing auth user by email.
2. If user exists:

```txt
create/update public.profiles
set selected role
set is_active=true
```

3. If admin provided temporary password, update existing user's password.
4. If existing user already has a profile, update it rather than duplicating.
5. Continue updating `app_metadata.app_role` for staff users as supporting metadata, but do not rely on it as the primary source of truth.
6. Block current admin from resetting their own password in staff routes.
7. Consider making password optional when promoting an existing user, but if provided, it resets password.
8. Show UI copy that existing users can be promoted.

Risk:

- Supabase Admin API must be used only on server with service role key.
- Password reset through staff management must never target the current admin.

## Phase 8: Documentation Update

Files likely to change:

```txt
docs/vercel-deployment.md
docs/specs/v2-auth-and-production-access-spec.md
docs/plans/v2-auth-and-production-access-implementation-plan.md
.env.example
```

Steps:

1. Update Vercel deployment checklist with temporary domain and redirect URLs.
2. Document Google provider setup.
3. Document staff promotion behavior.
4. Document AMR-based staff eligibility.
5. Document that `AUTH_SESSION_SECRET` is not required for this version.

## Phase 9: Local Verification

Commands:

```bash
npm run build
```

Manual checks:

1. `/login` loads.
2. Email/password admin login has password AMR and opens `/admin`.
3. Email/password seller login opens `/seller`.
4. Customer registration still requires email confirmation.
5. Google login returns to customer shop.
6. Google login cannot access `/admin` or `/seller`.
7. Existing customer can be promoted to seller/admin.
8. Admin can reset another staff user's password.
9. Admin cannot reset their own password from staff page.
10. Password reset/recovery session does not grant staff access.
11. Logout clears Supabase session and access.

## Phase 10: Production Verification

After deployment:

1. Check public APIs:

```txt
https://bicesity-ge.vercel.app/api/fields
https://bicesity-ge.vercel.app/api/catalog
https://bicesity-ge.vercel.app/api/shop/bootstrap
```

2. Check login flows:

```txt
/admin -> /login?next=/admin
email/password admin -> /admin
Google -> /
```

3. Check Supabase Auth redirects:

```txt
email confirmation -> /login
password reset -> /reset-password
Google OAuth -> /login -> /
```

4. Check staff page:

```txt
/admin/staff
```

## Rollback Plan

1. Revert to previous Vercel deployment if auth breaks.
2. Do not delete Supabase users/profiles during rollback unless a specific bad write is identified.
3. Restore admin access with `supabase/sql/set_staff_role.sql` if needed.
4. Re-run public API checks after rollback.

## Approval Gate

Implementation should start only after the user approves this plan with a clear instruction such as:

```txt
implement it
code it
go ahead
```
