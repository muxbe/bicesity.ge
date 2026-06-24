"use client";

import { useCallback, useMemo, useState } from "react";
import type { AttributeDTO, ProductDTO } from "@/features/catalog";
import {
  countActiveFilters,
  filterProducts,
  sanitizeAttributeValues,
} from "@/features/shop/home/home-helpers";
import {
  INITIAL_FILTERS,
  type CategoryFilter,
  type FilterState,
  type HomeFiltersResult,
} from "@/features/shop/home/home-types";

export function useHomeFilters(
  products: ProductDTO[],
  attributes: AttributeDTO[]
): HomeFiltersResult {
  const [draftFilters, setDraftFilters] =
    useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(INITIAL_FILTERS);
  const [isDetailedOpen, setIsDetailedOpen] = useState(false);

  const visibleAttributes = useMemo(
    () =>
      attributes.filter(
        (attribute) =>
          attribute.isPublic &&
          (draftFilters.category === "All" ||
            attribute.category === draftFilters.category)
      ),
    [attributes, draftFilters.category]
  );
  const detailedAttributeOptions = useMemo(() => {
    const scopedProducts = products.filter(
      (product) =>
        draftFilters.category === "All" ||
        product.category === draftFilters.category
    );
    const options: Record<string, string[]> = {};

    for (const attribute of visibleAttributes) {
      if (
        attribute.inputMode === "single_select" &&
        attribute.options.length > 0
      ) {
        options[attribute.id] = attribute.options.map(
          (option) => option.value
        );
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
  }, [draftFilters.category, products, visibleAttributes]);
  const bikeTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((product) => product.category === "Bicycle")
            .map((product) => product.type)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );
  const filteredProducts = useMemo(
    () => filterProducts(products, appliedFilters),
    [appliedFilters, products]
  );
  const activeFilterCount = useMemo(
    () => countActiveFilters(appliedFilters),
    [appliedFilters]
  );

  const updateDraftFilters = useCallback(
    (updates: Partial<FilterState>) => {
      setDraftFilters((current) => ({ ...current, ...updates }));
    },
    []
  );

  const updateAttributeFilter = useCallback(
    (attributeId: string, value: string) => {
      setDraftFilters((current) => ({
        ...current,
        attributeValues: {
          ...current.attributeValues,
          [attributeId]: value,
        },
      }));
    },
    []
  );

  const handleCategoryChange = useCallback(
    (value: CategoryFilter) => {
      setDraftFilters((current) => ({
        ...current,
        category: value,
        bikeType: value === "Parts" ? "All" : current.bikeType,
        attributeValues: sanitizeAttributeValues(
          current.attributeValues,
          value,
          attributes
        ),
      }));
    },
    [attributes]
  );

  const applyFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setIsDetailedOpen(false);
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    setDraftFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setIsDetailedOpen(false);
  }, []);

  const selectCatalogCategory = useCallback((category: CategoryFilter) => {
    const nextFilters: FilterState = { ...INITIAL_FILTERS, category };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setIsDetailedOpen(false);
  }, []);

  const toggleDetailedFilters = useCallback(() => {
    setIsDetailedOpen((current) => !current);
  }, []);

  const closeDetailedFilters = useCallback(() => {
    setIsDetailedOpen(false);
  }, []);

  return {
    draftFilters,
    appliedFilters,
    isDetailedOpen,
    visibleAttributes,
    detailedAttributeOptions,
    bikeTypeOptions,
    filteredProducts,
    activeFilterCount,
    updateDraftFilters,
    updateAttributeFilter,
    handleCategoryChange,
    applyFilters,
    resetFilters,
    selectCatalogCategory,
    toggleDetailedFilters,
    closeDetailedFilters,
  };
}