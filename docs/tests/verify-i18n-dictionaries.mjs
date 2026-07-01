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