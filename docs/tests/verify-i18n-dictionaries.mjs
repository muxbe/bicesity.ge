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
