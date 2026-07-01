"use client";

import { X } from "lucide-react";
import { FieldOptionDrafts } from "@/features/fields/admin/field-option-drafts";
import type { CoreFieldEditor } from "@/features/fields/admin/field-settings-types";
import {
  CATEGORY_OPTION_VALUES_FOR_FIELDS,
  canEditCoreOptions,
} from "@/features/fields/admin/field-settings-helpers";

export type EditCoreFieldModalProps = {
  editor: CoreFieldEditor | null;
  fieldName: string;
  isPublic: boolean;
  optionDrafts: string[];
  t: (key: string, params?: Record<string, string | number>) => string;
  onFieldNameChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
  onOptionDraftChange: (index: number, value: string) => void;
  onOptionDraftRemove: (index: number) => void;
  onOptionDraftAdd: () => void;
  onSave: () => void;
  onClose: () => void;
};

export function EditCoreFieldModal({
  editor,
  fieldName,
  isPublic,
  optionDrafts,
  t,
  onFieldNameChange,
  onPublicChange,
  onOptionDraftChange,
  onOptionDraftRemove,
  onOptionDraftAdd,
  onSave,
  onClose,
}: EditCoreFieldModalProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-md sm:p-4">
      <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 sm:max-h-[calc(100vh-2rem)] sm:rounded-[3rem] sm:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900">{t("fields.editCoreTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("fields.editCoreDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label={t("fields.closeCoreEditor")}
          >
            <X size={24} className="text-slate-600" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              {t("fields.fieldName")}
            </label>
            <input
              type="text"
              value={fieldName}
              onChange={(event) => onFieldNameChange(event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
            />
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

          {canEditCoreOptions(editor.field.key) && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {t("fields.dropdownOptions")}
                </p>
                {editor.field.key !== "category" && (
                  <button
                    type="button"
                    onClick={onOptionDraftAdd}
                    className="brand-control rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-cyan-50"
                  >
                    {t("fields.addOption")}
                  </button>
                )}
              </div>

              {editor.field.key === "category" && (
                <p className="text-xs font-semibold text-slate-500">
                  {t("fields.categoryNote")}
                </p>
              )}

              <FieldOptionDrafts
                drafts={optionDrafts}
                onChange={onOptionDraftChange}
                onRemove={onOptionDraftRemove}
                optionPlaceholder={(index) => t("fields.optionPlaceholder", { number: index + 1 })}
                deleteLabel={t("common.delete")}
                deleteButtonClassName="h-11 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 hover:bg-rose-50"
                fixedValues={
                  editor.field.key === "category"
                    ? CATEGORY_OPTION_VALUES_FOR_FIELDS
                    : undefined
                }
                fixedValueLabel={(value) => t("fields.savesAs", { value })}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!fieldName.trim()}
              className="brand-primary flex-1 py-3 rounded-2xl font-semibold transition-colors disabled:bg-slate-300"
            >
              {t("fields.saveField")}
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
