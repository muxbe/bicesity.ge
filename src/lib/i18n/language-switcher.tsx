"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/i18n-provider";

type LanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
};

const LANGUAGE_DISPLAY_NAMES = {
  en: "English",
  ru: "Russian",
  ka: "Georgian",
};

export function LanguageSwitcher({ compact = false, className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeLanguage = LANGUAGE_OPTIONS.find((option) => option.locale === locale) ?? LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className={`relative inline-block shrink-0 ${className}`} aria-label={t("language.select")}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`brand-control inline-flex items-center justify-between gap-3 rounded-xl border px-3 text-sm font-black text-slate-900 transition hover:bg-cyan-50 ${
          compact ? "h-10 min-w-36" : "h-11 min-w-44"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-navy)] text-white">
            <Globe2 size={15} />
          </span>
          <span>{LANGUAGE_DISPLAY_NAMES[activeLanguage.locale]}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="rounded-md bg-cyan-50 px-2 py-1 text-[11px] text-cyan-700">
            {activeLanguage.shortLabel}
          </span>
          <ChevronDown size={16} className={`text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-[80] mt-2 w-56 overflow-hidden rounded-xl border border-cyan-100 bg-white p-1.5 shadow-2xl shadow-slate-900/15"
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const isActive = locale === option.locale;
            return (
              <button
                key={option.locale}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setLocale(option.locale);
                  setIsOpen(false);
                }}
                title={LANGUAGE_DISPLAY_NAMES[option.locale]}
                aria-pressed={locale === option.locale}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${
                  isActive
                    ? "bg-[var(--brand-navy)] text-white"
                    : "text-slate-700 hover:bg-cyan-50 hover:text-slate-950"
                }`}
              >
                <span className="inline-flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black ${
                      isActive ? "bg-white/15 text-white" : "bg-cyan-50 text-cyan-700"
                    }`}
                  >
                    {option.shortLabel}
                  </span>
                  <span>{LANGUAGE_DISPLAY_NAMES[option.locale]}</span>
                </span>
                {isActive && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
