import type { ProductStatus } from '@/features/catalog';
import type { InventoryRole } from '../types';

export function inventoryTitleKey(role: InventoryRole, statusView: ProductStatus) {
  if (statusView === 'reserved') {
    return 'inventory.titleReserved';
  }
  if (statusView === 'sold') {
    return 'inventory.titleSold';
  }
  if (statusView === 'archived') {
    return 'inventory.titleDeleted';
  }
  return role === 'seller' ? 'inventory.titleSeller' : 'inventory.titleAdmin';
}

export function inventoryDescriptionKey(role: InventoryRole, statusView: ProductStatus) {
  if (statusView === 'reserved') {
    return 'inventory.descReserved';
  }
  if (statusView === 'sold') {
    return 'inventory.descSold';
  }
  if (statusView === 'archived') {
    return 'inventory.descDeleted';
  }
  return role === 'seller' ? 'inventory.descSeller' : 'inventory.descAdmin';
}
