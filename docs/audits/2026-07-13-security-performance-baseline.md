# Security and Performance Baseline

Date: 2026-07-13
Phase: Security remediation Phase 0
Runtime changes in this phase: none

## Purpose

Capture the current security contracts, verification state, build size, dependency health, query paths, and local response timings before remediation. Later phases must compare against this file under equivalent conditions.

## Environment

- Node runtime target: 20.x
- Installed and locked Next.js: 14.2.35
- Installed and locked React: 18.3.1
- Data source: configured Supabase development project from `.env.local`
- Measurement server: local `next dev` on `127.0.0.1:3100`
- Measurement date/time zone: 2026-07-13, Asia/Tbilisi
- Secrets, tokens, customer values, and product IDs were not recorded.

## Repository Verification Baseline

- Existing verification scripts: 15 of 21 passed.
- Existing failures, present before security runtime changes:
  - `verify-admin-inventory-status-scoped-fetch.mjs`
  - `verify-admin-reservations-lifecycle-page.mjs`
  - `verify-mobile-filter-panel.mjs`
  - `verify-mobile-visual-polish.mjs`
  - `verify-reservation-modal-safety.mjs`
  - `verify-structure-baseline.mjs` (fails because it invokes the existing reservation modal safety check)
- Production build: passed.
- Production dependency audit: 0 known vulnerabilities across info, low, moderate, high, and critical severities.

The six existing failures are recorded, not repaired, because they are outside the security-remediation scope and must not be mixed into these changes.

## Production Build Size Baseline

Selected Next.js build output:

| Route | Type | Route size | First-load JavaScript |
|---|---:|---:|---:|
| `/` | static | 10.3 kB | 205 kB |
| `/shop/[id]` | dynamic | 8.03 kB | 203 kB |
| `/admin` | static | 157 B | 215 kB |
| shared by all | — | — | 87.3 kB |

Later phases must not place upload decoding libraries in the customer or shared client bundles.

## Current Local API Timing Baseline

Method: ten requests per endpoint after server readiness. The table records response-body UTF-8 bytes and sample percentiles. Maximum includes route compilation or network outliers and is retained for transparency.

| Current endpoint | Authentication used | Status | Bytes | p50 | p95 | Maximum |
|---|---|---:|---:|---:|---:|---:|
| `/api/shop/bootstrap` | none | 200 | 12,419 | 68.9 ms | 156.4 ms | 929.4 ms |
| `/api/catalog?status=active` | none | 200 | 13,021 | 254.0 ms | 287.6 ms | 1,905.3 ms |
| `/api/catalog/[id]` | none | 200 | 737 | 448.6 ms | 470.9 ms | 1,436.8 ms |

The anonymous `200` responses are evidence of the current boundary problem, not desired behavior. After remediation, anonymous shop bootstrap/detail must return `401`; equivalent payload and latency comparisons must use an authenticated ordinary customer session.

Authenticated customer/admin/seller timing is pending until a safe test session is available. Phase 1 must not fabricate credentials or record bearer tokens. The authenticated performance gate must be completed before customer-contract enforcement is approved for production.

## Current Response Shape Evidence

The current bootstrap returned 14 products and 9 field definitions. A representative product exposed these top-level keys:

`category`, `description`, `discountAmount`, `discountedPrice`, `discountInput`, `discountLabel`, `discountPercent`, `discountReason`, `discountType`, `id`, `image`, `images`, `inStock`, `name`, `price`, `rating`, `serial`, `status`, `stockCount`, `type`, `values`.

The current anonymous detail response exposed the same product keys. This confirms that `discountReason`, exact stock data, serial, internal status, and other internal DTO properties cross the customer boundary today.

## Current Database Call Paths

Static service-path count for a successful bootstrap is five database calls:

1. `attributes` through `listFields()`.
2. `attribute_options` through `fetchOptionsForAttributes()`.
3. `catalog_items` through `fetchCatalogItems("active")`.
4. all `item_attribute_values` through `fetchAttributeValueMap()`.
5. `app_settings` through `readSettings()`.

The field calls run sequentially; catalog items and all values run in parallel after fields; settings runs alongside the catalog stage. The approved target is three batched calls with no per-product query.

Static service-path count for current product detail is two calls:

1. one `catalog_items` row;
2. every row from `item_attribute_values`, not only the requested product.

The detail target remains at most two calls while scoping attribute data to the requested active product and loading the shared layout safely.

## Current Security Evidence

- Core layout/visibility is authoritative in browser `localStorage` under `velohub.fieldLayout.v1`.
- Custom visibility is stored in `attributes.is_public`.
- `/api/shop/bootstrap`, `/api/catalog`, and active `/api/catalog/[id]` reads do not require an authenticated customer.
- Customer output is still based on the internal `ProductDTO`; bootstrap filters custom values but spreads the remaining product.
- Reservation expiry accepts caller-controlled `referenceTimeIso`.
- Bulk operations have no maximum ID count.
- Thirty-six raw `details:` response constructions were found under API routes/error helpers.
- Login, reset, staff-create, and staff-change flows contain six-character minimum enforcement.
- Image upload correctly checks admin role before multipart parsing and enforces 5 MB/MIME limits, but does not verify decoded content or dimensions.
- `next.config.mjs` has image host configuration but no complete security-header policy.
- Browser Supabase usage is limited to Auth/session flows; no browser-side application-table `.from(...)` or `.rpc(...)` call was found. Server API modules contain the application-table queries.
- The applied grant migration still re-grants browser table privileges after its initial revoke, so a later staged closure migration remains required.

## Phase 0 Contract Tests

- `verify-public-catalog-boundary.mjs` defines the required authenticated customer DTO and route boundary.
- `verify-security-remediation-structure.mjs` defines the remaining structural hardening contract.
- Both tests are expected to fail before their corresponding remediation phases. Their failures are the red baseline; later phases must turn relevant checks green without weakening assertions.

## Performance Acceptance Baseline

- Bootstrap database-call baseline: 5; target: 3; maximum after remediation: 5.
- Product-detail database-call baseline and maximum: 2.
- Comparable authenticated warm p95 may regress by no more than 10%.
- Customer response bytes may not increase.
- No new per-product, per-field, or per-image request is permitted.
- No separate browser request may be added only to load visibility configuration.

## Phase 0 Exit Condition

Phase 0 is complete when the existing checks/build/audit are recorded, the two red contract tests exist and fail for the documented reasons, and no runtime file, database migration, dependency, Supabase setting, Vercel setting, or deployment has changed.

## Phase 1 Verification Update

Phase 1 implementation adds the shared layout model, strict normalization, rating visibility, additive migration file, one-query settings/layout reader, staff-readable/admin-writable route, repository adapters, deduplicated staff client cache, and explicit legacy/default review UI.

- Focused shared-layout behavioral verifier: passed.
- i18n dictionary parity: passed for 550 keys.
- Admin field decomposition check: passed.
- Maximum file-line check: passed.
- Production build: passed.
- Anonymous `GET /api/fields/layout`: `401`.
- Anonymous `PATCH /api/fields/layout`: `401`.
- No dependency was added.
- Before rollout, `supabase db push --dry-run` confirmed that `20260713000100_add_field_layout_to_app_settings.sql` was the only pending remote migration.
- After explicit approval, that single additive migration was applied to the linked Supabase project.
- `supabase migration list` confirmed that local and remote migration history both include `20260713000100`.
- A read-only live query confirmed version `1`, `configured: false`, both rating fields hidden, and object-shaped order, labels, and options maps.
- Post-migration local API checks against the linked schema returned: anonymous layout read `401`, seller layout read `200`, admin layout read `200`, seller layout write `403`, and shop bootstrap `200`.
- No admin write, visibility decision, deployment, grant change, or Phase 2 migration was performed during this rollout.

Selected post-Phase-1 build comparison:

| Route | Baseline first load | Phase 1 first load | Change |
|---|---:|---:|---:|
| `/` | 205 kB | 206 kB | +1 kB (+0.5%) |
| `/shop/[id]` | 203 kB | 207 kB | +4 kB (+2.0%) |
| `/admin` | 215 kB | 219 kB | +4 kB (+1.9%) |
| shared by all | 87.3 kB | 87.3 kB | no change |

The ordinary customer detail path disables the staff layout hook, so it makes no new field-layout request. Staff consumers share one deduplicated request. All measured bundle deltas remain below the approved 10% non-regression budget.
