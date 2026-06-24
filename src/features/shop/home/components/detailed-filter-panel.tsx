import type { FormEvent } from "react";
import type { AttributeDTO } from "@/features/catalog";
import type {
  BikeTypeFilter,
  CategoryFilter,
  FilterState,
  StockFilter,
  Translate,
} from "@/features/shop/home/home-types";
import {
  driveTypeLabel,
  fieldNameLabel,
  type Locale,
} from "@/lib/i18n";

export type DetailedFilterPanelProps = {
  draftFilters: FilterState;
  visibleAttributes: AttributeDTO[];
  detailedAttributeOptions: Record<string, string[]>;
  bikeTypeOptions: string[];
  locale: string;
  t: Translate;
  onCategoryChange: (value: CategoryFilter) => void;
  onStockChange: (value: StockFilter) => void;
  onBikeTypeChange: (value: BikeTypeFilter) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onAttributeChange: (attributeId: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
};

export function DetailedFilterPanel({
  draftFilters,
  visibleAttributes,
  detailedAttributeOptions,
  bikeTypeOptions,
  locale,
  t,
  onCategoryChange,
  onStockChange,
  onBikeTypeChange,
  onMinPriceChange,
  onMaxPriceChange,
  onAttributeChange,
  onApply,
  onReset,
  onClose,
}: DetailedFilterPanelProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };

  return (
    <div className="border-b border-cyan-100 bg-white">
      <div className="brand-filter-panel max-w-7xl mx-auto border-x px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-slate-900">{t('home.detailed')}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="brand-control inline-flex h-9 items-center rounded-lg border px-3 text-xs font-bold text-slate-700 transition hover:bg-cyan-50"
          >
            {t('common.close')}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">{t('home.allCategories')}</label>
              <select
                value={draftFilters.category}
                onChange={(event) => onCategoryChange(event.target.value as CategoryFilter)}
                className="brand-control w-full h-11 rounded-xl border px-3 text-sm"
              >
                <option value="All">{t('home.allCategories')}</option>
                <option value="Bicycle">{t('common.bicycles')}</option>
                <option value="Parts">{t('common.parts')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">{t('home.allStock')}</label>
              <select
                value={draftFilters.stock}
                onChange={(event) => onStockChange(event.target.value as StockFilter)}
                className="brand-control w-full h-11 rounded-xl border px-3 text-sm"
              >
                <option value="All">{t('home.allStock')}</option>
                <option value="In Stock">{t('common.inStock')}</option>
                <option value="Out of Stock">{t('common.outOfStock')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">{t('home.bikeType')}</label>
              <select
                value={draftFilters.bikeType}
                onChange={(event) =>
                  onBikeTypeChange(event.target.value as BikeTypeFilter)
                }
                disabled={draftFilters.category === 'Parts'}
                className="brand-control w-full h-11 rounded-xl border px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="All">{t('home.allTypes')}</option>
                {bikeTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {driveTypeLabel(option, t)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">{t('home.minPrice')}</label>
              <input
                type="number"
                min="0"
                value={draftFilters.minPrice}
                onChange={(event) => onMinPriceChange(event.target.value)}
                placeholder="0"
                className="brand-control w-full h-11 rounded-xl border px-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">{t('home.maxPrice')}</label>
              <input
                type="number"
                min="0"
                value={draftFilters.maxPrice}
                onChange={(event) => onMaxPriceChange(event.target.value)}
                placeholder="15000"
                className="brand-control w-full h-11 rounded-xl border px-3 text-sm"
              />
            </div>

            {visibleAttributes.map((attribute) => (
              <div key={attribute.id}>
                <label className="block text-xs font-semibold text-slate-500 mb-2">
                  {fieldNameLabel(attribute, locale as Locale)}
                </label>
                <select
                  value={draftFilters.attributeValues[attribute.id] ?? ''}
                  onChange={(event) =>
                    onAttributeChange(attribute.id, event.target.value)
                  }
                  className="brand-control w-full h-11 rounded-xl border px-3 text-sm"
                >
                  <option value="">{t('common.any')}</option>
                  {(detailedAttributeOptions[attribute.id] ?? []).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="submit"
              className="brand-primary h-11 rounded-xl px-6 text-sm font-semibold transition"
            >
              {t('common.search')}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="brand-control h-11 rounded-xl border px-6 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50"
            >
              {t('common.clearAll')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
