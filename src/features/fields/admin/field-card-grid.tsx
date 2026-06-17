"use client";

import { Loader2, Plus } from "lucide-react";
import type { FieldLayoutItem } from "@/features/fields/field-layout";
import { FieldCard, type FieldCardProps } from "@/features/fields/admin/field-card";
import type { FieldLayoutConfig } from "@/features/fields/admin/field-settings-types";
import type { Locale } from "@/lib/i18n";

export type FieldCardGridProps = {
  isLoading: boolean;
  visibleLayoutItems: FieldLayoutItem[];
  locale: Locale;
  workingFieldId: string | null;
  draggingFieldId: string | null;
  dragOverFieldId: string | null;
  canReorderFields: boolean;
  fieldLayoutConfig: FieldLayoutConfig;
  t: (key: string, params?: Record<string, string | number>) => string;
  onAddField: () => void;
  onToggleCoreVisibility: FieldCardProps["onToggleCoreVisibility"];
  onToggleFieldVisibility: FieldCardProps["onToggleFieldVisibility"];
  onOpenCoreEditor: FieldCardProps["onOpenCoreEditor"];
  onOpenOptionsEditor: FieldCardProps["onOpenOptionsEditor"];
  onArchiveField: FieldCardProps["onArchiveField"];
  onDragStart: FieldCardProps["onDragStart"];
  onDragOver: FieldCardProps["onDragOver"];
  onDragLeave: FieldCardProps["onDragLeave"];
  onDrop: FieldCardProps["onDrop"];
  onDragEnd: FieldCardProps["onDragEnd"];
};

export function FieldCardGrid({
  isLoading,
  visibleLayoutItems,
  locale,
  workingFieldId,
  draggingFieldId,
  dragOverFieldId,
  canReorderFields,
  fieldLayoutConfig,
  t,
  onAddField,
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
}: FieldCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {!isLoading && visibleLayoutItems.length === 0 && (
        <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {t("fields.noMatch")}
        </div>
      )}
      {visibleLayoutItems.map((item, index) => (
        <FieldCard
          key={item.id}
          item={item}
          index={index}
          locale={locale}
          workingFieldId={workingFieldId}
          draggingFieldId={draggingFieldId}
          dragOverFieldId={dragOverFieldId}
          canReorderFields={canReorderFields}
          fieldLayoutConfig={fieldLayoutConfig}
          t={t}
          onToggleCoreVisibility={onToggleCoreVisibility}
          onToggleFieldVisibility={onToggleFieldVisibility}
          onOpenCoreEditor={onOpenCoreEditor}
          onOpenOptionsEditor={onOpenOptionsEditor}
          onArchiveField={onArchiveField}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        />
      ))}

      <button
        onClick={onAddField}
        className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-4 border-dashed border-cyan-200 p-6 transition-all hover:border-[var(--brand-cyan-dark)] hover:bg-cyan-50 sm:rounded-[3rem]"
      >
        <div className="p-3 bg-slate-50 rounded-xl mb-3 group-hover:bg-blue-100 transition-colors">
          {isLoading ? (
            <Loader2 size={24} className="animate-spin text-slate-400" />
          ) : (
            <Plus
              size={24}
              className="text-slate-400 group-hover:text-[var(--brand-cyan-dark)] transition-colors"
            />
          )}
        </div>
        <p className="text-sm font-semibold text-slate-600 group-hover:text-[var(--brand-cyan-dark)] transition-colors">
          {t("fields.addField")}
        </p>
      </button>
    </div>
  );
}
