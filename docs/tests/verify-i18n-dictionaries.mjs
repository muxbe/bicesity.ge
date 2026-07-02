import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
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

const globalEntriesByLocale = new Map(
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

function parseJsonString(raw, context) {
  try {
    return JSON.parse(`"${raw}"`);
  } catch (error) {
    failures.push(`${context}: invalid string literal (${error.message})`);
    return raw;
  }
}

function entriesForLocale(text, locale, filePath) {
  const block = localeBlock(text, locale);
  return [...block.matchAll(/"((?:\\.|[^"\\])+)":\s*"((?:\\.|[^"\\])*)"/g)]
    .map((match) => ({
      key: parseJsonString(match[1], `${filePath}: locale '${locale}' key`),
      value: parseJsonString(match[2], `${filePath}: locale '${locale}' value`),
    }));
}

function outputPathFor(sourcePath, tempRoot) {
  return path.join(tempRoot, sourcePath).replace(/\.ts$/, ".mjs");
}

function relativeImportSpecifier(fromOutputPath, toOutputPath) {
  const relative = path
    .relative(path.dirname(fromOutputPath), toOutputPath)
    .replace(/\\/g, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function resolveAliasSourcePath(aliasPath) {
  const sourceBase = path.join("src", aliasPath).replace(/\\/g, "/");
  const filePath = `${sourceBase}.ts`;
  if (pathExists(filePath)) {
    return filePath;
  }
  const indexPath = `${sourceBase}/index.ts`;
  if (pathExists(indexPath)) {
    return indexPath;
  }
  throw new Error(`Unable to resolve aliased import '@/${aliasPath}'`);
}

function rewriteAliasImports(source, outputPath, tempRoot) {
  const rewrite = (match, prefix, quote, aliasPath) => {
    const targetSourcePath = resolveAliasSourcePath(aliasPath);
    const targetOutputPath = outputPathFor(targetSourcePath, tempRoot);
    return `${prefix}${quote}${relativeImportSpecifier(outputPath, targetOutputPath)}${quote}`;
  };

  return source
    .replace(/(from\s+)(["'])@\/([^"']+)\2/g, rewrite)
    .replace(/(import\s+)(["'])@\/([^"']+)\2/g, rewrite);
}

async function loadRuntimeDictionaries() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "i18n-dictionaries-"));
  const sourcePaths = [
    rootDictionaryPath,
    `${dictionaryDir}/types.ts`,
    `${dictionaryDir}/merge.ts`,
    `${dictionaryDir}/index.ts`,
    ...modules.map((module) => `${dictionaryDir}/${module.file}`),
  ];

  try {
    for (const sourcePath of sourcePaths) {
      const outputPath = outputPathFor(sourcePath, tempRoot);
      mkdirSync(path.dirname(outputPath), { recursive: true });

      const source = rewriteAliasImports(readText(sourcePath), outputPath, tempRoot);
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ES2022,
          target: ts.ScriptTarget.ES2020,
        },
        fileName: sourcePath,
      });
      writeFileSync(outputPath, transpiled.outputText);
    }

    const runtimeModule = await import(
      pathToFileURL(outputPathFor(rootDictionaryPath, tempRoot)).href
    );
    return runtimeModule.dictionaries;
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
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
    const entries = entriesForLocale(text, locale, path);
    if (entries.length === 0) {
      failures.push(`${path}: locale '${locale}' has no keys`);
    }

    for (const { key, value } of entries) {
      const prefix = key.split(".")[0];
      const expectedOwner = prefixOwners.get(prefix);
      if (expectedOwner !== module.file) {
        failures.push(
          `${path}: key '${key}' belongs in ${expectedOwner ?? "no known module"}`
        );
      }

      const localeEntries = globalEntriesByLocale.get(locale);
      if (localeEntries.has(key)) {
        failures.push(
          `${path}: duplicate key '${key}' also found in ${localeEntries.get(key).path}`
        );
      }
      localeEntries.set(key, { path, value });
    }
  }
}

const enKeys = [...(globalEntriesByLocale.get("en") ?? new Map()).keys()].sort();
for (const locale of ["ru", "ka"]) {
  const localeKeys = [...(globalEntriesByLocale.get(locale) ?? new Map()).keys()].sort();
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

let runtimeDictionaries;
try {
  runtimeDictionaries = await loadRuntimeDictionaries();
} catch (error) {
  failures.push(`${rootDictionaryPath}: failed to load runtime dictionaries (${error.message})`);
}

if (runtimeDictionaries) {
  for (const locale of expectedLocales) {
    const runtimeEntries = runtimeDictionaries[locale];
    const sourceEntries = globalEntriesByLocale.get(locale) ?? new Map();

    if (!runtimeEntries || typeof runtimeEntries !== "object" || Array.isArray(runtimeEntries)) {
      failures.push(`${rootDictionaryPath}: runtime locale '${locale}' is missing or invalid`);
      continue;
    }

    for (const [key, sourceEntry] of sourceEntries) {
      if (!Object.prototype.hasOwnProperty.call(runtimeEntries, key)) {
        failures.push(`${rootDictionaryPath}: runtime locale '${locale}' missing key '${key}'`);
        continue;
      }
      if (runtimeEntries[key] !== sourceEntry.value) {
        failures.push(`${rootDictionaryPath}: runtime locale '${locale}' changed value for '${key}'`);
      }
    }

    for (const key of Object.keys(runtimeEntries)) {
      if (!sourceEntries.has(key)) {
        failures.push(`${rootDictionaryPath}: runtime locale '${locale}' has extra key '${key}'`);
      }
    }
  }
}

failIfAny(
  failures,
  `i18n split dictionary checks passed for ${enKeys.length} keys.`
);