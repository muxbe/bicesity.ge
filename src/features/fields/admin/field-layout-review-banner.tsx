"use client";

import {
  coreFieldLabel,
  coreFieldsForCategory,
  corePublicVisibility,
  type FieldLayoutConfig,
} from "@/features/fields/field-layout";
import type { FieldSettingsTranslator } from "@/features/fields/admin/use-field-settings-controller";

export type FieldLayoutReviewBannerProps = {
  needsReview: boolean;
  storageReady: boolean;
  isSaving: boolean;
  legacyConfig: FieldLayoutConfig | null;
  t: FieldSettingsTranslator;
  onImportLegacy: () => void;
  onUseDefaults: () => void;
};

function publicCoreLabels(config: FieldLayoutConfig, category: "Bicycle" | "Parts") {
  return coreFieldsForCategory(category)
    .filter((field) => corePublicVisibility(config, category, field))
    .map((field) => coreFieldLabel(config, category, field))
    .join(", ");
}

export function FieldLayoutReviewBanner({
  needsReview,
  storageReady,
  isSaving,
  legacyConfig,
  t,
  onImportLegacy,
  onUseDefaults,
}: FieldLayoutReviewBannerProps) {
  if (!needsReview) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
      <h2 className="text-base font-black text-amber-950">{t("fields.layoutReviewTitle")}</h2>
      <p className="mt-1 text-sm leading-6 text-amber-900">
        {storageReady
          ? t("fields.layoutReviewDescription")
          : t("fields.layoutMigrationRequired")}
      </p>

      {storageReady && legacyConfig && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs text-amber-950">
          <p className="font-black">{t("fields.layoutImportPreview")}</p>
          <p className="mt-1">
            {t("fields.layoutVisiblePreview", {
              category: "Bicycle",
              fields: publicCoreLabels(legacyConfig, "Bicycle") || t("fields.layoutNoneVisible"),
            })}
          </p>
          <p className="mt-1">
            {t("fields.layoutVisiblePreview", {
              category: "Parts",
              fields: publicCoreLabels(legacyConfig, "Parts") || t("fields.layoutNoneVisible"),
            })}
          </p>
        </div>
      )}

      {storageReady && (
        <div className="mt-4 flex flex-wrap gap-2">
          {legacyConfig && (
            <button
              type="button"
              disabled={isSaving}
              onClick={onImportLegacy}
              className="min-h-10 rounded-lg bg-amber-900 px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {isSaving ? t("fields.layoutSaving") : t("fields.layoutImportBrowser")}
            </button>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={onUseDefaults}
            className="min-h-10 rounded-lg border border-amber-400 bg-white px-4 text-sm font-bold text-amber-950 disabled:opacity-60"
          >
            {isSaving ? t("fields.layoutSaving") : t("fields.layoutUseDefaults")}
          </button>
        </div>
      )}
    </section>
  );
}
