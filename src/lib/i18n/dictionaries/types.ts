export type Locale = "en" | "ru" | "ka";

export const LOCALES: readonly Locale[] = ["en", "ru", "ka"];

export type TranslationMap = Record<string, string>;
export type Dictionary = Record<Locale, TranslationMap>;
export type DictionarySection = Record<Locale, TranslationMap>;
