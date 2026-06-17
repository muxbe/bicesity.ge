"use client";

import { X } from "lucide-react";
import type { FieldDataType } from "@/features/fields";
import { FieldOptionDrafts } from "@/features/fields/admin/field-option-drafts";

export type AddFieldModalProps = {
  isOpen: boolean;
  fieldName: string;
  fieldNameRu: string;
  fieldNameKa: string;
  dataType: FieldDataType;
  isPublic: boolean;
  optionsEnabled: boolean;
  optionDrafts: string[];
  isCreating: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onFieldNameChange: (value: string) => void;
  onFieldNameRuChange: (value: string) => void;
  onFieldNameKaChange: (value: string) => void;
  onDataTypeChange: (value: FieldDataType) => void;
  onPublicChange: (value: boolean) => void;
  onOptionsEnabledChange: (value: boolean) => void;
  onOptionDraftChange: (index: number, value: string) => void;
  onOptionDraftRemove: (index: number) => void;
  onOptionDraftAdd: () => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function AddFieldModal({
  isOpen,
  fieldName,
  fieldNameRu,
  fieldNameKa,
  dataType,
  isPublic,
  optionsEnabled,
  optionDrafts,
  isCreating,
  t,
  onFieldNameChange,
  onFieldNameRuChange,
  onFieldNameKaChange,
  onDataTypeChange,
  onPublicChange,
  onOptionsEnabledChange,
  onOptionDraftChange,
  onOptionDraftRemove,
  onOptionDraftAdd,
  onSubmit,
  onClose,
}: AddFieldModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-md sm:p-4">
      <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 sm:rounded-[3rem] sm:p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-slate-900">{t("fields.addNewField")}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={24} className="text-slate-600" />
          </button>
        </div>

        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              {t("fields.englishLabel")}
            </label>
            <input
              type="text"
              value={fieldName}
              onChange={(event) => onFieldNameChange(event.target.value)}
              placeholder={t("fields.fieldNamePlaceholder")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400"
            />
            <p className="mt-2 text-xs text-slate-500">{t("fields.translationHelp")}</p>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              {t("fields.russianLabel")}
            </label>
            <input
              type="text"
              value={fieldNameRu}
              onChange={(event) => onFieldNameRuChange(event.target.value)}
              placeholder={t("fields.russianLabelOptional")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              {t("fields.georgianLabel")}
            </label>
            <input
              type="text"
              value={fieldNameKa}
              onChange={(event) => onFieldNameKaChange(event.target.value)}
              placeholder={t("fields.georgianLabelOptional")}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              {t("fields.fieldType")}
            </label>
            <select
              value={dataType}
              onChange={(event) => onDataTypeChange(event.target.value as FieldDataType)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
            >
              <option value="text">{t("fields.text")}</option>
              <option value="number">{t("fields.number")}</option>
              <option value="boolean">{t("fields.boolean")}</option>
              <option value="date">{t("fields.date")}</option>
              <option value="url">{t("fields.url")}</option>
              <option value="image">{t("fields.imageUrl")}</option>
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={optionsEnabled}
                onChange={(event) => onOptionsEnabledChange(event.target.checked)}
                className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
              />
              <span className="text-sm font-semibold text-slate-900">
                {t("fields.addFixedOptions")}
              </span>
            </label>

            {optionsEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    {t("fields.options")}
                  </p>
                  <button
                    type="button"
                    onClick={onOptionDraftAdd}
                    className="brand-control rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white"
                  >
                    {t("fields.addOption")}
                  </button>
                </div>

                <FieldOptionDrafts
                  drafts={optionDrafts}
                  onChange={onOptionDraftChange}
                  onRemove={onOptionDraftRemove}
                  optionPlaceholder={(index) => t("fields.optionPlaceholder", { number: index + 1 })}
                  deleteLabel={t("common.delete")}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(event) => onPublicChange(event.target.checked)}
              className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
            />
            <label htmlFor="isPublic" className="text-sm font-semibold text-slate-900 cursor-pointer">
              {t("fields.publicVisibility")}
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isCreating || !fieldName.trim()}
              className="brand-primary flex-1 py-3 rounded-2xl font-semibold transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isCreating ? t("fields.creating") : t("fields.createField")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white border border-slate-200 text-slate-900 font-semibold py-3 rounded-2xl hover:bg-slate-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
