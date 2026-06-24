"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttributeDTO, ProductDTO } from "@/features/catalog";
import { CRITICAL_INVALIDATION_TAGS } from "@/features/shared/freshness/critical-field-registry";
import { useFocusFreshness } from "@/features/shared/freshness/use-focus-freshness";
import { fallbackMessengerTargetUrl } from "@/features/shop/home/home-helpers";
import type {
  HomeCatalogResult,
  ShopBootstrapApiResponse,
  Translate,
} from "@/features/shop/home/home-types";
import type { ShopBootstrapDTO } from "@/features/shop/shop-bootstrap";

async function loadShopBootstrap(): Promise<ShopBootstrapDTO> {
  const response = await fetch("/api/shop/bootstrap", { cache: "no-store" });
  const payload = (await response
    .json()
    .catch(() => null)) as ShopBootstrapApiResponse | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error ?? "Failed to load shop data.");
  }
  return payload.data;
}

export function useHomeCatalog(t: Translate): HomeCatalogResult {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [attributes, setAttributes] = useState<AttributeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messengerUrl, setMessengerUrl] = useState(
    fallbackMessengerTargetUrl()
  );
  const hasLoadedBootstrapRef = useRef(false);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const loadBootstrapData = useCallback(
    async (options: { background?: boolean } = {}) => {
      const shouldShowLoader =
        !options.background || !hasLoadedBootstrapRef.current;

      if (shouldShowLoader) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const nextData = await loadShopBootstrap();
        setProducts(nextData.products);
        setAttributes(nextData.attributes);
        setMessengerUrl(nextData.settings.messengerUrl.trim());
        hasLoadedBootstrapRef.current = true;
      } catch (loadError) {
        if (hasLoadedBootstrapRef.current) {
          return;
        }
        setError(tRef.current("home.failedShopData"));
      } finally {
        if (shouldShowLoader) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  const freshness = useFocusFreshness({
    tags: [CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL],
    onRefresh: () => loadBootstrapData({ background: true }),
  });

  return {
    products,
    attributes,
    messengerUrl,
    isLoading,
    isRefreshing: freshness.isRefreshing,
    error,
  };
}