# Structure Spec Conflict Audit

## Scope

Reviewed the active structure specs:

- `docs/specs/2026-05-22-admin-inventory-structure-refactor.md`
- `docs/specs/2026-05-22-admin-fields-structure-refactor.md`
- `docs/specs/2026-05-22-public-shop-structure-refactor.md`
- `docs/specs/2026-05-22-admin-support-pages-structure-refactor.md`
- `docs/specs/2026-05-22-auth-access-pages-structure-refactor.md`
- `docs/specs/2026-05-22-api-backend-service-structure-refactor.md`
- `docs/specs/2026-05-22-i18n-dictionary-structure-refactor.md`
- `docs/specs/2026-05-23-shared-ui-component-structure-refactor.md`
- `docs/specs/2026-05-23-repository-data-adapter-structure-refactor.md`
- `docs/specs/2026-05-23-verification-test-structure-refactor.md`

## Result

No blocking conflicts found.

The specs are compatible if implemented in layered order and with the ownership rules below.

## Ownership Matrix

| Area | Owner Spec | Notes |
| --- | --- | --- |
| `src/app/admin/*/page.tsx` wrappers | admin page specs | Route files become wrappers; feature views own UI implementation. |
| `src/app/page.tsx` and `src/app/shop/[id]/page.tsx` | public shop spec | Customer-side pages become wrappers. |
| `src/features/admin/inventory/*` | admin inventory spec | Domain-specific inventory UI remains here. |
| `src/features/fields/settings/*` | admin fields spec | Domain-specific field settings UI remains here. |
| `src/features/shop/public/*` | public shop spec | Domain-specific shop UI remains here. |
| `src/features/auth/access/*` | auth access spec | Auth form implementation moves here. |
| `src/components/ui/*` | shared UI spec | Generic UI primitives only. |
| `src/features/*/repositories` and `src/features/*/adapters` | repository/data adapter spec | Client-facing repositories and API/mock adapters only. |
| `src/server/*` | API backend service spec | Server-only direct Supabase access and backend services. |
| `src/lib/i18n/dictionaries/*` | i18n dictionary spec | Translation organization only. |
| `docs/tests/*` | verification spec plus task-specific plans | Static guards and verification scripts. |

## Overlap Clarifications

Shared UI vs feature components:

- No conflict.
- `src/components/ui/*` owns generic primitives like buttons, modal shells, alerts, and form controls.
- Feature specs own domain-specific composition like product cards, reservation summaries, product images, and field settings modals.

Shared UI `image-frame.tsx` vs feature `product-image.tsx`:

- No conflict.
- Shared UI can own a generic image frame.
- Feature product image components keep fallback image/domain logic.

Backend service spec vs repository/data adapter spec:

- No conflict.
- Repository/data adapter spec owns browser/client repositories that call `/api/...`.
- Backend service spec owns server services under `src/server/*` that can use Supabase admin clients.
- `adapters/supabase` should become compatibility re-exports for client API adapters, not direct Supabase database adapters.

i18n spec vs page/component specs:

- No conflict.
- i18n spec moves dictionaries and keeps keys/text unchanged.
- Page/component specs continue to call `useI18n()` with the same keys.

Verification spec vs all other specs:

- No conflict.
- Verification spec defines shared guard structure and does not change app behavior by itself.

## Sequencing Notes

Recommended implementation order:

1. Verification guard structure baseline.
2. Shared UI primitives.
3. Repository/data adapter cleanup.
4. API backend service cleanup.
5. Admin inventory split.
6. Admin fields split.
7. Public shop split.
8. Admin support pages split.
9. Auth access split.
10. i18n dictionary split.

This order avoids most import churn, but it is not mandatory. If a page refactor starts earlier, it should keep shared UI and repository boundaries in mind.

## Risks To Watch

- Do not let shared UI import feature DTOs.
- Do not let client repositories import `src/server`.
- Do not move Supabase admin clients into client component paths.
- Do not rename translation keys during i18n splitting.
- Do not change visible UI during structure refactors.
- Do not combine database/schema work with structure refactors.
