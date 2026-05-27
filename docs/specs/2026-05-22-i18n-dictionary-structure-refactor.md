# i18n Dictionary Structure Refactor Spec

## Problem

The translation system works, but the main dictionary file has grown too large:

- `src/lib/i18n/dictionaries.ts` is about 1,502 lines and 113 KB.
- It contains locale types, language options, default locale, and all English, Russian, and Georgian translation keys in one file.
- The provider, label helpers, and language switcher are already small, but every translation change still requires working inside one large dictionary object.

This makes translation work harder as the app is split into smaller admin, public shop, auth, and backend-related features.

## Goal

Split translations into small, feature-focused dictionary modules while keeping the runtime `useI18n()` API, visible text, translation keys, and fallback behavior exactly the same.

This is a structure refactor, not a translation rewrite.

## Current Code Shape

Primary files:

- `src/lib/i18n/dictionaries.ts`
- `src/lib/i18n/i18n-provider.tsx`
- `src/lib/i18n/labels.ts`
- `src/lib/i18n/language-switcher.tsx`
- `src/lib/i18n/index.ts`

Current dictionary structure:

- `Locale`, `LANGUAGE_OPTIONS`, and `DEFAULT_LOCALE` live in `dictionaries.ts`.
- `dictionaries` is exported as `Record<Locale, Record<string, string>>`.
- `I18nProvider` reads `dictionaries[locale][key]`, falls back to the default locale, then falls back to the key.
- `labels.ts` contains domain label helpers for category, stock, status, drive type, reservation source, and discount labels.

Current key families found in `dictionaries.ts`:

- `inventory.*`
- `fields.*`
- `common.*`
- `reports.*`
- `login.*`
- `staff.*`
- `shop.*`
- `home.*`
- `rent.*`
- `settings.*`
- `reset.*`
- `admin.*`
- `reservations.*`
- `reservation.*`
- `nav.*`
- `role.*`
- `seller.*`
- `sale.*`
- `discount.*`
- `language.*`

## Target Structure

Create a dictionary folder organized by feature:

```txt
src/lib/i18n/
  dictionaries.ts
  i18n-provider.tsx
  index.ts
  labels.ts
  language-switcher.tsx
  dictionaries/
    auth.ts
    common.ts
    fields.ts
    index.ts
    inventory.ts
    navigation.ts
    public-shop.ts
    reports.ts
    reservations.ts
    sales.ts
    settings.ts
    staff.ts
    types.ts
```

Keep `src/lib/i18n/dictionaries.ts` as the public compatibility entrypoint. It should export:

- `Locale`
- `LANGUAGE_OPTIONS`
- `DEFAULT_LOCALE`
- merged `dictionaries`

Feature dictionary files should group related prefixes:

- `common.ts`: `common.*`, `role.*`, `language.*`
- `navigation.ts`: `nav.*`, `admin.*`, `seller.*`
- `public-shop.ts`: `home.*`, `shop.*`, `rent.*`, `discount.*`
- `auth.ts`: `login.*`, `reset.*`
- `inventory.ts`: `inventory.*`
- `fields.ts`: `fields.*`
- `reservations.ts`: `reservation.*`, `reservations.*`
- `reports.ts`: `reports.*`
- `staff.ts`: `staff.*`
- `settings.ts`: `settings.*`
- `sales.ts`: `sale.*`

## Dictionary Module Shape

Each feature dictionary file should export one section object keyed by locale:

```ts
import type { DictionarySection } from "@/lib/i18n/dictionaries/types";

export const inventoryDictionary: DictionarySection = {
  en: {
    "inventory.titleAdmin": "Admin Inventory",
  },
  ru: {
    "inventory.titleAdmin": "...",
  },
  ka: {
    "inventory.titleAdmin": "...",
  },
};
```

`src/lib/i18n/dictionaries/index.ts` should merge all sections into the existing runtime shape:

```ts
Record<Locale, Record<string, string>>
```

The merge helper should preserve a deterministic order and fail loudly in development or verification when duplicate keys exist inside the same locale.

## Refactor Approach

Use careful extraction in layers.

Layer 1: Add types and merge helper.

- Create `src/lib/i18n/dictionaries/types.ts`.
- Create `src/lib/i18n/dictionaries/index.ts`.
- Keep the existing `dictionaries.ts` object unchanged until the merge helper is ready.

Layer 2: Move low-risk key families first.

- Move `language.*`, `role.*`, `nav.*`, and `common.*`.
- Verify the merged dictionary still exposes the same keys.

Layer 3: Move feature key families.

- Move public shop keys: `home.*`, `shop.*`, `rent.*`, `discount.*`.
- Move auth keys: `login.*`, `reset.*`.
- Move admin feature keys: `inventory.*`, `fields.*`, `staff.*`, `reports.*`, `settings.*`, `reservation.*`, `reservations.*`, `sale.*`, `admin.*`, `seller.*`.

Layer 4: Reduce compatibility file.

- Keep `src/lib/i18n/dictionaries.ts` as a small re-export entrypoint.
- Do not require callers to change imports in the same pass.

Layer 5: Add a static verification script.

- Add a script that compares the pre-refactor key set with the merged dictionary key set.
- Add duplicate-key detection.
- Add per-locale missing-key detection.

## Non-Goals

- Do not rewrite translations.
- Do not rename translation keys.
- Do not change visible text.
- Do not change `useI18n()` behavior.
- Do not change `LANGUAGE_OPTIONS`, `DEFAULT_LOCALE`, or supported locales.
- Do not introduce an external i18n library.
- Do not change route locale behavior.
- Do not refactor page components in this pass.

## Acceptance Criteria

- `src/lib/i18n/dictionaries.ts` is reduced to a small compatibility entrypoint.
- Translations live under `src/lib/i18n/dictionaries/` by feature.
- `useI18n()` continues to accept the same keys and params.
- Missing-key fallback behavior remains: selected locale, default locale, then key.
- Every current translation key remains present for `en`, `ru`, and `ka`.
- No duplicate keys exist in the merged dictionary.
- `labels.ts`, `i18n-provider.tsx`, and `language-switcher.tsx` continue to work.
- `npm run build` passes.

## Verification

Run automated checks:

```powershell
npm run build
```

Add and run a static i18n guard:

```powershell
node docs\tests\verify-i18n-dictionaries.mjs
```

The guard should verify:

```text
1. All locales exist: en, ru, ka.
2. Every locale has the same key set.
3. No merged dictionary section creates duplicate keys.
4. The merged key count matches the old dictionary key count during the refactor.
5. Provider fallback behavior is unchanged.
```

Run manual smoke checks:

```text
1. Open the public shop page and switch EN/RU/KA.
2. Open admin inventory and switch EN/RU/KA.
3. Open fields settings and switch EN/RU/KA.
4. Open login/reset-password flows and switch EN/RU/KA.
5. Confirm visible text matches current behavior.
```

## Follow-Up Candidates

After this pass is complete and verified:

- Move label helpers into `src/lib/i18n/labels/` only if `labels.ts` grows.
- Consider typed translation keys after all dictionaries are split and verified.
- Consider a translator-friendly export format after the code structure is stable.

