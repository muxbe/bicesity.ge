# V2 Auth And Production Access Spec

Status: draft
Date: 2026-05-13
Project: VeloHub / bicesity-ge.vercel.app

## Problem

The local app and Vercel production are not using the same Supabase project. Localhost uses the Supabase project that already has the working schema and product data, while Vercel is compiled against another Supabase project that is missing core tables such as `public.attributes` and `public.catalog_items`.

At the same time, the app needs a clean v2 authentication model:

- one login page for all users
- self-serve customer registration
- admin-controlled staff accounts
- Google login for customers only
- email/password login for staff access
- safe staff promotion and password reset flows

## Goals

1. Make Vercel production use the same Supabase project as local development.
2. Use `https://bicesity-ge.vercel.app` as the temporary production domain.
3. Keep a single `/login` page for admins, sellers, and customers.
4. Keep `/register` customer-only.
5. Allow admins to create and manage staff from `/admin/staff`.
6. Allow admins to promote an existing customer account to seller/admin.
7. Allow admins to reset staff passwords, except their own.
8. Add Google login for customers only.
9. Ensure Google login never grants seller/admin access, even when the email matches a staff profile.
10. Fix Supabase Auth redirect flows so they land on existing app routes.

## Non-Goals

1. Do not make separate admin/seller login pages.
2. Do not allow public seller/admin registration.
3. Do not make Google login a staff login method.
4. Do not permanently bind `abo.gulbani@gmail.com` as an admin in code.
5. Do not hardcode production secrets in the repository.
6. Do not change product/reservation/business rules as part of this auth work.
7. Do not use user-editable `user_metadata` for authorization.

## Current Evidence

Localhost app source is:

```txt
C:\Users\MSI\Desktop\bicycle shop
```

Localhost Supabase project:

```txt
blfjalavufthhsouifhq.supabase.co
```

Vercel production URL:

```txt
https://bicesity-ge.vercel.app
```

Vercel currently uses a different Supabase project:

```txt
faehudvfvljyksbxujdm.supabase.co
```

Observed production API errors:

```txt
/api/fields -> PGRST205: Could not find the table 'public.attributes' in the schema cache
/api/catalog -> PGRST205: Could not find the table 'public.catalog_items' in the schema cache
```

Observed local redirect misses:

```txt
GET /auth/confirm 404
GET /auth/reset-password 404
GET /auth/login 404
```

## User Roles

### Customer

Customers can:

- register themselves with email/password
- confirm email before email/password login is accepted
- login with email/password
- login with Google
- browse the shop and product pages

Customers cannot:

- access `/admin`
- access `/seller`
- create staff accounts
- become staff without an admin action

### Seller

Sellers can:

- login only with email/password
- access seller routes if their `public.profiles` row has `role = seller` and `is_active = true`

Sellers cannot:

- register themselves as sellers
- use Google login for seller access
- manage staff

### Admin

Admins can:

- login only with email/password for admin access
- access `/admin` if their `public.profiles` row has `role = admin` and `is_active = true`
- create staff users
- promote existing customers to seller/admin
- update staff role/status/name
- reset staff passwords, except their own

Admins cannot:

- deactivate their own admin profile
- remove their own admin role
- reset their own password through staff management

## Bootstrap Admin

`abo.gulbani@gmail.com` is the current bootstrap admin email.

This email should not be hardcoded as a permanent admin. It should be represented as a normal `public.profiles` row:

```txt
email = abo.gulbani@gmail.com
role = admin
is_active = true
```

After bootstrap, admin access should be managed through `/admin/staff`.

## Staff Source Of Truth

`public.profiles` remains the source of truth for staff roles.

Expected profile fields include:

```txt
user_id
email
full_name
role
is_active
```

Valid staff roles:

```txt
admin
seller
```

A missing profile means customer access.

An inactive profile means customer access.

`app_metadata.app_role` can remain supporting metadata for Supabase Auth users, but staff authorization should not depend on user-editable `user_metadata`.

## Login Method Rule

Login method is session-specific.

The same email can behave differently depending on how the user logged in:

```txt
admin@example.com logs in with Google
-> role = user for that session

admin@example.com logs out
admin@example.com logs in with email/password
-> role = admin if public.profiles says admin + active
```

## Session Authentication Method

The app should use the Supabase access token `amr` claim to identify how the current session authenticated.

Supabase documents `amr` as the Authentication Methods Reference claim. Expected methods include:

```txt
password
oauth
recovery
magiclink
```

Rules:

- `amr.method = password` allows staff role lookup from `public.profiles`
- non-password methods force role `user`
- missing `amr` forces role `user`
- Google OAuth sessions use `oauth` and always resolve to `user`
- password reset/recovery sessions must not become staff sessions

The server must validate the access token with Supabase before using its decoded `amr` claim.

## Auth Flow

### Email/Password Customer Registration

1. Customer opens `/register`.
2. Customer creates account with email/password.
3. Supabase sends confirmation email.
4. Confirmation link returns to `/login`.
5. Customer signs in after confirmation.
6. Supabase issues a session with password AMR.
7. App resolves role.
8. Missing staff profile means `user`.

### Email/Password Staff Login

1. Staff opens `/login`.
2. Staff enters email/password.
3. App signs in with Supabase password auth.
4. Supabase issues a session with password AMR.
5. `/api/auth/me` validates token and checks `amr`.
6. If AMR is `password`, `/api/auth/me` checks `public.profiles`.
7. Active `admin` profile gets `/admin` access.
8. Active `seller` profile gets `/seller` access.
9. Missing/inactive profile gets customer access.

### Google Customer Login

1. Customer opens `/login` or `/register`.
2. Customer clicks Continue with Google.
3. Supabase handles Google OAuth.
4. Supabase redirects back to `/login`.
5. App detects OAuth session.
6. `/api/auth/me` validates token and sees non-password AMR.
7. `/api/auth/me` returns role `user`, regardless of staff profile.
8. Customer can return only to `/` or `/shop/...`.

Blocked Google return paths:

```txt
/admin...
/seller...
```

### Logout

1. App signs out from Supabase.
2. Supabase clears the browser session.
3. User returns to `/login` or shop.

## Staff Management Flow

### Create New Staff

If admin enters an email that does not exist in Supabase Auth:

1. Create Supabase Auth user.
2. Set temporary password.
3. Confirm email automatically.
4. Create `public.profiles` row.
5. Assign role `admin` or `seller`.
6. Set `is_active = true`.

### Promote Existing Customer

If admin enters an email that already exists as a customer:

1. Find existing Supabase Auth user.
2. Create or update `public.profiles` row.
3. Assign role `admin` or `seller`.
4. Set `is_active = true`.
5. If admin entered a temporary password, reset that user's password.
6. Do not create duplicate auth users.

### Update Existing Staff

If admin enters an email that already has a staff profile:

1. Update role/name/status as requested.
2. If a temporary password is provided, reset password.
3. Do not duplicate profile.

### Self-Protection

Current admin cannot:

- deactivate their own staff profile
- change their own role away from admin
- reset their own password from `/admin/staff`

Own password changes must use verified password reset.

## Supabase Auth Configuration

Temporary production Site URL:

```txt
https://bicesity-ge.vercel.app
```

Allowed redirect URLs:

```txt
https://bicesity-ge.vercel.app/**
http://localhost:3000/**
https://*-abelis-projects.vercel.app/**
```

Return pages:

```txt
Email confirmation -> /login
Password reset -> /reset-password
Google OAuth -> /login, then app redirects customer safely
```

Google OAuth provider redirect URI in Google Cloud should point to Supabase:

```txt
https://blfjalavufthhsouifhq.supabase.co/auth/v1/callback
```

## Vercel Configuration

Production Vercel should use the same Supabase project as local development.

Required Vercel env vars:

```txt
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_CATALOG_DATA_SOURCE=supabase
NEXT_PUBLIC_RESERVATION_DATA_SOURCE=supabase
NEXT_PUBLIC_FIELD_DATA_SOURCE=supabase
NEXT_PUBLIC_REPORT_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://blfjalavufthhsouifhq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<matching public anon key>
SUPABASE_SERVICE_ROLE_KEY=<matching service role key>
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=product-images
NEXT_PUBLIC_MESSENGER_TARGET_URL=<configured messenger URL>
ALLOW_INSECURE_ROLE_HEADER=false
```

After changing Vercel env vars, redeploy production.

`AUTH_SESSION_SECRET` is not required for the AMR-based v2 auth model. If it already exists in Vercel, it can remain unused.

## Acceptance Criteria

1. `https://bicesity-ge.vercel.app/api/fields` returns `200` with field data.
2. `https://bicesity-ge.vercel.app/api/catalog` returns `200` with catalog data.
3. Public shop loads on Vercel without `/api/shop/bootstrap` failure.
4. `abo.gulbani@gmail.com` can login with email/password and access `/admin` while active admin profile exists.
5. Admin can create a new seller/admin with temporary password.
6. Admin can promote an existing customer email to seller/admin.
7. Admin can reset another staff user's password.
8. Admin cannot reset their own password from staff management.
9. Admin cannot deactivate/remove their own admin access.
10. Customer can register with email/password and must confirm email.
11. Customer can login with Google.
12. Google login always resolves role `user`.
13. Google login cannot enter `/admin` or `/seller`.
14. Logout clears the Supabase browser session.
15. Missing/non-password AMR resolves role `user`.
16. Authorization code and database role helpers do not trust `user_metadata` for roles.

## Rollback

If production auth becomes unstable:

1. Revert code deployment to the previous Vercel deployment.
2. Keep Supabase database untouched unless a specific migration caused the issue.
3. Re-check Vercel env vars before redeploying.
4. Bootstrap admin can be restored by running the staff role SQL for `abo.gulbani@gmail.com`.
