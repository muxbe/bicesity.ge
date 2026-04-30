# Vercel Deployment

This app is a Next.js project and is ready for Vercel's Next.js preset.

## Project Settings

- Framework preset: `Next.js`
- Root directory: repository root
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave default
- Node.js version: `20.x`

These defaults are also recorded in `vercel.json`.

## Required Environment Variables

Set these in Vercel for Production, Preview, and Development as needed:

```bash
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_CATALOG_DATA_SOURCE=supabase
NEXT_PUBLIC_RESERVATION_DATA_SOURCE=supabase
NEXT_PUBLIC_FIELD_DATA_SOURCE=supabase
NEXT_PUBLIC_REPORT_DATA_SOURCE=supabase

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=product-images

NEXT_PUBLIC_MESSENGER_TARGET_URL=https://m.me/your-page-or-profile
ALLOW_INSECURE_ROLE_HEADER=false
```

Never commit `.env.local` or real Supabase keys. The repository includes only `.env.example`.

## Supabase Checklist

Before production deployment:

1. Run all SQL migrations in `supabase/migrations`.
2. Confirm the storage bucket from `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` exists or let the admin upload endpoint create it.
3. Create at least one admin user/profile.
4. In Supabase Auth, allow the Vercel production domain as an auth redirect URL.
5. Add password reset redirect URLs in Supabase Auth:
   - `https://your-domain.com/reset-password`
   - `http://localhost:3000/reset-password` for local testing
6. Keep `ALLOW_INSECURE_ROLE_HEADER=false` on Vercel.

## Local Verification

Run this before pushing or deploying:

```bash
npm ci
npm run build
```

If you have Vercel CLI linked and want to build with Vercel production env values:

```bash
vercel env run -e production -- npm run build
```
