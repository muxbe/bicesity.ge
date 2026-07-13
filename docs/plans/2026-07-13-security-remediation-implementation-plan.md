# Security Remediation Implementation Plan

Date: 2026-07-13
Status: proposed implementation plan — no application changes are authorized by this document
Approved specification: `docs/specs/2026-07-13-security-remediation.md`

## 1. Goal

Implement the approved security specification without changing normal business behavior, exposing internal data, or making the customer experience measurably slower.

In this plan, **public field** means a field visible to an authenticated ordinary customer. It does not mean an anonymous endpoint. The existing login requirement stays in place: anonymous shop bootstrap and product-detail requests must return `401`.

The implementation must preserve these rules:

- Only an admin can change field visibility.
- Sellers can see internal inventory data but cannot change visibility.
- Customers receive only fields currently marked public by an admin.
- A hidden field is omitted by the server, not merely hidden by CSS.
- Administrator-controlled visibility covers every configurable core field, including rating, and every custom field.
- Discount reasons are always staff-only, even when the discount field is public.
- Customers and sellers cannot upload product images; uploads remain admin-only.
- Bulk operations contain at most 100 unique item IDs.
- New or changed passwords require at least 12 characters without blocking legacy users solely because an old password is shorter.
- Admin MFA becomes mandatory only after enrollment and recovery are tested.
- Content Security Policy starts in report-only mode.

## 2. Non-goals

This work will not:

- redesign the shop, inventory, field editor, or product forms;
- replace Supabase Auth, Storage, or the catalog repository architecture;
- make the product catalog anonymous;
- add a remote request or remote cache lookup to every API call;
- add per-product database queries;
- convert existing staff endpoints to the customer DTO;
- enable enforcement in Supabase, Vercel, or production without a separate approval;
- combine all security changes into one risky deployment.

## 3. Target Architecture

### 3.1 Separate customer and staff contracts

Keep `ProductDTO` as the complete staff contract. Add a separate `PublicProductDTO` for authenticated customers. The customer type must be structurally unable to contain internal-only properties.

Recommended public shape:

```ts
type PublicProductDTO = {
  id: string;
  core: Partial<{
    category: ProductCategory;
    name: string;
    driveType: string;
    serial: string;
    price: PublicPriceDTO;
    discount: PublicDiscountDTO;
    stockCount: number;
    images: string[];
    description: string;
    rating: number;
  }>;
  values: Record<string, string>;
};
```

Important constraints:

- Construct this DTO property by property; never use `{ ...product }`.
- Omit a hidden property completely instead of returning `null`, an empty string, a derived boolean, or a fallback that reveals it.
- `PublicPriceDTO` exists only when price is public and may contain base/current display prices. `PublicDiscountDTO` exists only when discount is public and may contain type/amount/percent/label, but never a calculated price when price is hidden.
- `PublicDiscountDTO` never contains `discountReason`, raw staff notes, actor IDs, or audit data.
- If stock is hidden, do not return `inStock`, stock filters, stock badges, or another derived value that reveals stock.
- Customer buttons and empty states must not branch on a hidden stock value. When stock is hidden, every active product receives the same neutral “Ask seller about availability” action; when stock is public, the current stock-aware label/state may be used.
- If category, name, image, or another presentation field is hidden, the UI uses a neutral local fallback or hides that UI section. It must not recover the value from another endpoint.

### 3.2 Shared server-backed field layout

The current core-field visibility is stored in browser `localStorage`, so it is not an authorization source and differs by browser. Store the validated layout in the existing singleton `app_settings` row as versioned JSONB. Custom-field visibility remains in `attributes.is_public`.

The JSON document should contain only:

```ts
type StoredFieldLayout = {
  version: 1;
  configured: boolean;
  order: Partial<Record<ProductCategory, string[]>>;
  coreVisibility: Partial<Record<ProductCategory, Partial<Record<CoreFieldKey, boolean>>>>;
  coreLabels: Partial<Record<ProductCategory, Partial<Record<CoreFieldKey, string>>>>;
  coreOptions: Partial<Record<CoreFieldKey, CoreFieldOption[]>>;
};
```

Using `app_settings` avoids a new table and lets shop settings and core visibility be read in one database query. Server code must validate, normalize, length-limit, deduplicate, and default this document before use.

### 3.3 Customer query path

Use dedicated shop reads:

- `GET /api/shop/bootstrap`: authenticated request, active products only, customer DTO only.
- `GET /api/shop/products/[id]`: authenticated request, active requested product only, customer DTO only.
- `GET /api/catalog` and `GET /api/catalog/[id]`: verified admin/seller only, full staff DTO.
- Catalog mutations continue using their existing role rules, with admin-only changes unchanged unless the specification says otherwise.

The product page already knows the authenticated role. It should use the staff repository for admin/seller and the shop repository for an ordinary customer. That preserves internal staff detail while preventing a union-shaped API response.

### 3.4 Query-count design

The Phase 0 code-path baseline confirmed that customer bootstrap currently performs five database reads: field definitions, field options, catalog items, all attribute values, and settings. The target is three:

1. active catalog items with their public attribute values through a scoped nested select;
2. public active field definitions with active options through a nested select;
3. settings and field-layout JSON from the same `app_settings` row.

Start independent reads concurrently. Do not query attributes once per product.

Customer product detail currently performs two reads. Keep the target at two:

1. the active requested catalog item with nested public values and required field metadata;
2. settings and field-layout JSON.

If the nested Supabase relationship cannot produce the required filtering correctly, stop and benchmark a single, narrowly scoped SQL function. Do not silently fall back to fetching all attribute values.

## 4. Performance and Safety Gates

Record a baseline before changing code and compare the same authenticated requests after every relevant phase.

Required gates:

- Customer bootstrap database reads: no more than the verified baseline of 5; target 3.
- Customer detail database reads: no more than 2.
- No N+1 database or HTTP requests.
- Customer response bytes: no larger than baseline; expected to decrease.
- Warm p95 API latency: no more than 10% slower than baseline.
- Page must not add a separate browser request only to obtain visibility configuration.
- Static security headers must not force dynamic rendering.
- Rate limiting must run at the Vercel edge, not through a remote application-side store.
- Image decoding must occur only in the admin upload request, never on reads or page rendering.
- Production dependency audit must remain free of known production vulnerabilities.

If a gate fails, do not continue to the next rollout phase. Revert that phase or revise the design and discuss it before implementation.

## 5. Phase 0 — Baseline and Test Harness

Purpose: create proof of current behavior before modifying it.

Files to add during implementation:

- `docs/audits/2026-07-13-security-performance-baseline.md`
- `docs/tests/verify-public-catalog-boundary.mjs`
- `docs/tests/verify-security-remediation-structure.mjs`

Steps:

- [ ] Confirm the working tree and preserve unrelated user changes.
- [ ] Run every existing `docs/tests/verify-*.mjs` script and `npm run build`.
- [ ] Run `npm audit --omit=dev` and record the result.
- [ ] Record bootstrap/detail status codes, database-call counts, response bytes, and warm p50/p95 on a local or preview environment using authenticated customer and staff sessions.
- [ ] Record the customer-visible keys for a representative Bicycle and Parts item.
- [ ] Search for browser-side `.from(...)`, `.rpc(...)`, and Storage writes. Confirm browser code uses Supabase directly only for Auth before database grants are changed.
- [ ] Add failing structural/behavior checks for forbidden public keys, anonymous access, seller visibility mutation, and the 100-item bulk limit.
- [ ] Ensure verification scripts use existing Node/TypeScript tooling and add no production runtime dependency.

Approval checkpoint: show the baseline and failing tests before starting Phase 1.

## 6. Phase 1 — Persist and Validate Field Layout

Purpose: replace browser-local security state with a shared server authority without switching customer output prematurely.

Expected files:

- `supabase/migrations/<timestamp>_add_field_layout_to_app_settings.sql`
- `src/features/fields/field-layout.ts`
- `src/app/api/fields/field-layout-service.ts` (new)
- `src/app/api/fields/layout/route.ts` (new)
- `src/features/fields/data/field-repository.ts`
- `src/features/fields/adapters/api/field-repository.api.ts`
- `src/features/fields/adapters/mock/field-repository.mock.ts`
- `src/features/fields/admin/use-field-settings-controller.ts`
- related field-settings UI status/error components and tests

Steps:

- [ ] Add a non-null `field_layout_config jsonb` column to the singleton `app_settings` row with conservative code-default visibility and `configured: false`.
- [ ] Add a database shape constraint only if it is simple and rollback-safe; application validation remains authoritative for allowed keys and lengths.
- [ ] Export `FieldLayoutConfig` and one canonical default builder from `field-layout.ts`.
- [ ] Add a pure `normalizeFieldLayoutConfig()` that ignores unknown categories/keys, limits label/option lengths and counts, removes duplicates, and returns safe defaults for invalid JSON.
- [ ] Add `rating` to the configurable core-field keys/definitions for both product categories with a conservative internal default until an admin reviews it.
- [ ] Read settings and layout together through one `readShopConfiguration()` service query.
- [ ] Add `GET /api/fields/layout` for authenticated staff and `PATCH /api/fields/layout` for admins only.
- [ ] Resolve authentication once per request. Do not call `getRequestAuth()` and a second role helper for the same request.
- [ ] Make the admin field controller load and save the server layout asynchronously with a visible pending/error state and rollback on failed save.
- [ ] Keep sellers read-only. A forged seller/customer PATCH must return `403` and leave data unchanged.
- [ ] Add a one-time admin review flow when `configured` is false. If this browser has the old `velohub.fieldLayout.v1` value, show an explicit import preview; never automatically trust modified localStorage.
- [ ] The admin must either confirm the imported layout or confirm conservative defaults. Only then set `configured: true`.
- [ ] Keep the customer response on its existing behavior until this review is complete. This prevents a deployment from unexpectedly exposing or hiding fields.
- [ ] After confirmation, stop using localStorage as authority. It may remain temporarily only as an import source and should be removed in the cleanup phase.

Rollback: application code can continue reading defaults while the added JSONB column remains unused. The additive column need not be dropped during an emergency rollback.

Approval checkpoint: demonstrate that two browsers see the same configuration and only an admin can update it.

## 7. Phase 2 — Enforce the Customer Data Boundary

Purpose: make server responses follow the approved visibility configuration.

Expected files:

- `src/features/catalog/dto/public-product-dto.ts` (new)
- `src/app/api/shop/public-product-mapper.ts` (new pure mapper)
- `src/app/api/catalog/services/catalog-attributes.ts`
- `src/app/api/catalog/services/catalog-queries.ts`
- `src/app/api/shop/bootstrap/route.ts`
- `src/app/api/shop/products/[id]/route.ts` (new)
- `src/features/shop/shop-bootstrap.ts`
- `src/features/shop/data/shop-repository.ts` (new)
- `src/features/shop/adapters/api/shop-repository.api.ts` (new)
- `src/features/shop/home/home-types.ts`
- `src/features/shop/home/use-home-catalog.ts`
- `src/features/shop/home/use-home-filters.ts`
- customer product card, filter, gallery, and detail components affected by optional public fields
- catalog route role checks and verification scripts

Steps:

- [ ] Define `PublicProductDTO`, including optional administrator-controlled `rating`, plus `PublicPriceDTO`, `PublicDiscountDTO`, and sanitized public layout descriptors. Do not reuse `ProductDTO` for customer responses.
- [ ] Implement a pure allowlist mapper that receives the full server row, normalized layout, and public custom fields and creates the customer DTO property by property.
- [ ] Add behavior tests that mark each core field public/hidden and prove the corresponding key appears/disappears.
- [ ] Include a rating-specific test proving a public rating is returned/displayed and an internal rating is absent from both JSON and customer UI.
- [ ] Prove discount reason, reservation/sale/audit data, actor IDs, internal status, and hidden custom values never occur in serialized customer JSON.
- [ ] Scope customer attribute reads to active products and public, non-archived attributes through a nested relationship query. Never fetch all item attribute values for a single detail request.
- [ ] Require a valid bearer session on `/api/shop/bootstrap`; return `401` before reading catalog data when missing/invalid.
- [ ] Update `use-home-catalog.ts` to send the existing session authorization header. Do not add another request.
- [ ] Return products, public field descriptors, and settings/layout in the same bootstrap response.
- [ ] Add the authenticated `/api/shop/products/[id]` endpoint for an active customer-safe detail response.
- [ ] Change `/api/catalog` and `/api/catalog/[id]` GET to reject non-staff callers. These endpoints remain the full admin/seller contract.
- [ ] On product detail, choose the staff repository for admin/seller and shop repository for customers using the already-resolved auth role.
- [ ] Update customer components to render only keys present in `PublicProductDTO` and to hide unavailable filters/badges. Use neutral local presentation fallbacks that reveal no stored value.
- [ ] Keep staff inventory, editing, reservation, and sale components on `ProductDTO`.
- [ ] Remove object-spread construction from all customer response paths.
- [ ] Re-run the baseline: bootstrap target is 3 database reads; detail maximum is 2; bytes must not increase; warm p95 regression must stay within 10%.

Rollback: revert the shop route/UI deployment while keeping the shared layout data. Do not restore anonymous full `ProductDTO` access.

Approval checkpoint: provide response-key comparisons for admin, seller, customer, and anonymous callers plus the performance comparison.

## 8. Phase 3 — Close Direct Database Access

Purpose: ensure the application API is the only catalog/settings boundary.

Expected file:

- `supabase/migrations/<timestamp>_revoke_browser_table_grants.sql`

Steps:

- [ ] Repeat the browser direct-access inventory after Phase 2 is deployed.
- [ ] Confirm Auth flows do not depend on direct application-table grants.
- [ ] Record exact current grants for rollback.
- [ ] Revoke application-table privileges from `anon` and `authenticated` for catalog, attributes, values, profiles, reservations, sales, audit logs, and settings.
- [ ] Preserve `service_role` access and keep RLS/policies as defense in depth.
- [ ] Do not change public Storage object reads in this phase; customer-visible product images still require them.
- [ ] Verify direct Data API reads fail for browser roles while application endpoints continue to work.
- [ ] Review Supabase Security Advisor and Performance Advisor after the migration, record new findings, and resolve or separately document every relevant warning before production completion.

Rollback: restore only the exact previously recorded grants. Never disable RLS as a rollback shortcut.

Approval checkpoint: database migration and production execution require separate approval.

## 9. Phase 4 — Server Trust, Input Bounds, and Safe Errors

Purpose: remove client-controlled trust decisions and bound expensive work.

Expected files:

- `src/app/api/reservations/expire/route.ts`
- reservation repository interface/API/mock adapter files
- `src/app/api/catalog/bulk/route.ts`
- `src/lib/api/error-response.ts` (new shared helper)
- `src/app/api/catalog/error-response.ts`
- API routes currently returning `details`
- API clients that currently read raw detail messages

Steps:

- [ ] Remove `referenceTimeIso` from the reservation-expiry HTTP contract and repository-facing client API.
- [ ] Compute expiry time on the server immediately before the one set-based update.
- [ ] Validate bulk JSON before database work: supported action, `itemIds` array, string UUIDs, non-empty, and at most 100 raw and 100 unique IDs.
- [ ] Keep current sequential/partial-result bulk semantics initially to avoid a database connection spike. A set-based rewrite is a separate optimization.
- [ ] Resolve bulk authentication once and reuse the verified actor/role.
- [ ] Create a shared error envelope such as `{ error, code, requestId? }`.
- [ ] Map domain/validation errors to safe messages and statuses; do not serialize Supabase errors, stack traces, file paths, SQL, or raw exception objects.
- [ ] Log only the server-side request ID, safe error class/code, and concise message. Do not log authorization headers, tokens, request bodies, passwords, or customer PII.
- [ ] Keep the existing catalog helper as a thin re-export during migration to avoid a big-bang import change.
- [ ] Add tests for malformed JSON, oversize bulk input, untrusted expiry time, and sanitized 500 responses.

Performance rule: all validation is local and occurs before database work; no new network call is allowed.

## 10. Phase 5 — Static Security Headers and Edge Rate Limits

Purpose: add browser and abuse protections outside application hot paths.

Expected files/configuration:

- `next.config.mjs`
- optional CSP report endpoint only if a storage destination is separately approved
- Vercel Firewall project configuration (external change, not committed application logic)

Steps:

- [ ] Add `poweredByHeader: false` and static security headers through `next.config.mjs`.
- [ ] Enforce `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection, and production HSTS.
- [ ] Add a CSP allowlist covering Next.js, Supabase HTTPS/WSS, approved image hosts, data/blob images where required, and current OAuth behavior.
- [ ] Deploy CSP as `Content-Security-Policy-Report-Only` first. Test email/password login, Google OAuth, Supabase API calls, all product images, Messenger navigation, admin pages, and production builds.
- [ ] Remove unnecessary CSP sources before changing report-only to enforced mode in a later approved release.
- [ ] Inspect the existing Vercel plan and Firewall rules read-only before proposing exact limits.
- [ ] Add one conservative fixed-window edge rule for mutating staff API methods/paths. Begin in log/observe mode when available, account for multiple staff behind one shop IP, then enforce `429` only after normal traffic is measured.
- [ ] Do not broadly rate-limit customer catalog reads and do not add Redis/database rate-limit checks to functions.
- [ ] Leave direct Supabase Auth endpoint limits to Supabase Auth configuration; document them separately.

Performance rule: headers are static and the Firewall evaluates before the function, so neither adds an application database round trip.

Approval checkpoint: CSP enforcement and Firewall mutation are two separate external approvals.

## 11. Phase 6 — Password Policy and Admin MFA

Purpose: strengthen account takeover resistance without locking out legitimate users.

Expected files/configuration:

- shared auth validation constant/module
- login/signup, password-reset, and staff-create/change password forms/routes
- `src/lib/auth/server.ts`
- `src/app/api/auth/me/route.ts`
- `src/features/auth/auth-provider.tsx`
- `src/app/mfa/page.tsx` and focused MFA components (new)
- Supabase Auth dashboard password/MFA, custom SMTP, and redirect URL configuration
- migration updating role/RLS helpers for admin AAL2, if still applicable
- an admin recovery runbook under `docs/runbooks/`

Steps:

- [ ] Apply the 12-character client/server check only to signup and new/changed/reset passwords. Do not apply it to the ordinary sign-in form.
- [ ] Update staff creation/password-change endpoints to use the same constant and safe validation message.
- [ ] Inventory legacy staff accounts and test Supabase password-policy behavior with a non-production legacy account before changing dashboard enforcement.
- [ ] If dashboard enforcement would block a legacy account, stage password resets before enabling it. Do not enable a setting that removes the last working admin.
- [ ] Configure the Supabase password minimum/leaked-password protection only after the test and a separate approval.
- [ ] Review every active admin/seller profile with the business owner and deactivate confirmed unused staff access only after separate approval; never infer inactivity from email or last-login data alone.
- [ ] Record the production custom SMTP state and allowed Auth redirect URLs without placing credentials in the repository.
- [ ] Correct missing SMTP or redirect configuration only after separate approval, then test signup confirmation, password reset, and Google OAuth redirects against the production domain.
- [ ] Add TOTP enrollment, challenge, verification, factor listing, and safe unenrollment UI using Supabase Auth.
- [ ] Extend `/api/auth/me` to distinguish assigned role from effective role and indicate `mfaRequired` without granting admin access.
- [ ] Read the verified token's AAL claim after `auth.getUser(token)`. An assigned admin receives effective admin permissions only at `aal2`; seller/customer behavior stays unchanged initially.
- [ ] Avoid duplicate token/profile verification within one request.
- [ ] Enroll and verify at least two recovery-capable admin accounts while enforcement is in observation mode.
- [ ] Test session refresh, expired challenge, lost-device recovery, factor removal, sign-out, Google login, and fallback admin recovery.
- [ ] Update database role helpers so direct admin authorization also requires AAL2, even though direct table grants have already been removed.
- [ ] Enforce admin AAL2 only after the recovery runbook succeeds in a rehearsal.

Rollback: disable the application AAL2 enforcement flag while preserving enrolled factors. Recovery must not weaken seller/customer authorization or expose service-role credentials.

Approval checkpoint: enrollment rollout, dashboard policy change, and AAL2 enforcement each require separate approval.

## 12. Phase 7 — Image Upload Verification and Re-encoding

Purpose: prevent disguised or decompression-heavy image uploads without slowing catalog reads.

Expected files:

- `src/app/api/catalog/images/route.ts`
- image validation helper and focused tests
- `package.json` and lockfile only if `sharp` is approved after benchmarking

Steps:

- [ ] Keep authorization before `request.formData()`, byte buffering, metadata parsing, or decoder import.
- [ ] Preserve the 5 MB maximum and JPEG/PNG/WEBP/AVIF allowlist.
- [ ] Verify file signatures/decoded format server-side; never trust the filename extension or browser MIME alone.
- [ ] Reject images above 25 megapixels or above 6000 pixels on either side.
- [ ] Derive stored extension and content type from the verified output format.
- [ ] Strip metadata, auto-orient, and re-encode only after quality and upload-latency comparison succeeds.
- [ ] If `sharp` is selected, dynamically import it only inside an already-authorized Node.js upload request and configure the decoder pixel limit.
- [ ] Benchmark representative maximum-size images and inspect the serverless bundle/cold start before approval.
- [ ] Confirm seller/customer/anonymous requests return denial before decoder work and Storage writes.
- [ ] Re-run `npm audit --omit=dev` after any dependency addition.

Performance rule: no image-processing package may enter shop read or page-render paths.

## 13. Phase 8 — Full Verification and Staged Rollout

Run after every phase and again before production:

- [ ] All existing `docs/tests/verify-*.mjs` scripts pass.
- [ ] New security boundary, role matrix, error, bulk, and upload tests pass.
- [ ] TypeScript/Next production build passes.
- [ ] `npm audit --omit=dev` passes with no known production vulnerability.
- [ ] Authenticated customer home/detail smoke tests pass in each supported locale and mobile/desktop width.
- [ ] Admin inventory, fields, create/edit, image upload, bulk actions, reservations, sales, and settings smoke tests pass.
- [ ] Seller inventory/reservation flows pass and visibility/image-upload mutation remains denied.
- [ ] Anonymous shop API requests return `401`.
- [ ] Customer JSON contains no internal key/value when fields are hidden.
- [ ] Visibility changes appear on another device after normal refetch without a deployment.
- [ ] Query-count, response-size, and p95 gates pass.
- [ ] CSP report-only produces no unexplained blocked resource.
- [ ] Supabase Security Advisor and Performance Advisor have been reviewed after database changes, with relevant findings resolved or explicitly documented.
- [ ] Production custom SMTP and Auth redirect URLs are confirmed, and unused staff profiles approved for removal are inactive.
- [ ] Production rollback steps and responsible admin are identified.

Recommended rollout order:

1. Baseline/tests.
2. Shared field-layout persistence and admin review.
3. Customer DTO/API enforcement.
4. Direct database grant revocation.
5. Trust/input/error hardening.
6. Report-only headers and observed edge limits.
7. Password/MFA enrollment, then enforcement.
8. Image verification/re-encoding.
9. CSP and Firewall enforcement after observation.

Do not deploy Phases 2 and 3 in reverse order. The application API boundary must be verified before browser table grants are revoked.

## 14. Rollback Principles

- Roll back one phase at a time; avoid reverting unrelated user work.
- Prefer disabling a newly introduced enforcement flag or routing change over destructive database rollback.
- Preserve additive database columns during emergency rollback unless they themselves cause a confirmed problem.
- Never restore anonymous full product responses, raw errors, client-controlled expiry time, or customer uploads as a rollback shortcut.
- Never disable RLS to restore access.
- Keep a tested admin recovery path before MFA enforcement.
- If performance exceeds the 10% p95 budget, stop rollout and use the recorded baseline to locate the regression.

## 15. Definition of Done

The remediation is complete only when:

- the server, not the browser, controls customer-visible fields;
- admin visibility decisions are shared across devices and sellers cannot change them;
- rating follows the same admin-controlled public/internal rule as every other configurable core field;
- anonymous users remain logged out of catalog/bootstrap/detail APIs;
- customer contracts cannot contain hidden or staff-only values;
- direct browser database reads are denied;
- untrusted time, oversized bulk work, raw errors, and disguised images are rejected safely;
- admin password/MFA protections are enabled without losing recovery access;
- production Auth SMTP/redirect settings are verified and confirmed unused staff access is inactive;
- CSP and edge limits are enforced after successful observation;
- all functional, security, build, audit, payload, query-count, and latency gates pass;
- the user has explicitly approved each implementation/deployment checkpoint.

## 16. References Used for Implementation

- Next.js 14 security headers and CSP: https://nextjs.org/docs/14/pages/building-your-application/configuring/content-security-policy
- Supabase password security: https://supabase.com/docs/guides/auth/password-security
- Supabase MFA and assurance levels: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase Data API/RLS security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vercel Firewall rate limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

## 17. Final Approval Gate

This file is a plan only. No application, database, Supabase dashboard, Vercel Firewall, or deployment change should begin until the user reviews this plan and explicitly says which phase to implement.
