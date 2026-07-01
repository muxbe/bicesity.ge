"use client";

import { Eye, EyeOff, GripVertical, Loader2, Pencil, Trash2 } from "lucide-react";
import type { FieldDTO } from "@/features/fields";
import {
  coreFieldOptions,
  type CoreFieldKey,
  type FieldLayoutItem,
} from "@/features/fields/field-layout";
import { canEditCoreOptions } from "@/features/fields/admin/field-settings-helpers";
import type { FieldLayoutConfig } from "@/features/fields/admin/field-settings-types";
import { fieldNameLabel, type Locale } from "@/lib/i18n";

export type FieldCardProps = {
  item: FieldLayoutItem;
  index: number;
  locale: Locale;
  workingFieldId: string | null;
  draggingFieldId: string | null;
  dragOverFieldId: string | null;
  canReorderFields: boolean;
  fieldLayoutConfig: FieldLayoutConfig;
  t: (key: string, params?: Record<string, string | number>) => string;
  onToggleCoreVisibility: (fieldKey: CoreFieldKey, isPublic: boolean) => void;
  onToggleFieldVisibility: (field: FieldDTO) => void;
  onOpenCoreEditor: (item: Extract<FieldLayoutItem, { kind: "core" }>) => void;
  onOpenOptionsEditor: (field: FieldDTO) => void;
  onArchiveField: (fieldId: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (targetId: string, dataTransferId: string) => void;
  onDragEnd: () => void;
};

export function FieldCard({
  item,
  index,
  locale,
  workingFieldId,
  draggingFieldId,
  dragOverFieldId,
  canReorderFields,
  fieldLayoutConfig,
  t,
  onToggleCoreVisibility,
  onToggleFieldVisibility,
  onOpenCoreEditor,
  onOpenOptionsEditor,
  onArchiveField,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: FieldCardProps) {
  const isCore = item.kind === "core";
  const fieldName = isCore ? item.core.name : fieldNameLabel(item.field, locale);
  const dataType = isCore ? item.core.dataType : item.field.dataType;
  const fieldKey = isCore ? item.core.key : item.field.fieldKey;
  const isWorking =
    workingFieldId === "reordering" || (!isCore && workingFieldId === item.field.id);

  return (
    <div
      draggable={canReorderFields}
      onDragStart={(event) => {
        if (!canReorderFields) {
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
        onDragStart(item.id);
      }}
      onDragOver={(event) => {
        if (!canReorderFields || !draggingFieldId || draggingFieldId === item.id) {
          return;
        }
        event.preventDefault();
        onDragOver(item.id);
      }}
      onDragLeave={() => {
        if (dragOverFieldId === item.id) {
          onDragLeave(item.id);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(item.id, event.dataTransfer.getData("text/plain"));
      }}
      onDragEnd={onDragEnd}
      className={`rounded-2xl border bg-white p-4 transition-colors sm:rounded-[2rem] sm:p-6 ${
        dragOverFieldId === item.id
          ? "border-cyan-500 ring-2 ring-cyan-100"
          : "border-slate-200 hover:border-slate-300"
      } ${canReorderFields ? "cursor-grab active:cursor-grabbing" : ""} ${
        draggingFieldId === item.id ? "opacity-60" : ""
      }`}
    >
      <div className="mb-4 flex justify-between items-start">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              isCore
                ? onToggleCoreVisibility(item.core.key, item.isPublic)
                : onToggleFieldVisibility(item.field)
            }
            onMouseDown={(event) => event.stopPropagation()}
            disabled={isWorking}
            className="bg-slate-50 p-3 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
            title={item.isPublic ? t("fields.makeInternal") : t("fields.makeVisible")}
            aria-label={
              item.isPublic
                ? t("fields.makeFieldInternal", { name: fieldName })
                : t("fields.makeFieldVisible", { name: fieldName })
            }
          >
            {item.isPublic ? (
              <Eye size={20} className="text-[var(--brand-cyan-dark)]" />
            ) : (
              <EyeOff size={20} className="text-amber-500" />
            )}
          </button>
          <span
            className={`rounded-xl p-3 text-slate-400 ${
              canReorderFields ? "bg-slate-50" : "bg-slate-100 opacity-50"
            }`}
            title={canReorderFields ? t("fields.dragReorder") : t("fields.savingOrderShort")}
          >
            {workingFieldId === "reordering" ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <GripVertical size={20} />
            )}
          </span>
        </div>
        {isCore ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenCoreEditor(item)}
              onMouseDown={(event) => event.stopPropagation()}
              disabled={isWorking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title={t("fields.editCore")}
            >
              <Pencil size={13} />
              {t("common.edit")}
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {t("fields.core")}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenOptionsEditor(item.field)}
              onMouseDown={(event) => event.stopPropagation()}
              disabled={isWorking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title={t("fields.editField")}
            >
              <Pencil size={13} />
              {t("common.edit")}
            </button>
            <button
              type="button"
              onClick={() => onArchiveField(item.field.id)}
              onMouseDown={(event) => event.stopPropagation()}
              disabled={isWorking}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors group disabled:opacity-50"
              title={t("fields.deleteField")}
            >
              {workingFieldId === item.field.id ? (
                <Loader2 size={18} className="animate-spin text-slate-400" />
              ) : (
                <Trash2
                  size={18}
                  className="text-slate-300 group-hover:text-red-500 transition-colors"
                />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-lg font-black text-slate-900">{fieldName}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
          #{index + 1}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
          {item.isPublic ? t("fields.visible") : t("inventory.internal")}
        </span>
        <span className="inline-block px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full text-xs font-semibold">
          {dataType}
        </span>
        <span className="inline-block px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-xs font-semibold">
          {fieldKey}
        </span>
        {!isCore && item.field.inputMode === "single_select" && item.field.options.length > 0 && (
          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
            {t("fields.dropdown", { count: item.field.options.length })}
          </span>
        )}
        {!isCore && item.field.inputMode !== "single_select" && (
          <span className="inline-block px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-xs font-semibold">
            {t("fields.freeInput")}
          </span>
        )}
        {isCore && canEditCoreOptions(item.core.key) && (
          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
            {t("fields.optionsCount", {
              count: coreFieldOptions(fieldLayoutConfig, item.core.key).length,
            })}
          </span>
        )}
      </div>
    </div>
  );
}
