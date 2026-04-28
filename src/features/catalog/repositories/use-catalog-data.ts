"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AttributeDTO,
  ProductDTO,
  ProductStatusFilter,
} from "@/features/catalog/dto/catalog-dto";
import { getCatalogRepository } from "@/features/catalog/repositories/catalog-repository.factory";
import { CRITICAL_INVALIDATION_TAGS } from "@/features/shared/freshness/critical-field-registry";
import { useFocusFreshness } from "@/features/shared/freshness/use-focus-freshness";

type CatalogDataState = {
  products: ProductDTO[];
  attributes: AttributeDTO[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  isStale: boolean;
  lastRefreshAt: string | null;
};

export function useCatalogData(options: { status?: ProductStatusFilter } = {}): CatalogDataState {
  const repository = useMemo(() => getCatalogRepository(), []);
  const status = options.status ?? "all";
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [attributes, setAttributes] = useState<AttributeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async (options: { background?: boolean } = {}) => {
    const shouldUseBackgroundRefresh = options.background === true;
    const shouldShowInitialLoader = !shouldUseBackgroundRefresh || !hasLoadedOnceRef.current;

    if (shouldShowInitialLoader) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const [nextProducts, nextAttributes] = await Promise.all([
        repository.listProducts({ status }),
        repository.listAttributes(),
      ]);
      setProducts(nextProducts);
      setAttributes(nextAttributes);
      hasLoadedOnceRef.current = true;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load catalog data.";
      setError(message);
    } finally {
      if (shouldShowInitialLoader) {
        setIsLoading(false);
      }
    }
  }, [repository, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const freshness = useFocusFreshness({
    tags: [CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL],
    onRefresh: () => load({ background: true }),
  });

  return {
    products,
    attributes,
    isLoading,
    isRefreshing: freshness.isRefreshing,
    error,
    reload: () => load({ background: hasLoadedOnceRef.current }),
    isStale: freshness.isStale,
    lastRefreshAt: freshness.lastRefreshAt,
  };
}
