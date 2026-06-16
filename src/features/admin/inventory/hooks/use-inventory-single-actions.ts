'use client';

import { useInventoryProductActions } from '@/features/admin/inventory/hooks/use-inventory-product-actions';
import { useInventoryStatusActions } from '@/features/admin/inventory/hooks/use-inventory-status-actions';

type UseInventorySingleActionsParams =
  Parameters<typeof useInventoryProductActions>[0] &
  Parameters<typeof useInventoryStatusActions>[0];

export function useInventorySingleActions(params: UseInventorySingleActionsParams) {
  const productActions = useInventoryProductActions(params);
  const statusActions = useInventoryStatusActions(params);

  return {
    ...productActions,
    ...statusActions,
  };
}
