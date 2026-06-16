'use client';

import { useMemo, useState } from 'react';

type UseInventorySelectionParams = {
  visibleProductIds: string[];
};

export function useInventorySelection({ visibleProductIds }: UseInventorySelectionParams) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const selectedVisibleCount = useMemo(
    () => selectedProductIds.filter((id) => visibleProductIds.includes(id)).length,
    [selectedProductIds, visibleProductIds]
  );

  const allVisibleSelected =
    visibleProductIds.length > 0 && selectedVisibleCount === visibleProductIds.length;

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  const toggleSelectVisible = () => {
    setSelectedProductIds((current) => {
      const currentSet = new Set(current);
      if (allVisibleSelected) {
        return current.filter((id) => !visibleProductIds.includes(id));
      }
      visibleProductIds.forEach((id) => currentSet.add(id));
      return Array.from(currentSet);
    });
  };

  const clearSelectedProductIds = () => {
    setSelectedProductIds([]);
  };

  return {
    selectedProductIds,
    setSelectedProductIds,
    allVisibleSelected,
    toggleProductSelection,
    toggleSelectVisible,
    clearSelectedProductIds,
  };
}
