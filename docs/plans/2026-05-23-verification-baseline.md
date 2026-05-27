# Verification Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add baseline static verification scripts that protect the structure refactor work before application code is split.

**Architecture:** Keep verification in Node `.mjs` scripts under `docs/tests`. Scripts should be static filesystem checks that pass against the current codebase, then become stricter as later implementation plans update their expected paths. No app runtime behavior, API behavior, UI behavior, or database behavior changes are part of this plan.

**Tech Stack:** Node.js ESM scripts, PowerShell commands, Next.js build via `npm run build`.

---

## Files

- Read: `docs/specs/2026-05-23-verification-test-structure-refactor.md`
- Read: `docs/audits/2026-05-23-structure-spec-conflict-audit.md`
- Create: `docs/tests/structure-test-helpers.mjs`
- Create: `docs/tests/verify-spec-wording.mjs`
- Create: `docs/tests/verify-structure-boundaries.mjs`
- Create: `docs/tests/verify-max-file-lines.mjs`
- Create: `docs/tests/verify-i18n-dictionaries.mjs`
- Create: `docs/tests/verify-repository-structure.mjs`
- Create: `docs/tests/verify-shared-ui-boundaries.mjs`
- Create: `docs/tests/verify-backend-service-boundaries.mjs`
- Create: `docs/tests/verify-structure-baseline.mjs`
- Verify: existing reservation/product form guards
- Verify: `npm run build`

## Design Rules

- Guards must pass on the current codebase.
- Guards must not require directories that have not been created yet, such as `src/server` or `src/components/ui`.
- Guards must become useful as soon as those directories exist.
- Guards must print clear failure messages with file paths.
- Guards must use only Node built-ins.
- Guards must not write files.
- Guards must not connect to Supabase.
- Guards must not start a dev server.
- Guards must not change app code.

## Task 1: Add Shared Test Helpers

**Files:**
- Create: `docs/tests/structure-test-helpers.mjs`

- [ ] **Step 1: Create helper module**

Add:

```js
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const repoRoot = process.cwd();

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

export function absolutePath(relativePath) {
  return path.join(repoRoot, relativePath);
}

export function pathExists(relativePath) {
  return existsSync(absolutePath(relativePath));
}

export function readText(relativePath) {
  return readFileSync(absolutePath(relativePath), "utf8");
}

export function listFiles(relativeDir, extensions = [".ts", ".tsx", ".js", ".mjs"]) {
  const root = absolutePath(relativeDir);
  if (!existsSync(root)) {
    return [];
  }

  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (extensions.includes(path.extname(fullPath))) {
        files.push(toPosixPath(path.relative(repoRoot, fullPath)));
      }
    }
  };

  visit(root);
  return files.sort();
}

export function lineCount(relativePath) {
  const text = readText(relativePath);
  if (!text) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

export function failIfAny(failures, successMessage) {
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(successMessage);
}
```

- [ ] **Step 2: Run syntax check**

Run:

```powershell
node -e "import('./docs/tests/structure-test-helpers.mjs').then(() => console.log('helpers loaded'))"
```

Expected: prints `helpers loaded`.

## Task 2: Add Spec Wording Guard

**Files:**
- Create: `docs/tests/verify-spec-wording.mjs`

- [ ] **Step 1: Create wording guard**

Add:

```js
import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const defaultFiles = [
  ...listFiles("docs/specs", [".md"]).filter((file) => /structure-refactor\.md$/.test(file)),
  ...listFiles("docs/audits", [".md"]).filter((file) => /structure-spec-conflict-audit\.md$/.test(file)),
];

const files = process.argv.slice(2);
const targetFiles = files.length > 0 ? files : defaultFiles;

const blockedWords = [
  ["T" + "BD", "incomplete marker"],
  ["TO" + "DO", "incomplete marker"],
  ["place" + "holder", "draft wording"],
  ["may" + "be", "uncertain wording"],
  ["event" + "ually", "uncertain wording"],
  ["where " + "practical", "uncertain wording"],
  ["if " + "useful", "uncertain wording"],
];

const bannedPatterns = blockedWords.map(([word, label]) => ({
  pattern: new RegExp(`\\b${word.replaceAll(" ", "\\s+")}\\b`, "i"),
  label,
}));

const failures = [];

for (const file of targetFiles) {
  const text = readText(file);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of bannedPatterns) {
      if (rule.pattern.test(line)) {
        failures.push(`${file}:${index + 1} contains ${rule.label}: ${line.trim()}`);
      }
    }
  });
}

failIfAny(failures, "Spec wording checks passed.");
```

- [ ] **Step 2: Run wording guard**

Run:

```powershell
node docs\tests\verify-spec-wording.mjs
```

Expected: `Spec wording checks passed.`

## Task 3: Add Broad Structure Boundary Guard

**Files:**
- Create: `docs/tests/verify-structure-boundaries.mjs`

- [ ] **Step 1: Create boundary guard**

Add:

```js
import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const failures = [];

function assertNoImport(files, forbiddenPattern, message) {
  for (const file of files) {
    const text = readText(file);
    if (forbiddenPattern.test(text)) {
      failures.push(`${file}: ${message}`);
    }
  }
}

const componentUiFiles = listFiles("src/components/ui", [".ts", ".tsx"]);
assertNoImport(
  componentUiFiles,
  /from\s+["']@\/features\/|from\s+["']@\/app\/api\/|from\s+["']@\/server\/|from\s+["']@\/lib\/supabase\//,
  "shared UI must not import feature, API, server, or Supabase modules"
);

const featureFiles = listFiles("src/features", [".ts", ".tsx"]);
assertNoImport(
  featureFiles,
  /from\s+["']@\/server\//,
  "feature code must not import server-only modules"
);

const serverFiles = listFiles("src/server", [".ts", ".tsx"]);
assertNoImport(
  serverFiles,
  /^["']use client["'];?/m,
  "server modules must not be client components"
);

failIfAny(failures, "Structure boundary checks passed.");
```

- [ ] **Step 2: Run structure boundary guard**

Run:

```powershell
node docs\tests\verify-structure-boundaries.mjs
```

Expected: `Structure boundary checks passed.`

## Task 4: Add Max File Lines Guard

**Files:**
- Create: `docs/tests/verify-max-file-lines.mjs`

- [ ] **Step 1: Create max-lines guard**

Add:

```js
import { lineCount, pathExists, failIfAny } from "./structure-test-helpers.mjs";

const trackedFiles = [
  { path: "src/features/admin/admin-inventory-view.tsx", max: 2101, reason: "legacy file before admin inventory split" },
  { path: "src/app/admin/fields/page.tsx", max: 1250, reason: "legacy file before fields split" },
  { path: "src/app/page.tsx", max: 1050, reason: "legacy file before public shop split" },
  { path: "src/app/shop/[id]/page.tsx", max: 650, reason: "legacy file before product detail split" },
  { path: "src/lib/i18n/dictionaries.ts", max: 1600, reason: "legacy file before i18n split" },
  { path: "src/app/api/catalog/catalog-service.ts", max: 1050, reason: "legacy file before backend service split" },
  { path: "src/app/api/fields/field-service.ts", max: 700, reason: "legacy file before backend service split" },
  { path: "src/app/api/reservations/reservation-service.ts", max: 520, reason: "legacy file before backend service split" },
];

const futureFolderLimits = [
  { dir: "src/components/ui", max: 220 },
  { dir: "src/features/admin/inventory/components", max: 360 },
  { dir: "src/features/admin/inventory/hooks", max: 260 },
  { dir: "src/server", max: 420 },
];

import { listFiles } from "./structure-test-helpers.mjs";

const failures = [];

for (const item of trackedFiles) {
  if (!pathExists(item.path)) {
    continue;
  }
  const count = lineCount(item.path);
  if (count > item.max) {
    failures.push(`${item.path}: ${count} lines exceeds ${item.max} (${item.reason})`);
  }
}

for (const group of futureFolderLimits) {
  for (const file of listFiles(group.dir, [".ts", ".tsx"])) {
    const count = lineCount(file);
    if (count > group.max) {
      failures.push(`${file}: ${count} lines exceeds ${group.max}`);
    }
  }
}

failIfAny(failures, "Max file line checks passed.");
```

- [ ] **Step 2: Run max-lines guard**

Run:

```powershell
node docs\tests\verify-max-file-lines.mjs
```

Expected: `Max file line checks passed.`

## Task 5: Add i18n Dictionary Guard

**Files:**
- Create: `docs/tests/verify-i18n-dictionaries.mjs`

- [ ] **Step 1: Create i18n guard**

Add:

```js
import { readText, failIfAny } from "./structure-test-helpers.mjs";

const dictionaryPath = "src/lib/i18n/dictionaries.ts";
const text = readText(dictionaryPath);
const localeMatches = [...text.matchAll(/^\s{2}(en|ru|ka):\s*\{/gm)];
const locales = localeMatches.map((match) => ({ locale: match[1], index: match.index }));
const expectedLocales = ["en", "ru", "ka"];
const failures = [];

for (const locale of expectedLocales) {
  if (!locales.some((entry) => entry.locale === locale)) {
    failures.push(`${dictionaryPath}: missing locale '${locale}'`);
  }
}

function localeBlock(locale) {
  const current = locales.find((entry) => entry.locale === locale);
  if (!current) {
    return "";
  }
  const next = locales.find((entry) => entry.index > current.index);
  return text.slice(current.index, next ? next.index : text.length);
}

function keysForLocale(locale) {
  const block = localeBlock(locale);
  return [...block.matchAll(/^\s{4}"([^"]+)":/gm)].map((match) => match[1]).sort();
}

const keySets = new Map(expectedLocales.map((locale) => [locale, keysForLocale(locale)]));
const enKeys = keySets.get("en") ?? [];

for (const [locale, keys] of keySets) {
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) {
      failures.push(`${dictionaryPath}: duplicate key '${key}' in locale '${locale}'`);
    }
    seen.add(key);
  }
}

for (const locale of ["ru", "ka"]) {
  const localeKeys = new Set(keySets.get(locale) ?? []);
  for (const key of enKeys) {
    if (!localeKeys.has(key)) {
      failures.push(`${dictionaryPath}: locale '${locale}' missing key '${key}'`);
    }
  }
  for (const key of localeKeys) {
    if (!enKeys.includes(key)) {
      failures.push(`${dictionaryPath}: locale '${locale}' has extra key '${key}'`);
    }
  }
}

if (enKeys.length === 0) {
  failures.push(`${dictionaryPath}: no English dictionary keys found`);
}

failIfAny(failures, `i18n dictionary checks passed for ${enKeys.length} keys.`);
```

- [ ] **Step 2: Run i18n guard**

Run:

```powershell
node docs\tests\verify-i18n-dictionaries.mjs
```

Expected: prints `i18n dictionary checks passed for ... keys.`

## Task 6: Add Repository Structure Guard

**Files:**
- Create: `docs/tests/verify-repository-structure.mjs`

- [ ] **Step 1: Create repository guard**

Add:

```js
import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const failures = [];

function hasImport(text, pattern) {
  return pattern.test(text);
}

for (const file of listFiles("src/features", [".ts", ".tsx"]).filter((item) => /repositories\/.+-repository\.ts$/.test(item))) {
  const text = readText(file);
  if (hasImport(text, /from\s+["']react["']|from\s+["']next\//)) {
    failures.push(`${file}: repository interfaces must not import React or Next`);
  }
}

const adapterFiles = [
  ...listFiles("src/features", [".ts", ".tsx"]).filter((item) => /adapters\/api\/.+\.ts$/.test(item)),
  ...listFiles("src/features", [".ts", ".tsx"]).filter((item) => /adapters\/supabase\/.+\.ts$/.test(item)),
];

for (const file of adapterFiles) {
  const text = readText(file);
  if (hasImport(text, /from\s+["']@\/server\//)) {
    failures.push(`${file}: client adapters must not import src/server`);
  }
  if (hasImport(text, /getServerSupabaseAdminClient|from\s+["']@\/lib\/supabase\/admin["']/)) {
    failures.push(`${file}: client adapters must not import Supabase admin clients`);
  }
}

for (const file of listFiles("src/features", [".ts", ".tsx"]).filter((item) => /repositories\/use-.+\.(ts|tsx)$/.test(item))) {
  const text = readText(file);
  if (hasImport(text, /mockRuntimeStore/)) {
    failures.push(`${file}: repository hooks must not import mockRuntimeStore`);
  }
}

failIfAny(failures, "Repository structure checks passed.");
```

- [ ] **Step 2: Run repository guard**

Run:

```powershell
node docs\tests\verify-repository-structure.mjs
```

Expected: `Repository structure checks passed.`

## Task 7: Add Shared UI Boundary Guard

**Files:**
- Create: `docs/tests/verify-shared-ui-boundaries.mjs`

- [ ] **Step 1: Create shared UI guard**

Add:

```js
import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const files = listFiles("src/components/ui", [".ts", ".tsx"]);
const failures = [];

for (const file of files) {
  const text = readText(file);
  if (/from\s+["']@\/features\//.test(text)) {
    failures.push(`${file}: shared UI must not import feature modules`);
  }
  if (/from\s+["']@\/app\/api\//.test(text)) {
    failures.push(`${file}: shared UI must not import API route modules`);
  }
  if (/from\s+["']@\/server\//.test(text)) {
    failures.push(`${file}: shared UI must not import server modules`);
  }
  if (/from\s+["']@\/lib\/supabase\//.test(text)) {
    failures.push(`${file}: shared UI must not import Supabase modules`);
  }
  if (/type\s+\w+Props/.test(text) && /onClose/.test(text) && !/aria-label|ariaLabel/.test(text)) {
    failures.push(`${file}: close-capable shared UI should expose an accessible label`);
  }
}

failIfAny(failures, "Shared UI boundary checks passed.");
```

- [ ] **Step 2: Run shared UI guard**

Run:

```powershell
node docs\tests\verify-shared-ui-boundaries.mjs
```

Expected: `Shared UI boundary checks passed.`

## Task 8: Add Backend Service Boundary Guard

**Files:**
- Create: `docs/tests/verify-backend-service-boundaries.mjs`

- [ ] **Step 1: Create backend boundary guard**

Add:

```js
import { listFiles, readText, failIfAny } from "./structure-test-helpers.mjs";

const failures = [];

for (const file of listFiles("src/server", [".ts", ".tsx"])) {
  const text = readText(file);
  if (/^["']use client["'];?/m.test(text)) {
    failures.push(`${file}: server modules must not be client components`);
  }
}

for (const file of listFiles("src/features", [".ts", ".tsx"])) {
  const text = readText(file);
  if (/getServerSupabaseAdminClient|from\s+["']@\/lib\/supabase\/admin["']/.test(text)) {
    failures.push(`${file}: feature code must not import Supabase admin clients`);
  }
}

for (const file of listFiles("src/components", [".ts", ".tsx"])) {
  const text = readText(file);
  if (/getServerSupabaseAdminClient|from\s+["']@\/lib\/supabase\/admin["']/.test(text)) {
    failures.push(`${file}: component code must not import Supabase admin clients`);
  }
}

failIfAny(failures, "Backend service boundary checks passed.");
```

- [ ] **Step 2: Run backend boundary guard**

Run:

```powershell
node docs\tests\verify-backend-service-boundaries.mjs
```

Expected: `Backend service boundary checks passed.`

## Task 9: Add Baseline Verification Runner

**Files:**
- Create: `docs/tests/verify-structure-baseline.mjs`

- [ ] **Step 1: Create runner**

Add:

```js
import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["docs/tests/verify-spec-wording.mjs"]],
  ["node", ["docs/tests/verify-structure-boundaries.mjs"]],
  ["node", ["docs/tests/verify-max-file-lines.mjs"]],
  ["node", ["docs/tests/verify-i18n-dictionaries.mjs"]],
  ["node", ["docs/tests/verify-repository-structure.mjs"]],
  ["node", ["docs/tests/verify-shared-ui-boundaries.mjs"]],
  ["node", ["docs/tests/verify-backend-service-boundaries.mjs"]],
  ["node", ["docs/tests/verify-reservation-api-refactor.mjs"]],
  ["node", ["docs/tests/verify-reservation-service-ownership.mjs"]],
  ["node", ["docs/tests/verify-reservation-modal-safety.mjs"]],
  ["node", ["docs/tests/verify-product-form-actions.mjs"]],
];

for (const [command, args] of commands) {
  const label = `${command} ${args.join(" ")}`;
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`\nVerification command failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nStructure baseline verification passed.");
```

- [ ] **Step 2: Run baseline runner**

Run:

```powershell
node docs\tests\verify-structure-baseline.mjs
```

Expected: all guards pass and final line is `Structure baseline verification passed.`

## Task 10: Build Verification

**Files:**
- Verify only

- [ ] **Step 1: Run build**

Run:

```powershell
npm run build
```

Expected: build passes.

- [ ] **Step 2: Run git diff check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors. Existing CRLF warnings are acceptable only if they are warnings and not errors.

## Task 11: Review And Commit

**Files:**
- All created verification scripts

- [ ] **Step 1: Check changed files**

Run:

```powershell
git status --short --untracked-files=all
```

Expected: new files are limited to `docs/tests/*.mjs` plus existing untracked spec/docs files from the structure-planning work.

- [ ] **Step 2: Commit only after user approval**

Stage the verification baseline files:

```powershell
git add docs/tests/structure-test-helpers.mjs docs/tests/verify-spec-wording.mjs docs/tests/verify-structure-boundaries.mjs docs/tests/verify-max-file-lines.mjs docs/tests/verify-i18n-dictionaries.mjs docs/tests/verify-repository-structure.mjs docs/tests/verify-shared-ui-boundaries.mjs docs/tests/verify-backend-service-boundaries.mjs docs/tests/verify-structure-baseline.mjs
```

Commit:

```powershell
git commit -m "Add structure verification baseline"
```

Do not include `.superpowers/` files in this commit.

## Approval Checkpoint

This plan is not implementation approval. Choose the next step:

```text
A. Implement the verification baseline scripts now.
B. Adjust the plan first.
C. Stop here.
```
