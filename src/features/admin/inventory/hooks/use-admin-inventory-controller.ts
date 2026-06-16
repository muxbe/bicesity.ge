'use client';

import { useMemo } from 'react';
import type { AdminInventoryPageProps } from '@/features/admin/inventory/types';
import { inventoryDescriptionKey, inventoryTitleKey } from '@/features/admin/inventory/utils/inventory-copy';
import { useInventoryActionState } from '@/features/admin/inventory/hooks/use-inventory-action-state';
import { useInventoryBulkActions } from '@/features/admin/inventory/hooks/use-inventory-bulk-actions';
import { useInventoryFilters } from '@/features/admin/inventory/hooks/use-inventory-filters';
import { useInventoryModalState } from '@/features/admin/inventory/hooks/use-inventory-modal-state';
import { useInventorySelection } from '@/features/admin/inventory/hooks/use-inventory-selection';
import { useInventorySingleActions } from '@/features/admin/inventory/hooks/use-inventory-single-actions';
import { getCatalogRepository, useCatalogData } from '@/features/catalog';
import { useReservationData } from '@/features/reservations';
import { getCatalogDataSource } from '@/lib/feature-flags';
import { hasSupabasePublicEnv } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';

export function useAdminInventoryController({
  role = 'admin',
  statusView = 'active',
}: AdminInventoryPageProps) {
  const { t } = useI18n();
  const catalogData = useCatalogData({
    status: statusView,
  });
  const {
    reservations: activeReservationsForComments,
    isLoading: areReservationCommentsLoading,
    error: reservationCommentError,
    reload: reloadReservationComments,
  } = useReservationData('active', { enabled: statusView === 'reserved' });
  const catalogRepository = useMemo(() => getCatalogRepository(), []);
  const { products, attributes, reload } = catalogData;

  const isAdmin = role === 'admin';
  const permissions = {
    canManageCatalog: isAdmin && statusView === 'active',
    canReserve: statusView === 'active',
    canBulkReserve: statusView === 'active',
    canCancelReservation: statusView === 'reserved',
    canDiscountSelected: isAdmin && (statusView === 'active' || statusView === 'reserved'),
    canMarkSold: isAdmin && (statusView === 'active' || statusView === 'reserved'),
    canDelete: isAdmin && statusView !== 'archived',
    canRestore: isAdmin && statusView === 'archived',
    canClearArchived: isAdmin && statusView === 'archived',
  };
  const pageTitle = t(inventoryTitleKey(role, statusView));
  const pageDescription = t(inventoryDescriptionKey(role, statusView));
  const canUploadToStorage = getCatalogDataSource() === 'supabase' && hasSupabasePublicEnv();

  const actionState = useInventoryActionState({ reload });
  const modalState = useInventoryModalState({
    soldFromAdminNote: t('inventory.soldFromAdminNote'),
    bulkSaleNote: t('inventory.bulkSaleNote'),
  });
  const filters = useInventoryFilters({
    statusView,
    products,
    attributes,
    statusCounts: catalogData.statusCounts,
  });
  const visibleProductIds = useMemo(
    () => filters.visibleProducts.map((product) => product.id),
    [filters.visibleProducts]
  );
  const selection = useInventorySelection({ visibleProductIds });

  const activeReservationByProductId = useMemo(
    () =>
      new Map(
        activeReservationsForComments
          .filter((reservation) => reservation.status === 'active')
          .map((reservation) => [reservation.productId, reservation])
      ),
    [activeReservationsForComments]
  );

  const reloadPageData = async () => {
    actionState.setActionError(null);
    actionState.setActionErrorKey(null);
    await Promise.all([
      reload(),
      statusView === 'reserved' ? reloadReservationComments() : Promise.resolve(),
    ]);
  };

  const bulkActions = useInventoryBulkActions({
    role,
    products,
    selectedProductIds: selection.selectedProductIds,
    setSelectedProductIds: selection.setSelectedProductIds,
    clearSelectedProductIds: selection.clearSelectedProductIds,
    canClearArchived: permissions.canClearArchived,
    bulkMode: modalState.bulkMode,
    bulkDiscountInput: modalState.bulkDiscountInput,
    bulkDiscountReason: modalState.bulkDiscountReason,
    reserveAtLocal: modalState.reserveAtLocal,
    reserveNote: modalState.reserveNote,
    reservationContext: modalState.reservationContext,
    sellChannel: modalState.sellChannel,
    sellNote: modalState.sellNote,
    setActionError: actionState.setActionError,
    runAction: actionState.runAction,
    setBulkResult: modalState.setBulkResult,
    closeBulkModal: modalState.closeBulkModal,
    t,
  });

  const singleActions = useInventorySingleActions({
    role,
    attributes,
    catalogRepository,
    runAction: actionState.runAction,
    postBulkAction: bulkActions.postBulkAction,
    t,
    createDraft: modalState.createDraft,
    setCreateDraft: modalState.setCreateDraft,
    setCreateOpen: modalState.setCreateOpen,
    editProductId: modalState.editProductId,
    editDraft: modalState.editDraft,
    setEditDraft: modalState.setEditDraft,
    setEditProductId: modalState.setEditProductId,
    reserveProductId: modalState.reserveProductId,
    reserveAtLocal: modalState.reserveAtLocal,
    reserveNote: modalState.reserveNote,
    reservationContext: modalState.reservationContext,
    closeReserveDraft: modalState.closeReserveDraft,
    sellProductId: modalState.sellProductId,
    sellPrice: modalState.sellPrice,
    sellChannel: modalState.sellChannel,
    sellNote: modalState.sellNote,
    setSellProductId: modalState.setSellProductId,
    setSellPrice: modalState.setSellPrice,
    setSellNote: modalState.setSellNote,
    criticalDrafts: modalState.criticalDrafts,
    setCriticalDrafts: modalState.setCriticalDrafts,
    setWorkingKey: actionState.setWorkingKey,
    setActionError: actionState.setActionError,
    setActionErrorKey: actionState.setActionErrorKey,
    openEditDraft: modalState.openEditDraft,
    openReserveDraft: modalState.openReserveDraft,
    openSellDraft: modalState.openSellDraft,
  });

  return {
    t,
    pageTitle,
    pageDescription,
    attributes,
    isLoading: catalogData.isLoading,
    isRefreshing: catalogData.isRefreshing,
    error: catalogData.error,
    isStale: catalogData.isStale,
    lastRefreshAt: catalogData.lastRefreshAt,
    areReservationCommentsLoading,
    reservationCommentError,
    reloadReservationComments,
    canUploadToStorage,
    activeReservationByProductId,
    reloadPageData,
    ...permissions,
    ...actionState,
    ...filters,
    ...selection,
    ...modalState,
    ...bulkActions,
    ...singleActions,
  };
}
