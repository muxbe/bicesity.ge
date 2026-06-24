import type { FormEvent } from "react";
import { ChevronDown, Loader2, Search, SlidersHorizontal } from "lucide-react";
import type {
  CategoryFilter,
  FilterState,
  StockFilter,
  Translate,
} from "@/features/shop/home/home-types";

export type HomeFilterToolbarProps = {
  draftFilters: FilterState;
  isDetailedOpen: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  activeFilterCount: number;
  productCount: number;
  t: Translate;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: CategoryFilter) => void;
  onStockChange: (value: StockFilter) => void;
  onToggleDetailed: () => void;
  onSearch: () => void;
};

export function HomeFilterToolbar({
  draftFilters,
  isDetailedOpen,
  isLoading,
  isRefreshing,
  error,
  activeFilterCount,
  productCount,
  t,
  onQueryChange,
  onCategoryChange,
  onStockChange,
  onToggleDetailed,
  onSearch,
}: HomeFilterToolbarProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <div className="border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 sm:py-4">
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-[1.7fr,1fr,1fr,auto,auto] lg:items-center"
        >
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={draftFilters.query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className="brand-control h-10 w-full rounded-xl border pl-10 pr-4 text-sm sm:h-11"
            />
          </div>

          <select
            value={draftFilters.category}
            onChange={(event) => onCategoryChange(event.target.value as CategoryFilter)}
            className="brand-control hidden h-11 rounded-xl border px-3 text-sm sm:block"
          >
            <option value="All">{t('home.allCategories')}</option>
            <option value="Bicycle">{t('common.bicycles')}</option>
            <option value="Parts">{t('common.parts')}</option>
          </select>

          <select
            value={draftFilters.stock}
            onChange={(event) => onStockChange(event.target.value as StockFilter)}
            className="brand-control hidden h-11 rounded-xl border px-3 text-sm sm:block"
          >
            <option value="All">{t('home.allStock')}</option>
            <option value="In Stock">{t('common.inStock')}</option>
            <option value="Out of Stock">{t('common.outOfStock')}</option>
          </select>

          <button
            type="button"
            onClick={onToggleDetailed}
            className="brand-control flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50 sm:h-11 sm:px-4"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t('home.detailed')}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                isDetailedOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          <button
            type="submit"
            className="brand-primary hidden h-11 rounded-xl px-6 text-sm font-semibold transition sm:col-span-2 sm:block lg:col-span-1"
          >
            {t('common.search')}
          </button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 sm:mt-3">
          <p>
            {isLoading
              ? t('home.loadingCatalog')
              : activeFilterCount > 0
              ? t('home.productsFoundWithFilters', {
                  count: productCount,
                  filters: activeFilterCount,
                })
              : t('home.productsFound', { count: productCount })}
          </p>
          {isRefreshing && (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('common.refreshingBackground')}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
      </div>

    </div>
  );
}
