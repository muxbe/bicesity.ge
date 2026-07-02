# i18n Dictionary Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/lib/i18n/dictionaries.ts` into focused dictionary modules while preserving every locale, key, visible translation string, import path, and `useI18n()` fallback behavior.

**Architecture:** Keep `src/lib/i18n/dictionaries.ts` as the public compatibility entrypoint. Move translation data into `src/lib/i18n/dictionaries/*.ts` modules grouped by feature prefix, then merge those sections through a small deterministic helper with duplicate-key protection.

**Tech Stack:** TypeScript, Next.js App Router, existing React i18n provider, Node static verifier scripts, `npm run build`.

---

## Source Design

Implement the approved design:

```text
docs/specs/2026-05-22-i18n-dictionary-structure-refactor.md
```

This is a structural refactor only.

Do not change:

- Supported locales: `en`, `ru`, `ka`.
- `LANGUAGE_OPTIONS`.
- `DEFAULT_LOCALE`.
- Translation keys.
- Translation values.
- `useI18n()` behavior.
- Fallback order: selected locale, default locale, key.
- Current public import path: `@/lib/i18n/dictionaries`.
- Page, component, route, Supabase, Vercel, or auth behavior.

## Current Dictionary Facts

Current prefix counts per locale:

```text
language: 1
role: 4
common: 64
nav: 4
home: 19
rent: 17
shop: 19
discount: 2
login: 41
reset: 15
admin: 12
seller: 4
inventory: 104
reservation: 9
sale: 3
settings: 17
staff: 32
reports: 47
reservations: 58
fields: 68
```

Every locale currently exposes the same prefix counts.

## Target File Structure

Create:

```text
src/lib/i18n/dictionaries/types.ts
src/lib/i18n/dictionaries/merge.ts
src/lib/i18n/dictionaries/common.ts
src/lib/i18n/dictionaries/navigation.ts
src/lib/i18n/dictionaries/public-shop.ts
src/lib/i18n/dictionaries/auth.ts
src/lib/i18n/dictionaries/inventory.ts
src/lib/i18n/dictionaries/fields.ts
src/lib/i18n/dictionaries/reservations.ts
src/lib/i18n/dictionaries/reports.ts
src/lib/i18n/dictionaries/settings.ts
src/lib/i18n/dictionaries/staff.ts
src/lib/i18n/dictionaries/sales.ts
src/lib/i18n/dictionaries/index.ts
```

Modify:

```text
src/lib/i18n/dictionaries.ts
docs/tests/verify-i18n-dictionaries.mjs
docs/tests/verify-max-file-lines.mjs
```

## Prefix Ownership

Use this exact module map:

```ts
const dictionaryModules = [
  {
    file: "common.ts",
    exportName: "commonDictionary",
    prefixes: ["language", "role", "common"],
  },
  {
    file: "navigation.ts",
    exportName: "navigationDictionary",
    prefixes: ["nav", "admin", "seller"],
  },
  {
    file: "public-shop.ts",
    exportName: "publicShopDictionary",
    prefixes: ["home", "rent", "shop", "discount"],
  },
  {
    file: "auth.ts",
    exportName: "authDictionary",
    prefixes: ["login", "reset"],
  },
  {
    file: "inventory.ts",
    exportName: "inventoryDictionary",
    prefixes: ["inventory"],
  },
  {
    file: "fields.ts",
    exportName: "fieldsDictionary",
    prefixes: ["fields"],
  },
  {
    file: "reservations.ts",
    exportName: "reservationsDictionary",
    prefixes: ["reservation", "reservations"],
  },
  {
    file: "reports.ts",
    exportName: "reportsDictionary",
    prefixes: ["reports"],
  },
  {
    file: "settings.ts",
    exportName: "settingsDictionary",
    prefixes: ["settings"],
  },
  {
    file: "staff.ts",
    exportName: "staffDictionary",
    prefixes: ["staff"],
  },
  {
    file: "sales.ts",
    exportName: "salesDictionary",
    prefixes: ["sale"],
  },
] as const;
```

## Fixed Public Contracts

`src/lib/i18n/dictionaries/types.ts` owns the shared types:

```ts
export type Locale = "en" | "ru" | "ka";

export const LOCALES: readonly Locale[] = ["en", "ru", "ka"];

export type TranslationMap = Record<string, string>;
export type Dictionary = Record<Locale, TranslationMap>;
export type DictionarySection = Record<Locale, TranslationMap>;
```

`src/lib/i18n/dictionaries.ts` remains the compatibility entrypoint:

```ts
import type { Locale } from "@/lib/i18n/dictionaries/types";

export type { Locale } from "@/lib/i18n/dictionaries/types";
export { dictionaries } from "@/lib/i18n/dictionaries/index";

export const LANGUAGE_OPTIONS: Array<{
  locale: Locale;
  shortLabel: string;
  label: string;
}> = [
  { locale: "en", shortLabel: "EN", label: "English" },
  { locale: "ru", shortLabel: "RU", label: "Ð ÑƒÑÑÐºÐ¸Ð¹" },
  { locale: "ka", shortLabel: "KA", label: "áƒ¥áƒáƒ áƒ—áƒ£áƒšáƒ˜" },
];

export const DEFAULT_LOCALE: Locale = "en";
```

---

## Task 1: Add Split-Aware Dictionary Verifier

**Files:**

- Modify: `docs/tests/verify-i18n-dictionaries.mjs`

- [ ] **Step 1: Replace the old single-file verifier**

Replace `docs/tests/verify-i18n-dictionaries.mjs` with:

```js
import {
  failIfAny,
  lineCount,
  pathExists,
  readText,
} from "./structure-test-helpers.mjs";

const rootDictionaryPath = "src/lib/i18n/dictionaries.ts";
const dictionaryDir = "src/lib/i18n/dictionaries";
const expectedLocales = ["en", "ru", "ka"];

const modules = [
  { file: "common.ts", exportName: "commonDictionary", prefixes: ["language", "role", "common"] },
  { file: "navigation.ts", exportName: "navigationDictionary", prefixes: ["nav", "admin", "seller"] },
  { file: "public-shop.ts", exportName: "publicShopDictionary", prefixes: ["home", "rent", "shop", "discount"] },
  { file: "auth.ts", exportName: "authDictionary", prefixes: ["login", "reset"] },
  { file: "inventory.ts", exportName: "inventoryDictionary", prefixes: ["inventory"] },
  { file: "fields.ts", exportName: "fieldsDictionary", prefixes: ["fields"] },
  { file: "reservations.ts", exportName: "reservationsDictionary", prefixes: ["reservation", "reservations"] },
  { file: "reports.ts", exportName: "reportsDictionary", prefixes: ["reports"] },
  { file: "settings.ts", exportName: "settingsDictionary", prefixes: ["settings"] },
  { file: "staff.ts", exportName: "staffDictionary", prefixes: ["staff"] },
  { file: "sales.ts", exportName: "salesDictionary", prefixes: ["sale"] },
];

const prefixOwners = new Map();
for (const module of modules) {
  for (const prefix of module.prefixes) {
    prefixOwners.set(prefix, module.file);
  }
}

const failures = [];

if (!pathExists(rootDictionaryPath)) {
  failures.push(`${rootDictionaryPath}: missing compatibility entrypoint`);
} else {
  const rootText = readText(rootDictionaryPath);
  const requiredSnippets = [
    "export type { Locale }",
    "export { dictionaries }",
    "LANGUAGE_OPTIONS",
    "DEFAULT_LOCALE",
  ];
  for (const snippet of requiredSnippets) {
    if (!rootText.includes(snippet)) {
      failures.push(`${rootDictionaryPath}: missing '${snippet}'`);
    }
  }
  const rootLines = lineCount(rootDictionaryPath);
  if (rootLines > 60) {
    failures.push(`${rootDictionaryPath}: ${rootLines} lines exceeds 60`);
  }
}

for (const requiredFile of ["types.ts", "merge.ts", "index.ts"]) {
  const path = `${dictionaryDir}/${requiredFile}`;
  if (!pathExists(path)) {
    failures.push(`${path}: missing dictionary support file`);
  }
}

const globalKeysByLocale = new Map(
  expectedLocales.map((locale) => [locale, new Map()])
);

function localeBlock(text, locale) {
  const localeMatches = [...text.matchAll(/^\s{2}(en|ru|ka):\s*\{/gm)].map(
    (match) => ({ locale: match[1], index: match.index })
  );
  const current = localeMatches.find((entry) => entry.locale === locale);
  if (!current) {
    return "";
  }
  const next = localeMatches.find((entry) => entry.index > current.index);
  return text.slice(current.index, next ? next.index : text.length);
}

function keysForLocale(text, locale) {
  const block = localeBlock(text, locale);
  return [...block.matchAll(/"([^"]+)":/g)].map((match) => match[1]);
}

for (const module of modules) {
  const path = `${dictionaryDir}/${module.file}`;
  if (!pathExists(path)) {
    failures.push(`${path}: missing dictionary module`);
    continue;
  }

  const text = readText(path);
  if (!text.includes(`export const ${module.exportName}: DictionarySection`)) {
    failures.push(`${path}: missing ${module.exportName} export`);
  }

  for (const locale of expectedLocales) {
    const keys = keysForLocale(text, locale);
    if (keys.length === 0) {
      failures.push(`${path}: locale '${locale}' has no keys`);
    }

    for (const key of keys) {
      const prefix = key.split(".")[0];
      const expectedOwner = prefixOwners.get(prefix);
      if (expectedOwner !== module.file) {
        failures.push(
          `${path}: key '${key}' belongs in ${expectedOwner ?? "no known module"}`
        );
      }

      const localeKeys = globalKeysByLocale.get(locale);
      if (localeKeys.has(key)) {
        failures.push(
          `${path}: duplicate key '${key}' also found in ${localeKeys.get(key)}`
        );
      }
      localeKeys.set(key, path);
    }
  }
}

const enKeys = [...(globalKeysByLocale.get("en") ?? new Map()).keys()].sort();
for (const locale of ["ru", "ka"]) {
  const localeKeys = [...(globalKeysByLocale.get(locale) ?? new Map()).keys()].sort();
  const localeSet = new Set(localeKeys);
  for (const key of enKeys) {
    if (!localeSet.has(key)) {
      failures.push(`${dictionaryDir}: locale '${locale}' missing key '${key}'`);
    }
  }
  const enSet = new Set(enKeys);
  for (const key of localeKeys) {
    if (!enSet.has(key)) {
      failures.push(`${dictionaryDir}: locale '${locale}' has extra key '${key}'`);
    }
  }
}

if (enKeys.length < 540) {
  failures.push(`${dictionaryDir}: expected at least 540 English keys, found ${enKeys.length}`);
}

failIfAny(
  failures,
  `i18n split dictionary checks passed for ${enKeys.length} keys.`
);
```

- [ ] **Step 2: Run the verifier and confirm RED**

Run:

```powershell
node docs\tests\verify-i18n-dictionaries.mjs
```

Expected: exit code `1` with missing `src/lib/i18n/dictionaries/*` files.

- [ ] **Step 3: Commit the failing verifier**

```powershell
git add docs/tests/verify-i18n-dictionaries.mjs
git commit -m "Add split-aware i18n dictionary verifier"
```

---

## Task 2: Add Dictionary Types And Merge Helper

**Files:**

- Create: `src/lib/i18n/dictionaries/types.ts`
- Create: `src/lib/i18n/dictionaries/merge.ts`

- [ ] **Step 1: Create shared dictionary types**

Create `src/lib/i18n/dictionaries/types.ts`:

```ts
export type Locale = "en" | "ru" | "ka";

export const LOCALES: readonly Locale[] = ["en", "ru", "ka"];

export type TranslationMap = Record<string, string>;
export type Dictionary = Record<Locale, TranslationMap>;
export type DictionarySection = Record<Locale, TranslationMap>;
```

- [ ] **Step 2: Create deterministic merge helper**

Create `src/lib/i18n/dictionaries/merge.ts`:

```ts
import {
  LOCALES,
  type Dictionary,
  type DictionarySection,
} from "@/lib/i18n/dictionaries/types";

export function mergeDictionarySections(
  sections: readonly DictionarySection[]
): Dictionary {
  const merged = LOCALES.reduce((result, locale) => {
    result[locale] = {};
    return result;
  }, {} as Dictionary);

  for (const section of sections) {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(section[locale])) {
        if (Object.prototype.hasOwnProperty.call(merged[locale], key)) {
          throw new Error(`Duplicate i18n key '${key}' in locale '${locale}'.`);
        }
        merged[locale][key] = value;
      }
    }
  }

  return merged;
}
```

- [ ] **Step 3: Verify no runtime change**

Run:

```powershell
git diff --check
npm run build
```

Expected: both pass.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/i18n/dictionaries/types.ts src/lib/i18n/dictionaries/merge.ts
git commit -m "Add i18n dictionary merge helpers"
```

---

## Task 3: Generate Feature Dictionary Modules

**Files:**

- Create: all feature modules under `src/lib/i18n/dictionaries/`
- Create: `src/lib/i18n/dictionaries/index.ts`

- [ ] **Step 1: Generate modules from the current dictionary object**

Run this one-time script from the repo root. It reads the existing `src/lib/i18n/dictionaries.ts` object through the TypeScript AST and writes feature modules without changing translation text.

```powershell
@'
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourcePath = path.join("src", "lib", "i18n", "dictionaries.ts");
const outputDir = path.join("src", "lib", "i18n", "dictionaries");
const sourceText = fs.readFileSync(sourcePath, "utf8");
const sourceFile = ts.createSourceFile(
  sourcePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);

const modules = [
  { file: "common.ts", exportName: "commonDictionary", prefixes: ["language", "role", "common"] },
  { file: "navigation.ts", exportName: "navigationDictionary", prefixes: ["nav", "admin", "seller"] },
  { file: "public-shop.ts", exportName: "publicShopDictionary", prefixes: ["home", "rent", "shop", "discount"] },
  { file: "auth.ts", exportName: "authDictionary", prefixes: ["login", "reset"] },
  { file: "inventory.ts", exportName: "inventoryDictionary", prefixes: ["inventory"] },
  { file: "fields.ts", exportName: "fieldsDictionary", prefixes: ["fields"] },
  { file: "reservations.ts", exportName: "reservationsDictionary", prefixes: ["reservation", "reservations"] },
  { file: "reports.ts", exportName: "reportsDictionary", prefixes: ["reports"] },
  { file: "settings.ts", exportName: "settingsDictionary", prefixes: ["settings"] },
  { file: "staff.ts", exportName: "staffDictionary", prefixes: ["staff"] },
  { file: "sales.ts", exportName: "salesDictionary", prefixes: ["sale"] },
];

function findDictionariesInitializer(node) {
  if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "dictionaries" &&
        declaration.initializer &&
        ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        return declaration.initializer;
      }
    }
  }

  return ts.forEachChild(node, findDictionariesInitializer);
}

function propertyNameText(name) {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  throw new Error(`Unsupported property name at ${name.getStart(sourceFile)}`);
}

const initializer = findDictionariesInitializer(sourceFile);
if (!initializer) {
  throw new Error("Could not find exported dictionaries object.");
}

const entriesByLocale = new Map();
for (const localeProperty of initializer.properties) {
  if (!ts.isPropertyAssignment(localeProperty)) continue;
  const locale = propertyNameText(localeProperty.name);
  if (!ts.isObjectLiteralExpression(localeProperty.initializer)) {
    throw new Error(`Locale '${locale}' is not an object.`);
  }
  const entries = [];
  for (const translationProperty of localeProperty.initializer.properties) {
    if (!ts.isPropertyAssignment(translationProperty)) continue;
    const key = propertyNameText(translationProperty.name);
    entries.push({
      key,
      valueText: translationProperty.initializer.getText(sourceFile),
    });
  }
  entriesByLocale.set(locale, entries);
}

fs.mkdirSync(outputDir, { recursive: true });

function renderModule(module) {
  const lines = [
    'import type { DictionarySection } from "@/lib/i18n/dictionaries/types";',
    "",
    `export const ${module.exportName}: DictionarySection = {`,
  ];

  for (const locale of ["en", "ru", "ka"]) {
    lines.push(`  ${locale}: {`);
    const entries = entriesByLocale.get(locale) ?? [];
    for (const entry of entries) {
      const prefix = entry.key.split(".")[0];
      if (module.prefixes.includes(prefix)) {
        lines.push(`    ${JSON.stringify(entry.key)}: ${entry.valueText},`);
      }
    }
    lines.push("  },");
  }

  lines.push("};", "");
  return lines.join("\n");
}

for (const module of modules) {
  fs.writeFileSync(
    path.join(outputDir, module.file),
    renderModule(module),
    "utf8"
  );
}

const indexLines = [
  'import { authDictionary } from "@/lib/i18n/dictionaries/auth";',
  'import { commonDictionary } from "@/lib/i18n/dictionaries/common";',
  'import { fieldsDictionary } from "@/lib/i18n/dictionaries/fields";',
  'import { inventoryDictionary } from "@/lib/i18n/dictionaries/inventory";',
  'import { navigationDictionary } from "@/lib/i18n/dictionaries/navigation";',
  'import { publicShopDictionary } from "@/lib/i18n/dictionaries/public-shop";',
  'import { reportsDictionary } from "@/lib/i18n/dictionaries/reports";',
  'import { reservationsDictionary } from "@/lib/i18n/dictionaries/reservations";',
  'import { salesDictionary } from "@/lib/i18n/dictionaries/sales";',
  'import { settingsDictionary } from "@/lib/i18n/dictionaries/settings";',
  'import { staffDictionary } from "@/lib/i18n/dictionaries/staff";',
  'import { mergeDictionarySections } from "@/lib/i18n/dictionaries/merge";',
  "",
  "export const dictionaries = mergeDictionarySections([",
  "  commonDictionary,",
  "  navigationDictionary,",
  "  publicShopDictionary,",
  "  authDictionary,",
  "  inventoryDictionary,",
  "  fieldsDictionary,",
  "  reservationsDictionary,",
  "  reportsDictionary,",
  "  settingsDictionary,",
  "  staffDictionary,",
  "  salesDictionary,",
  "]);",
  "",
];

fs.writeFileSync(
  path.join(outputDir, "index.ts"),
  indexLines.join("\n"),
  "utf8"
);
console.log("Generated i18n dictionary modules.");
'@ | node
```

Expected output:

```text
Generated i18n dictionary modules.
```

- [ ] **Step 2: Inspect generated module list**

Run:

```powershell
Get-ChildItem src\lib\i18n\dictionaries -File |
  Select-Object Name |
  Sort-Object Name
```

Expected files:

```text
auth.ts
common.ts
fields.ts
index.ts
inventory.ts
merge.ts
navigation.ts
public-shop.ts
reports.ts
reservations.ts
sales.ts
settings.ts
staff.ts
types.ts
```

- [ ] **Step 3: Verify module key ownership**

Run:

```powershell
node docs\tests\verify-i18n-dictionaries.mjs
```

Expected: still fails because `src/lib/i18n/dictionaries.ts` is still the old large compatibility file, but no missing module or prefix ownership errors should appear.

- [ ] **Step 4: Commit generated modules**

```powershell
git add src/lib/i18n/dictionaries
git commit -m "Split i18n dictionaries by feature"
```

---

## Task 4: Reduce Compatibility Entrypoint

**Files:**

- Modify: `src/lib/i18n/dictionaries.ts`

- [ ] **Step 1: Replace the large dictionary entrypoint**

Replace `src/lib/i18n/dictionaries.ts` with:

```ts
import type { Locale } from "@/lib/i18n/dictionaries/types";

export type { Locale } from "@/lib/i18n/dictionaries/types";
export { dictionaries } from "@/lib/i18n/dictionaries/index";

export const LANGUAGE_OPTIONS: Array<{
  locale: Locale;
  shortLabel: string;
  label: string;
}> = [
  { locale: "en", shortLabel: "EN", label: "English" },
  { locale: "ru", shortLabel: "RU", label: "Ð ÑƒÑÑÐºÐ¸Ð¹" },
  { locale: "ka", shortLabel: "KA", label: "áƒ¥áƒáƒ áƒ—áƒ£áƒšáƒ˜" },
];

export const DEFAULT_LOCALE: Locale = "en";
```

- [ ] **Step 2: Verify dictionary structure now passes**

Run:

```powershell
node docs\tests\verify-i18n-dictionaries.mjs
```

Expected:

```text
i18n split dictionary checks passed for 540 keys.
```

- [ ] **Step 3: Verify current imports still work**

Run:

```powershell
rg "@/lib/i18n/dictionaries" src
npm run build
```

Expected:

- Existing imports continue to resolve.
- `npm run build` exits `0`.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/i18n/dictionaries.ts docs/tests/verify-i18n-dictionaries.mjs
git commit -m "Use split i18n dictionary entrypoint"
```

---

## Task 5: Tighten Line-Count Guard

**Files:**

- Modify: `docs/tests/verify-max-file-lines.mjs`

- [ ] **Step 1: Remove the legacy dictionary allowance**

In `trackedFiles`, remove:

```js
{ path: "src/lib/i18n/dictionaries.ts", max: 1600, reason: "legacy file before i18n split" },
```

- [ ] **Step 2: Add new dictionary folder limit**

In `futureFolderLimits`, add:

```js
{ dir: "src/lib/i18n/dictionaries", max: 420 },
```

- [ ] **Step 3: Verify max-line guard**

Run:

```powershell
node docs\tests\verify-max-file-lines.mjs
```

Expected:

```text
Max file line checks passed.
```

- [ ] **Step 4: Check actual dictionary line counts**

Run:

```powershell
Get-ChildItem src\lib\i18n\dictionaries -File |
  ForEach-Object {
    [pscustomobject]@{
      Lines = (Get-Content -LiteralPath $_.FullName).Count
      File = $_.FullName.Replace((Get-Location).Path + "\", "")
    }
  } |
  Sort-Object Lines -Descending |
  Format-Table -AutoSize
```

Expected:

- No file in `src/lib/i18n/dictionaries` exceeds `420` lines.
- `src/lib/i18n/dictionaries.ts` is below `60` lines.

- [ ] **Step 5: Commit**

```powershell
git add docs/tests/verify-max-file-lines.mjs
git commit -m "Tighten i18n dictionary line limits"
```

---

## Task 6: Final Static Verification

**Files:**

- No source changes expected unless a verifier exposes a defect.

- [ ] **Step 1: Run i18n and structure checks**

Run:

```powershell
node docs\tests\verify-i18n-dictionaries.mjs
node docs\tests\verify-max-file-lines.mjs
node docs\tests\verify-structure-boundaries.mjs
node docs\tests\verify-repository-structure.mjs
node docs\tests\verify-backend-service-boundaries.mjs
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: Next.js production build exits `0`.

- [ ] **Step 3: Confirm translations stayed aligned**

Run:

```powershell
node docs\tests\verify-i18n-dictionaries.mjs
```

Expected:

```text
i18n split dictionary checks passed for 540 keys.
```

- [ ] **Step 4: Confirm repository state**

Run:

```powershell
git status --short --branch
git log -5 --oneline
```

Expected:

- Working tree is clean.
- Latest commits are the i18n dictionary split commits.
- No deployment or push occurred unless separately requested.

---

## Manual Smoke Checks

Run these after static verification, preferably with the development server:

```powershell
npm run dev
```

Check:

- Public shop renders in English.
- Language switcher changes EN, RU, and KA without missing-key text.
- Login page renders in EN, RU, and KA.
- Admin inventory renders in EN, RU, and KA.
- Field settings renders in EN, RU, and KA.
- Reservations page renders in EN, RU, and KA.
- No browser console errors related to missing dictionaries or module loading.

Stop the development server after smoke verification.

## Implementation Notes

- Do this in a separate feature branch or worktree.
- Do not manually rewrite translation strings.
- Use the AST generation script to preserve values from the current file.
- Keep `src/lib/i18n/dictionaries.ts` as a compatibility entrypoint.
- Use explicit imports like `@/lib/i18n/dictionaries/index` and `@/lib/i18n/dictionaries/types` to avoid ambiguity with the compatibility file.
- Do not run a broad formatter across translation files.
- If any generated module contains keys from the wrong prefix, stop and fix the generator or prefix map before committing.
- If any unexpected unrelated file changes, stop and ask before continuing.
- Do not push or deploy without a separate explicit request.

## Self-Review

- Spec coverage: The plan keeps imports, locales, keys, visible text, fallback behavior, and runtime API unchanged.
- Placeholder scan: No unresolved implementation placeholders remain.
- Type consistency: `Locale`, `Dictionary`, `DictionarySection`, and `mergeDictionarySections` are defined before use and referenced consistently.
- Scope check: This plan only splits dictionaries and updates verification guards; page/component refactors are excluded.
