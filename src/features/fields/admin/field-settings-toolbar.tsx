"use client";

import { Search } from "lucide-react";
import type { VisibilityFilter } from "@/features/fields/admin/field-settings-types";

export type FieldSettingsToolbarProps = {
  query: string;
  visibilityFilter: VisibilityFilter;
  visibleCount: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onQueryChange: (value: string) => void;
  onVisibilityFilterChange: (value: VisibilityFilter) => void;
};

export function FieldSettingsToolbar({
  query,
  visibilityFilter,
  visibleCount,
  t,
  onQueryChange,
  onVisibilityFilterChange,
}: FieldSettingsToolbarProps) {
  return (
    <div className="mb-6 grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 md:grid-cols-[1fr,220px,auto]">
      <div className="relative">
        <Search size={16} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("fields.searchPlaceholder")}
          className="brand-control h-11 w-full rounded-xl border pl-9 pr-3 text-sm"
        />
      </div>
      <select
        value={visibilityFilter}
        onChange={(event) => onVisibilityFilterChange(event.target.value as VisibilityFilter)}
        className="brand-control h-11 rounded-xl border px-3 text-sm"
      >
        <option value="all">{t("fields.allVisibility")}</option>
        <option value="public">{t("fields.publicOnly")}</option>
        <option value="internal">{t("fields.internalOnly")}</option>
      </select>
      <p className="text-xs text-slate-500 font-semibold">
        {t("fields.count", {
          count: visibleCount,
          plural: visibleCount === 1 ? "" : "s",
        })}
      </p>
    </div>
  );
}
