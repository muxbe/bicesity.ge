'use client';

import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import type { AttributeDTO } from '@/features/catalog';
import type { BikeTypeFilter, CategoryTab, StockFilter } from '@/features/admin/inventory/types';
import {
  categoryLabel,
  driveTypeLabel,
  fieldNameLabel,
  useI18n,
} from '@/lib/i18n';

type InventoryCounts = {
  active: number;
  reserved: number;
  sold: number;
};

type InventoryFiltersProps = {
  counts: InventoryCounts;
  categoryTab: CategoryTab;
  onCategoryTabChange: (tab: CategoryTab) => void;
  query: string;
  onQueryChange: (value: string) => void;
  isDetailedFiltersOpen: boolean;
  onToggleDetailedFilters: () => void;
  stockFilter: StockFilter;
  onStockFilterChange: (value: StockFilter) => void;
  bikeTypeFilter: BikeTypeFilter;
  onBikeTypeFilterChange: (value: BikeTypeFilter) => void;
  minPriceFilter: string;
  onMinPriceFilterChange: (value: string) => void;
  maxPriceFilter: string;
  onMaxPriceFilterChange: (value: string) => void;
  attributeFilters: Record<string, string>;
  onAttributeFilterChange: (attributeId: string, value: string) => void;
  visibleFilterAttributes: AttributeDTO[];
  attributeOptionsById: Record<string, string[]>;
  driveTypeFilterOptions: string[];
  onResetDetailedFilters: () => void;
};

export function InventoryFilters({
  counts,
  categoryTab,
  onCategoryTabChange,
  query,
  onQueryChange,
  isDetailedFiltersOpen,
  onToggleDetailedFilters,
  stockFilter,
  onStockFilterChange,
  bikeTypeFilter,
  onBikeTypeFilterChange,
  minPriceFilter,
  onMinPriceFilterChange,
  maxPriceFilter,
  onMaxPriceFilterChange,
  attributeFilters,
  onAttributeFilterChange,
  visibleFilterAttributes,
  attributeOptionsById,
  driveTypeFilterOptions,
  onResetDetailedFilters,
}: InventoryFiltersProps) {
  const { locale, t } = useI18n();

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4 sm:gap-3 sm:mb-5">
        <div className="rounded-2xl border border-cyan-100 bg-white p-3 sm:p-4"><p className="text-[11px] text-slate-500 sm:text-xs">{t('common.active')}</p><p className="text-xl font-black text-slate-900 sm:text-2xl">{counts.active}</p></div>
        <div className="rounded-2xl border border-cyan-100 bg-white p-3 sm:p-4"><p className="text-[11px] text-slate-500 sm:text-xs">{t('common.reserved')}</p><p className="text-xl font-black text-slate-900 sm:text-2xl">{counts.reserved}</p></div>
        <div className="rounded-2xl border border-cyan-100 bg-white p-3 sm:p-4"><p className="text-[11px] text-slate-500 sm:text-xs">{t('common.sold')}</p><p className="text-xl font-black text-slate-900 sm:text-2xl">{counts.sold}</p></div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Bicycle', 'Parts'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onCategoryTabChange(tab)}
              className={`h-10 px-4 rounded-xl text-sm font-semibold ${
                categoryTab === tab
                  ? 'bg-[var(--brand-navy)] text-white'
                  : 'brand-control border text-slate-700'
              }`}
            >
              {tab === 'All' ? t('common.all') : categoryLabel(tab, t)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:min-w-72 sm:flex-1">
            <Search size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('inventory.searchPlaceholder')}
              className="brand-control h-10 w-full rounded-xl border pl-8 pr-3 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={onToggleDetailedFilters}
            className="brand-control inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold text-slate-700 hover:bg-cyan-50 sm:w-auto sm:px-4"
          >
            <SlidersHorizontal size={14} />
            {t('inventory.detailedFilters')}
            <ChevronDown
              size={14}
              className={`transition-transform ${isDetailedFiltersOpen ? 'rotate-180' : 'rotate-0'}`}
            />
          </button>
        </div>

        {isDetailedFiltersOpen && (
          <div className="brand-filter-panel grid grid-cols-1 gap-3 rounded-2xl border p-4 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={stockFilter}
              onChange={(event) => onStockFilterChange(event.target.value as StockFilter)}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            >
              <option value="All">{t('inventory.allStock')}</option>
              <option value="In Stock">{t('common.inStock')}</option>
              <option value="Out of Stock">{t('common.outOfStock')}</option>
            </select>

            <select
              value={bikeTypeFilter}
              onChange={(event) => onBikeTypeFilterChange(event.target.value as BikeTypeFilter)}
              disabled={categoryTab === 'Parts'}
              className="brand-control h-10 rounded-xl border px-3 text-sm disabled:bg-slate-100"
            >
              <option value="All">{t('inventory.allBikeTypes')}</option>
              {driveTypeFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {driveTypeLabel(option, t)}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              value={minPriceFilter}
              onChange={(event) => onMinPriceFilterChange(event.target.value)}
              placeholder={t('inventory.minPrice')}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            />

            <input
              type="number"
              min="0"
              value={maxPriceFilter}
              onChange={(event) => onMaxPriceFilterChange(event.target.value)}
              placeholder={t('inventory.maxPrice')}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            />

            {visibleFilterAttributes.map((attribute) => (
              <select
                key={attribute.id}
                value={attributeFilters[attribute.id] ?? ''}
                onChange={(event) => onAttributeFilterChange(attribute.id, event.target.value)}
                className="brand-control h-10 rounded-xl border px-3 text-sm"
              >
                <option value="">{fieldNameLabel(attribute, locale)}: {t('common.any')}</option>
                {(attributeOptionsById[attribute.id] ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ))}

            <button
              type="button"
              onClick={onResetDetailedFilters}
              className="brand-control h-10 px-4 rounded-xl border text-sm font-semibold text-slate-700 hover:bg-cyan-50"
            >
              {t('inventory.clearFilters')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
