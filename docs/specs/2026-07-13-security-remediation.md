# Security Remediation Specification

Status: approved decisions recorded — implementation still requires separate approval
Date: 2026-07-13
Project: VeloHub / Bike City

## Change-Control Rule

This document is a specification only. It does not authorize implementation, database migration, Supabase dashboard changes, dependency changes, deployment, or production testing that mutates data.

Each implementation phase requires separate approval after its design, affected files, verification plan, performance impact, and rollback path are reviewed.

## Problem

The application has working authentication, role checks, RLS, server-side Supabase access, and a previously applied database-hardening migration. A focused security review nevertheless found one high-priority confidentiality issue and several medium or defense-in-depth weaknesses.

The highest-priority issue is that public catalog responses and direct Supabase Data API access can disclose more catalog information than the public storefront needs. Additional weaknesses involve client-controlled reservation expiry time, raw technical errors in API responses, missing browser security headers, weak password minimums and unconfirmed Auth safeguards, unbounded bulk operations, and image validation that trusts client-supplied MIME metadata.

The repair must not destabilize working customer, admin, or seller flows. It must also avoid adding database query multiplication, unnecessary authentication calls, large middleware overhead, or slower public rendering.

## Evidence Baseline

The specification is based on the repository state reviewed on 2026-07-13.

Confirmed repository findings:

1. Public catalog routes return the shared `ProductDTO`, which contains internal core properties and all mapped attribute values.
2. Core field configuration marks serial number and exact stock count as non-public by default.
3. The public shop bootstrap filters custom values after the complete product has already been mapped, and object spreading retains every other product property.
4. Custom-field visibility is stored in Supabase through `attributes.is_public`, but core-field visibility is stored only in browser `localStorage`. A core visibility change therefore affects only that browser, cannot be enforced by the server, and is not a reliable public-data security boundary.
5. The applied RLS policy permits `anon` to select non-archived catalog rows, which includes active, reserved, and sold rows.
6. The latest hardening migration still grants `anon` direct `SELECT` access to catalog tables.
7. The reservation-expiry endpoint accepts a caller-provided `referenceTimeIso` and uses it as the expiry cutoff.
8. Multiple API routes return raw Supabase errors or exception messages in `details`.
9. `next.config.mjs` does not define an application security-header policy.
10. Customer and staff password forms and API validation accept six-character passwords.
11. The bulk catalog route has no maximum number of item IDs and processes them sequentially.
12. The image-upload endpoint validates reported MIME type and byte size but does not validate file signatures or decode the image.

Positive baseline:

1. Privileged API routes reviewed during the audit perform server-side role checks.
2. Bearer tokens are validated with Supabase Auth `getUser`.
3. The service-role key is used in server-only code and `.env.local` is ignored by Git.
4. All local migrations, including `20260708120139_harden_public_grants_and_functions`, are applied to the linked Supabase project.
5. `npm audit --omit=dev` reported zero known production dependency vulnerabilities on 2026-07-13.
6. No use of `dangerouslySetInnerHTML`, `eval`, or dynamically constructed SQL was found in the reviewed application code.

## Goals

1. Ensure public and ordinary customer responses contain only explicitly approved storefront data.
2. Remove unnecessary direct Data API access to internal catalog tables.
3. Keep complete product data available to verified admins and sellers.
4. Ensure trusted server state, not caller input, controls time-sensitive lifecycle operations.
5. Prevent avoidable information disclosure through API error bodies.
6. Add browser security headers without breaking Next.js, Supabase Auth, images, or Messenger links.
7. Strengthen account security without unexpectedly locking out existing staff.
8. Bound expensive operations and upload risk.
9. Maintain or improve public response size and latency.
10. Preserve current business behavior unless a change is explicitly identified and approved.

## Non-Goals

1. Do not redesign the storefront, admin interface, seller interface, or authentication screens.
2. Do not rename or reorganize unrelated application modules.
3. Do not replace Supabase, Next.js, Vercel, or the existing authentication architecture.
4. Do not introduce a new ORM or database abstraction.
5. Do not combine the work with unrelated feature development or visual changes.
6. Do not remove customer registration or Google sign-in unless separately approved.
7. Do not make the storage bucket private in the first upload-hardening phase unless the product-image delivery design is separately reviewed.
8. Do not change production data or dashboard settings while implementing code-only phases.

## Security and Stability Principles

### Explicit public contracts

Public responses must be built by allowlist. They must not spread a complete internal object and then remove selected properties. Adding a future internal property must not make it public automatically.

### Separate public and staff behavior

Public/customer reads and verified staff reads may share low-level query helpers, but they must not share an unrestricted serialized response contract.

### Server-authoritative state

Security decisions, roles, current time, product visibility, and allowed lifecycle transitions must be determined on the server.

### No N+1 regressions

No remediation may add a database query, authentication lookup, or network request per catalog item. Public catalog mapping must remain batch-based.

### Small, reversible phases

Each phase must be independently testable and revertible. Database privilege changes occur only after the application no longer depends on the privileges being removed.

### Production-safe errors

The client receives stable error codes and safe messages. Complete errors remain available only in protected server logs.

## Pain Point 1: Public Catalog Data Exposure

### Risk

The public catalog and product-detail APIs use the internal `ProductDTO`. The current mapping includes serial number, exact stock count, discount reason, status, and every loaded custom attribute value. Some of those fields are configured as internal.

Direct Supabase access creates a second path. The public `anon` role can select `catalog_items`, and current RLS allows any row whose status is not archived. This can reveal reserved or sold inventory and columns that the storefront does not need.

### Required public contract

Introduce a dedicated `PublicProductDTO` containing only transport properties and administrator-approved storefront fields.

Visibility rules approved on 2026-07-13:

1. Every configurable core or custom field marked public by an administrator is included in public/customer responses and may be displayed.
2. Every configurable core or custom field marked internal by an administrator is omitted from public/customer API responses, not merely hidden in the interface.
3. Only administrators may change visibility. Sellers may read internal inventory data but may not make a field public or internal.
4. Custom-field visibility continues using the server-backed `attributes.is_public` source of truth.
5. Core-field visibility must move from per-browser `localStorage` to one shared server-backed configuration before it is relied on for security.
6. Existing core visibility values must be migrated or initialized from reviewed defaults so the rollout does not accidentally expose fields.
7. The internal discount reason is always staff-only, even if other discount presentation fields are public.
8. Only active products may appear in the public catalog.

The DTO may always contain the minimum non-sensitive transport values required for routing and response integrity, such as the product ID. Configurable presentation values must be optional and included only when their shared server-side visibility setting is public.

Always-denied public data:

- internal discount reason
- audit or actor identifiers
- reservation/customer information
- seller/staff comments
- reserved, sold, or archived product records

Core values such as name, category, drive type, serial number, price, exact stock count, images, description, and rating follow the administrator-controlled public/internal configuration. Public components must handle an approved field being absent without crashing or revealing it through another property.

### Shared visibility source of truth

Core visibility, labels, order, and options currently use browser `localStorage`. This is not shared between administrators, sellers, customers, browsers, or devices and cannot be consulted by server APIs.

The implementation must:

1. Persist the core field-layout configuration in a server-backed shared record.
2. Restrict writes to verified administrators.
3. Permit sellers to read the configuration without modifying it.
4. Make public API filtering use the same persisted configuration.
5. Return the approved public layout as part of the existing shop bootstrap response or otherwise reuse an existing query so no additional public request is introduced.
6. Keep a safe default configuration for migration and temporary read failure; the safe default must prefer hiding a field rather than exposing an uncertain field.
7. Remove `localStorage` as the authoritative visibility source after migration. It may remain temporarily only as a one-time migration input or harmless client cache if separately designed and verified.

### Required implementation shape

1. Create one explicit public mapper that constructs the response property by property.
2. Do not use `...product` when creating a public response.
3. Add a public catalog query/service path that selects active products and loads public custom attributes in batches.
4. Keep existing staff catalog services and `ProductDTO` behavior unchanged.
5. Make `/api/shop/bootstrap` return only `PublicProductDTO` records and the approved public layout needed to render them.
6. Preserve the current product-detail login requirement: anonymous detail requests must be denied, ordinary authenticated customers receive only the public contract, and verified staff receive the staff contract.
7. Make verified admin and seller catalog responses continue returning the complete staff contract.
8. Update customer components so every configurable field may be absent when the administrator marks it internal.
9. Do not derive or expose a substitute value that defeats an internal setting. For example, if exact stock is internal, the response may expose only a separately approved availability field, not the count.

### Database closure

Application response filtering alone is not a complete fix because the Supabase Data API is independently reachable with the public project key.

After application verification:

1. Inventory every remaining browser-side table query.
2. If no browser-side catalog table reads remain, revoke `anon` and ordinary `authenticated` direct table access to internal catalog tables.
3. If a direct public database read remains necessary, expose a narrowly defined public view or RPC that contains only the approved public contract and only active products.
4. Keep RLS enabled even after grants are narrowed.
5. Verify that Auth browser flows do not depend on application-table grants.

### Performance requirements

1. Do not add per-product queries.
2. Use one batched catalog query plus batched attribute/image relationships, or fewer queries if the existing query can safely project the public shape.
3. Public bootstrap database-query count must not increase from its approved baseline.
4. Public JSON payload size should decrease because internal fields are removed.
5. Public bootstrap p95 server duration must not regress by more than 10% in comparable conditions.
6. No extra `getUser` call may be added inside product mapping.

### Acceptance criteria

1. Public list and customer detail responses contain active products only.
2. Public response JSON contains a configurable core or custom value only when the shared server-side setting marks it public.
3. Internal discount reason, audit data, customer/reservation data, and staff comments are never present in public/customer responses.
4. Public UI shows every administrator-approved field and safely omits every internal field.
5. Anonymous product-detail requests are denied; authenticated customers can open details without receiving internal data.
6. Admin and seller inventory still receive all required internal properties.
7. Direct anonymous Data API queries cannot retrieve internal catalog rows or columns after the database closure is applied.
8. Public response payload is no larger than the baseline.
9. Public query count does not increase.
10. A visibility change made by an administrator is reflected in another browser/device without copying `localStorage`.
11. Seller and customer attempts to change core or custom visibility are denied by the server.
12. Loading the shared visibility configuration adds no separate public browser request and no per-product database query.

## Pain Point 2: Caller-Controlled Reservation Expiry

### Risk

An authenticated seller or admin can send an arbitrary future `referenceTimeIso`, causing active reservations to expire before their real expiry time.

### Required change

1. Production expiry must always use server time.
2. Remove `referenceTimeIso` from the production HTTP request contract.
3. Preserve deterministic testing through a service-level clock dependency or directly invoked test helper, not a public request field.
4. Keep existing reservation transition constraints and staff authorization.
5. Record the actor and affected count through the existing audit mechanism if available; any new audit design requires review.

### Performance requirements

1. Preserve the single set-based database update.
2. Do not fetch reservations into application memory to determine expiry.
3. Do not process reservations one by one.

### Acceptance criteria

1. Client-supplied time cannot change the expiry cutoff.
2. Only active reservations with `expires_at` earlier than server time are updated.
3. Existing automatic expiry behavior and reservation pages continue to work.
4. Database round-trip count does not increase.

## Pain Point 3: Raw Error Disclosure

### Risk

Several APIs return raw database error objects or exception messages. These responses may reveal schema names, constraints, implementation details, or identifiers useful to an attacker.

### Required change

1. Define a shared production API error envelope with a safe message, stable error code, and optional request/correlation ID.
2. Never return raw Supabase errors, stack traces, SQL text, tokens, environment values, or unrestricted exception messages.
3. Log full errors only on the server, with secret and personal-data redaction.
4. Preserve actionable validation messages that are intentionally safe for users.
5. Preserve HTTP status semantics used by current clients.
6. Update client error parsing only where necessary to keep current user-facing behavior.

### Performance requirements

1. Error handling must be synchronous and lightweight.
2. Do not introduce a remote logging request on the critical response path unless separately approved and measured.

### Acceptance criteria

1. Production 500 responses contain no raw database object or internal exception message.
2. Expected 400, 401, 403, 404, and conflict responses remain understandable.
3. Server logs retain enough redacted detail for diagnosis.
4. Existing UI error states continue to render.

## Pain Point 4: Missing Browser Security Headers

### Risk

The application has no explicit CSP or complete browser security-header policy. This increases the impact of a future injection bug and leaves framing, referrer leakage, MIME sniffing, and unnecessary browser capabilities less restricted than they should be.

### Required change

Add a reviewed production header policy covering:

- `Content-Security-Policy`
- CSP `frame-ancestors`, with `X-Frame-Options` only as compatibility defense if needed
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security` for HTTPS production responses

### Compatibility requirements

The CSP must explicitly account for:

- Next.js scripts and styles
- Supabase Auth and API connections
- Supabase-hosted product images
- approved Unsplash images
- Google OAuth redirects
- Messenger navigation links
- development-only requirements without weakening production policy

Begin the approved CSP rollout in report-only mode. Move to enforcement only after violations are reviewed and all listed compatibility flows pass.

### Performance requirements

1. Prefer static response headers.
2. Do not force all routes to dynamic rendering solely to generate CSP nonces unless a nonce-based policy is separately approved after performance measurement.
3. Do not add request middleware solely for static headers.

### Acceptance criteria

1. Production responses contain the approved headers.
2. Login, signup, reset, Google OAuth, images, and Messenger links still work.
3. No new browser console CSP errors occur in tested flows after enforcement.
4. Static rendering and cache behavior do not change unless explicitly approved.

## Pain Point 5: Password and Account Protection

### Risk

Application forms and staff APIs accept passwords as short as six characters. The prior production-readiness audit also reported leaked-password protection disabled and left MFA, SMTP, redirect URL, and related dashboard controls unconfirmed.

### Required change

1. Choose one password policy enforced consistently by Supabase Auth, staff APIs, reset UI, signup UI, and admin UI.
2. Enforce the approved minimum of 12 characters for every new or changed customer, seller, and administrator password.
3. Do not immediately lock out existing accounts solely because an existing password predates the new rule; enforce the rule when a password is created or changed.
4. Enable leaked-password protection after confirming plan/support and testing behavior.
5. Require MFA for administrator accounts after a recovery process is tested. Seller and customer MFA may remain optional in the initial rollout.
6. Review active admin/seller profiles and deactivate unused staff access.
7. Confirm production custom SMTP and Auth redirect URLs.
8. Avoid account enumeration in login and password-reset responses.
9. Define a communication/reset process before applying a stronger policy to existing staff.

### Performance requirements

1. Password validation remains local plus the existing Supabase Auth request.
2. Do not add third-party password-scoring calls to the request path.

### Acceptance criteria

1. All password creation/reset paths enforce the same approved policy.
2. Existing administrators are not unexpectedly locked out during rollout.
3. Leaked-password and MFA status are documented from the live dashboard.
4. Reset and staff account flows pass production-safe tests.

## Pain Point 6: Unbounded Bulk and Repeated API Work

### Risk

The bulk catalog route accepts an unbounded list of IDs and performs sequential work per item. Large requests can consume serverless execution time and database connections. Destructive and expensive endpoints also lack an application-level abuse budget.

### Required change

1. Enforce the approved maximum bulk item count of 100 items per request.
2. Reject non-string, malformed, duplicate, or excessive IDs before database work.
3. Enforce request-body size limits appropriate to each endpoint.
4. Add rate limiting to expensive or destructive API groups using a deployment-compatible shared store if rate limiting is approved.
5. Use bounded concurrency or set-based database operations where correctness permits.
6. Preserve partial-success semantics unless a transaction-based behavior change is separately approved.
7. Return `413` or `429` with stable safe error codes where appropriate.

### Performance requirements

1. Normal small requests must not gain a meaningful additional network round trip.
2. A rate-limit store must not be added to public read endpoints without measured need.
3. Bulk processing must not open unbounded concurrent database operations.
4. The approved maximum request must complete within the existing platform timeout budget.

### Acceptance criteria

1. Oversized bulk requests are rejected before product queries begin.
2. Normal admin and seller bulk actions continue to work.
3. Endpoint behavior under repeated requests is bounded and documented.
4. No new database connection spikes occur in load verification.

## Pain Point 7: Image Upload Trust Boundary

### Risk

The upload endpoint trusts the client-reported MIME type. A malformed or disguised file can be stored in a public bucket even if its declared type is an approved image type.

### Required change

1. Preserve the existing 5 MB limit and approved image formats.
2. Keep image upload restricted to verified administrators. Sellers and customers must be denied by the server even if a client attempts a direct request.
3. Inspect magic bytes and decode the file with a maintained server-side image library.
4. Enforce the approved limits of 25 megapixels total and 6,000 pixels on either side.
5. Derive the stored extension and content type from verified content, not the original filename.
6. Decode and re-encode administrator uploads when visible quality is preserved and upload performance stays within the approved platform budget.
7. Strip unsafe and unnecessary metadata where possible.
8. Keep randomized storage paths and `upsert: false`.
9. Reject corrupt, unsupported, oversized-dimension, or decompression-bomb images.
10. Do not expose raw storage errors to the client.

### Performance requirements

1. Image decoding occurs only on the authenticated admin upload route.
2. Define maximum pixel dimensions in addition to byte size.
3. Measure memory and execution duration using the maximum allowed file.
4. Do not add image processing to catalog read or page-render paths.

### Acceptance criteria

1. A text/HTML file renamed as JPEG is rejected.
2. Valid JPEG, PNG, WebP, and AVIF uploads still work.
3. Maximum valid uploads stay within the platform memory and timeout budget.
4. Stored content type and extension match verified content.
5. Public product image rendering remains unchanged.
6. Direct seller and customer upload requests are denied before file decoding or storage work begins.
7. Images above 25 megapixels or 6,000 pixels on either side are rejected.

## Production Configuration Gates

These items require live Supabase/Vercel or organization verification and are not proven fixed by repository changes:

1. Supabase leaked-password protection.
2. Administrator and organization MFA enforcement.
3. Production SMTP configuration.
4. Auth site URL and redirect allowlist.
5. Backups and PITR plan/status.
6. SSL enforcement.
7. Network restrictions and database access exposure.
8. Multiple trusted organization owners and recovery access.
9. Vercel environment-variable scope and access review.
10. Log retention and secret/PII redaction.

Dashboard changes require a checklist, current-state evidence, separate approval, and a rollback or recovery plan where applicable.

## Proposed Phase Order

### Phase 0: Baseline and contract tests

1. Record current public/staff response shapes, public payload size, server duration, and database-query count.
2. Add tests that demonstrate the public data leak without printing real production data.
3. Add staff contract regression tests.
4. Confirm browser code no longer performs unexpected direct table access before database changes.

No production behavior changes occur in this phase.

### Phase 1: Public application contract

1. Add a shared server-backed source of truth for core field layout/visibility with admin-only writes.
2. Add `PublicProductDTO` and an explicit mapper driven by persisted core and custom visibility.
3. Add batch-safe public query/service methods.
4. Update public bootstrap and authenticated-customer product-detail responses.
5. Preserve the product-detail login requirement and update public components for optional approved fields.
6. Verify functionality and performance.

### Phase 2: Supabase Data API closure

1. Create a reviewed migration that removes unnecessary direct catalog grants or introduces a narrow public view/RPC.
2. Apply first to a safe environment when available.
3. Verify public, customer, admin, and seller behavior.
4. Apply to production only after separate approval.

### Phase 3: Server trust and API boundaries

1. Remove caller-controlled reservation time.
2. Add bulk limits and validation.
3. Introduce safe error envelopes.
4. Add narrowly scoped rate limiting if approved.

### Phase 4: Browser and account hardening

1. Add and verify security headers.
2. Align password validation.
3. Complete approved Auth and MFA dashboard changes.

### Phase 5: Upload hardening

1. Select and review an image-validation dependency or supported platform primitive.
2. Add signature/decode validation and dimension limits.
3. Verify memory, latency, and image compatibility.

Each phase stops for review before the next phase begins.

## Verification Matrix

### Automated repository checks

1. TypeScript and production build pass.
2. Existing structure tests pass.
3. New public-contract security tests pass.
4. New reservation server-time tests pass.
5. New error-response tests pass.
6. New bulk-limit tests pass.
7. New upload validation tests pass when that phase is implemented.
8. `npm audit --omit=dev` remains free of known production vulnerabilities or any new finding is reviewed.

### Public/customer smoke tests

1. Home/catalog loads.
2. Search and every public filter works.
3. Product cards show the core/custom fields currently marked public and omit fields marked internal.
4. Product detail still requires login and loads without internal fields for an ordinary customer.
5. Customer signup, login, Google OAuth, logout, and password reset work.
6. Messenger links work.
7. Browser console has no new security-header or image errors.

### Admin smoke tests

1. Admin login and authorization work.
2. Inventory lists every required status.
3. Create, edit, archive, restore, sell, reserve, and bulk actions work within approved limits.
4. Internal serial, exact stock, and internal fields remain available.
5. Field visibility changes persist across browsers/devices and remain admin-only.
6. Field settings, reports, staff, settings, and reservation pages work.
7. Image upload and removal work after upload hardening.

### Seller smoke tests

1. Seller login and authorization work.
2. Seller inventory and reservation reads work.
3. Approved reserve/cancel/complete/sell actions work.
4. Admin-only actions remain forbidden.

### Database verification

1. Migration list is synchronized.
2. RLS remains enabled on all exposed app tables and views.
3. Anonymous grants contain only the approved public surface.
4. Anonymous queries cannot access sold, reserved, archived, serial, stock-count, or internal-field data.
5. Authenticated customers cannot access staff tables or staff-only catalog data.
6. Service-role operations used by server APIs continue to work.
7. Security and Performance Advisors are reviewed after database changes.

## Performance Non-Regression Budget

Use comparable local or preview conditions and record both baseline and post-change measurements.

1. Public bootstrap p95 server duration: no more than 10% slower.
2. Public bootstrap database-query count: no increase.
3. Public bootstrap response bytes: no increase; expected to decrease.
4. Public product-detail p95 server duration: no more than 10% slower.
5. Admin inventory initial load p95: no more than 10% slower.
6. Normal authenticated mutation overhead from validation/error changes: target below 10 ms excluding any separately approved rate-limit network call.
7. No new per-product, per-field, or per-image network round trip on read paths.
8. Upload processing is measured separately and must remain within Vercel memory and execution limits for the maximum valid file.

If a budget is exceeded, the phase is not accepted until the regression is explained and explicitly approved or corrected.

## Rollback Requirements

### Application phases

1. Keep staff and public paths separable so public-contract changes can be reverted without undoing unrelated work.
2. Deploy application changes before revoking database privileges.
3. Preserve the previous deployment for immediate Vercel rollback.

### Database phase

1. The migration must include a reviewed inverse-grant plan.
2. Capture pre-change grants and policies without including secrets or customer data.
3. Never solve a failed rollout by disabling RLS.
4. If the public shop fails after privilege changes, prefer rolling back the application or restoring narrowly required grants, not broad blanket privileges.

### Dashboard phases

1. Confirm recovery access before MFA enforcement.
2. Confirm SMTP and redirect settings before changing Auth behavior.
3. Document the prior value for every reversible setting.

## Decisions Approved On 2026-07-13

1. Administrator-controlled visibility applies to every configurable core and custom field. Public fields are returned and displayed; internal fields are omitted from public/customer API responses.
2. Only administrators may change field visibility. Sellers can read internal inventory fields but cannot change visibility.
3. Product-detail pages continue requiring login. Ordinary authenticated customers receive the public contract; anonymous detail requests are denied.
4. Internal discount reasons always remain staff-only.
5. Bulk operations are limited to 100 products per request.
6. Every newly created or changed password requires at least 12 characters. Existing accounts are not immediately locked out solely because their password predates the rule.
7. MFA is mandatory for administrators after recovery access is tested. Seller and customer MFA may remain optional initially.
8. CSP begins in report-only mode and is enforced only after compatibility verification.
9. Product image upload remains administrator-only. Sellers and customers cannot upload.
10. Images retain the 5 MB limit and add limits of 25 megapixels and 6,000 pixels per side.
11. Administrator uploads may be decoded and re-encoded when quality and upload performance pass verification.

No additional business questions are required before Phase 0. Technical details that do not change approved behavior should use the safest low-overhead implementation and be documented during planning. If discovery requires a behavior change, that specific decision returns for approval.

## Overall Acceptance Criteria

The remediation is complete only when:

1. Public and customer callers cannot retrieve staff-only catalog data through Next.js APIs or Supabase Data APIs.
2. Admin and seller workflows retain the data and operations required by their roles.
3. Reservation expiry uses trusted server time.
4. Production APIs do not disclose raw technical errors.
5. Approved browser security headers are enforced without breaking supported flows.
6. The approved password and administrator-access controls are active.
7. Bulk and repeated expensive operations are bounded.
8. Uploaded images are validated from their actual content.
9. All required smoke tests and database checks pass.
10. Performance remains within the non-regression budget.
11. Every production or database mutation was separately approved and documented.
