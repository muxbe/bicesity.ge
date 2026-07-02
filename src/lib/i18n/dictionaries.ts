import type { Locale } from "@/lib/i18n/dictionaries/types";

export type { Locale } from "@/lib/i18n/dictionaries/types";
export { dictionaries } from "@/lib/i18n/dictionaries/index";

export const LANGUAGE_OPTIONS: Array<{
  locale: Locale;
  shortLabel: string;
  label: string;
}> = [
  { locale: "en", shortLabel: "EN", label: "English" },
  { locale: "ru", shortLabel: "RU", label: "Русский" },
  { locale: "ka", shortLabel: "KA", label: "ქართული" },
];

export const DEFAULT_LOCALE: Locale = "en";
