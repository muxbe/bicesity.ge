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
