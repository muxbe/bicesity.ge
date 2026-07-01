"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CategoryFilter,
  HomeNavigationResult,
  HomeViewMode,
  UseHomeNavigationOptions,
} from "@/features/shop/home/home-types";

function scrollToHomeSection(sectionId: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.requestAnimationFrame(() => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function useHomeNavigation({
  canRenderShop,
  onHashCategory,
  onCloseDetailedFilters,
  onClearRentNotices,
}: UseHomeNavigationOptions): HomeNavigationResult {
  const [activeView, setActiveView] =
    useState<HomeViewMode>("products");

  useEffect(() => {
    if (!canRenderShop || typeof window === "undefined") {
      return;
    }

    const applyHashView = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#rent") {
        setActiveView("rent");
        onCloseDetailedFilters();
        return;
      }

      const category: CategoryFilter =
        hash === "#bicycles"
          ? "Bicycle"
          : hash === "#components"
            ? "Parts"
            : "All";
      setActiveView("products");
      onHashCategory(category);
      onCloseDetailedFilters();
    };

    applyHashView();
    window.addEventListener("hashchange", applyHashView);
    return () => {
      window.removeEventListener("hashchange", applyHashView);
    };
  }, [canRenderShop, onCloseDetailedFilters, onHashCategory]);

  const showCatalogCategory = useCallback(
    (category: CategoryFilter, hash: string) => {
      setActiveView("products");
      onHashCategory(category);
      onCloseDetailedFilters();
      onClearRentNotices();

      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", hash);
      }
      scrollToHomeSection("explore");
    },
    [
      onClearRentNotices,
      onCloseDetailedFilters,
      onHashCategory,
    ]
  );

  const showRentView = useCallback(() => {
    setActiveView("rent");
    onCloseDetailedFilters();
    onClearRentNotices();

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "#rent");
    }
    scrollToHomeSection("rent");
  }, [onClearRentNotices, onCloseDetailedFilters]);

  return {
    activeView,
    showCatalogCategory,
    showRentView,
  };
}