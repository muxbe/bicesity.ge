"use client";

import { LANGUAGE_OPTIONS } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/i18n-provider";

type LanguageSwitcherProps = {
  compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1 ${
        compact ? "gap-0.5" : "gap-1"
      }`}
      aria-label={t("language.select")}
    >
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          onClick={() => setLocale(option.locale)}
          title={option.label}
          aria-pressed={locale === option.locale}
          className={`h-8 rounded-md text-xs font-black transition ${
            compact ? "px-1.5 sm:px-2" : "px-2"
          } ${
            locale === option.locale
              ? "bg-slate-950 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          }`}
        >
          {option.shortLabel}
        </button>
      ))}
    </div>
  );
}
