"use client";

import { X } from "lucide-react";
import type { FieldDTO, FieldDataType } from "@/features/fields";
import { FieldOptionDrafts } from "@/features/fields/admin/field-option-drafts";

export type EditCustomFieldModalProps = {
  field: FieldDTO | null;
  fieldName: string;
  fieldNameRu: string;
  fieldNameKa: string;
  dataType: FieldDataType;
  isPublic: boolean;
  optionsEnabled: boolean;
  optionDrafts: string[];
  isSaving: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onFieldNameChange: (value: string) => void;
  onFieldNameRuChange: (value: string) => void;
  onFieldNameKaChange: (value: string) => void;
  onDataTypeChange: (value: FieldDataType) => void;
  onPublicChange: (value: boolean) => void;
  onOptionsEnabledChange: (value: boolean) => void;
  onOptionDraftChange: (index: number, value: string) => void;
  onOptionDraftRemove: (index: number) => void;
  onOptionDraftMove: (index: number, direction: -1 | 1) => void;
  onOptionDraftAdd: () => void;
  onSave: () => void;
  onClose: () => void;
};

export function EditCustomFieldModal({
  field,
  fieldName,
  fieldNameRu,
  fieldNameKa,
  dataType,
  isPublic,
  optionsEnabled,
  optionDrafts,
  isSaving,
  t,
  onFieldNameChange,
  onFieldNameRuChange,
  onFieldNameKaChange,
  onDataTypeChange,
  onPublicChange,
  onOptionsEnabledChange,
  onOptionDraftChange,
  onOptionDraftRemove,
  onOptionDraftMove,
  onOptionDraftAdd,
  onSave,
  onClose,
}: EditCustomFieldModalProps) {
  if (!field) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-md sm:p-4">
      <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 sm:max-h-[calc(100vh-2rem)] sm:rounded-[3rem] sm:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900">{t("fields.editFieldTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("fields.editFieldDescription")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label={t("fields.closeOptions")}
          >
            <X size={24} className="text-slate-600" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              {t("fields.englishLabel")}
            </label>
            <input
              type="text"
              value={fieldName}
              onChange={(event) => onFieldNameChange(event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
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

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => onPublicChange(event.target.checked)}
              className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
            />
            <span className="text-sm font-semibold text-slate-900">
              {t("fields.publicVisibility")}
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={optionsEnabled}
              onChange={(event) => onOptionsEnabledChange(event.target.checked)}
              className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
            />
            <span className="text-sm font-semibold text-slate-900">
              {t("fields.useFixedOptions")}
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
                  className="brand-control rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-cyan-50"
                >
                  {t("fields.addOption")}
                </button>
              </div>

              <FieldOptionDrafts
                drafts={optionDrafts}
                onChange={onOptionDraftChange}
                onRemove={onOptionDraftRemove}
                onMove={onOptionDraftMove}
                optionPlaceholder={(index) => t("fields.optionPlaceholder", { number: index + 1 })}
                deleteLabel={t("common.delete")}
                deleteButtonClassName="h-11 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                upLabel={t("fields.up")}
                downLabel={t("fields.down")}
              />
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            {t("fields.fixedOptionsHelp")}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || !fieldName.trim()}
              className="brand-primary flex-1 py-3 rounded-2xl font-semibold transition-colors disabled:bg-slate-300"
            >
              {isSaving ? t("common.saving") : t("fields.saveField")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white border border-slate-200 text-slate-900 font-semibold py-3 rounded-2xl hover:bg-slate-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
