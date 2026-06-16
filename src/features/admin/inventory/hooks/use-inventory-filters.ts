'use client';

import { useMemo, useState } from 'react';
import type { AttributeDTO, CatalogStatusCounts, ProductDTO, ProductStatus } from '@/features/catalog';
import { getCurrentPrice } from '@/features/catalog';
import type {
  BikeTypeFilter,
  CategoryTab,
  StockFilter,
} from '@/features/admin/inventory/types';
import { parseFilterPrice } from '@/features/admin/inventory/utils/money';
import { coreFieldOptions, loadFieldLayoutConfig } from '@/features/fields/field-layout';

type UseInventoryFiltersParams = {
  products: ProductDTO[];
  attributes: AttributeDTO[];
  statusView: ProductStatus;
  statusCounts?: CatalogStatusCounts;
};

export function useInventoryFilters({
  products,
  attributes,
  statusView,
  statusCounts,
}: UseInventoryFiltersParams) {
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('All');
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('All');
  const [bikeTypeFilter, setBikeTypeFilter] = useState<BikeTypeFilter>('All');
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const [isDetailedFiltersOpen, setIsDetailedFiltersOpen] = useState(false);

  const visibleFilterAttributes = useMemo(
    () =>
      attributes.filter(
        (attribute) => categoryTab === 'All' || attribute.category === categoryTab
      ),
    [attributes, categoryTab]
  );

  const attributeOptionsById = useMemo(() => {
    const scopedProducts = products.filter(
      (product) =>
        product.status === statusView &&
        (categoryTab === 'All' || product.category === categoryTab)
    );
    const options: Record<string, string[]> = {};
    for (const attribute of visibleFilterAttributes) {
      if (attribute.inputMode === 'single_select' && attribute.options.length > 0) {
        options[attribute.id] = attribute.options.map((option) => option.value);
        continue;
      }
      options[attribute.id] = Array.from(
        new Set(
          scopedProducts
            .map((product) => product.values[attribute.id])
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b));
    }
    return options;
  }, [categoryTab, products, statusView, visibleFilterAttributes]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minPrice = parseFilterPrice(minPriceFilter);
    const maxPrice = parseFilterPrice(maxPriceFilter);
    return products.filter((product) => {
      if (product.status !== statusView) {
        return false;
      }
      if (categoryTab !== 'All' && product.category !== categoryTab) {
        return false;
      }
      if (
        normalizedQuery &&
        ![product.name, product.serial, product.description]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }
      if (stockFilter === 'In Stock' && !product.inStock) {
        return false;
      }
      if (stockFilter === 'Out of Stock' && product.inStock) {
        return false;
      }
      if (bikeTypeFilter !== 'All') {
        if (product.category !== 'Bicycle' || product.type !== bikeTypeFilter) {
          return false;
        }
      }

      const currentPrice = getCurrentPrice(product);
      if (minPrice !== null && currentPrice < minPrice) {
        return false;
      }
      if (maxPrice !== null && currentPrice > maxPrice) {
        return false;
      }

      for (const [attributeId, selectedValue] of Object.entries(attributeFilters)) {
        if (selectedValue && product.values[attributeId] !== selectedValue) {
          return false;
        }
      }

      return true;
    });
  }, [
    products,
    categoryTab,
    query,
    stockFilter,
    bikeTypeFilter,
    minPriceFilter,
    maxPriceFilter,
    attributeFilters,
    statusView,
  ]);

  const driveTypeFilterOptions = useMemo(() => {
    const configuredOptions = coreFieldOptions(loadFieldLayoutConfig(), 'drive_type').map(
      (option) => option.value
    );
    const productOptions = products
      .map((product) => product.type)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set([...configuredOptions, ...productOptions])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [products]);

  const counts = useMemo(
    () =>
      statusCounts ?? {
        active: products.filter((item) => item.status === 'active').length,
        reserved: products.filter((item) => item.status === 'reserved').length,
        sold: products.filter((item) => item.status === 'sold').length,
        archived: products.filter((item) => item.status === 'archived').length,
      },
    [products, statusCounts]
  );

  const resetDetailedFilters = () => {
    setStockFilter('All');
    setBikeTypeFilter('All');
    setMinPriceFilter('');
    setMaxPriceFilter('');
    setAttributeFilters({});
  };

  const changeCategoryTab = (tab: CategoryTab) => {
    setCategoryTab(tab);
    if (tab === 'Parts') {
      setBikeTypeFilter('All');
    }
    setAttributeFilters({});
  };

  const changeAttributeFilter = (attributeId: string, value: string) => {
    setAttributeFilters((current) => ({
      ...current,
      [attributeId]: value,
    }));
  };

  return {
    counts,
    categoryTab,
    query,
    stockFilter,
    bikeTypeFilter,
    minPriceFilter,
    maxPriceFilter,
    attributeFilters,
    isDetailedFiltersOpen,
    visibleFilterAttributes,
    attributeOptionsById,
    driveTypeFilterOptions,
    visibleProducts,
    changeCategoryTab,
    setQuery,
    setIsDetailedFiltersOpen,
    setStockFilter,
    setBikeTypeFilter,
    setMinPriceFilter,
    setMaxPriceFilter,
    changeAttributeFilter,
    resetDetailedFilters,
  };
}
