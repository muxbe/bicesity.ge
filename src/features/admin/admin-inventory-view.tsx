'use client';

import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { InventoryActionModals } from '@/features/admin/inventory/components/inventory-action-modals';
import { InventoryBulkToolbar } from '@/features/admin/inventory/components/inventory-bulk-toolbar';
import { InventoryFilters } from '@/features/admin/inventory/components/inventory-filters';
import { InventoryProductList } from '@/features/admin/inventory/components/inventory-product-list';
import { useAdminInventoryController } from '@/features/admin/inventory/hooks/use-admin-inventory-controller';
import type { AdminInventoryPageProps } from '@/features/admin/inventory/types';

export function AdminInventoryView({
  role = 'admin',
  statusView = 'active',
}: AdminInventoryPageProps) {
  const inventory = useAdminInventoryController({ role, statusView });
  const { t } = inventory;

  return (
    <div className="w-full max-w-7xl">
      <div className="mb-6 flex flex-col items-stretch gap-4 sm:mb-7 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-black text-slate-900 sm:text-4xl">
            {inventory.pageTitle}
          </h1>
          <p className="mt-2 text-slate-600">{inventory.pageDescription}</p>

          {inventory.isRefreshing && (
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('inventory.refreshing')}
            </p>
          )}

          {inventory.lastRefreshAt && (
            <p className="mt-2 text-xs text-slate-500">
              {t('inventory.lastRefresh', {
                value: new Date(inventory.lastRefreshAt).toLocaleString(),
              })}
            </p>
          )}

          {inventory.isStale && (
            <p className="mt-1 text-xs text-amber-700">{t('inventory.dataStale')}</p>
          )}

          {(inventory.error || inventory.actionError) && (
            <div className="mt-2 flex max-w-2xl items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <p className="flex-1">{inventory.actionError ?? inventory.error}</p>
              {inventory.actionError && (
                <button
                  type="button"
                  onClick={inventory.dismissActionError}
                  className="rounded-md px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  {t('common.dismiss')}
                </button>
              )}
            </div>
          )}

          {statusView === 'reserved' && inventory.reservationCommentError && (
            <p className="mt-2 text-sm text-rose-600">
              {t('inventory.commentsCouldNotLoad', {
                error: inventory.reservationCommentError,
              })}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => void inventory.reloadPageData()}
            className="brand-control flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold text-slate-700 hover:bg-cyan-50"
          >
            <RefreshCw size={16} />
            {t('common.reload')}
          </button>

          {inventory.canManageCatalog && statusView === 'active' && (
            <button
              type="button"
              onClick={() => void inventory.openCreate()}
              className="brand-primary flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
            >
              <Plus size={16} />
              {t('inventory.addProduct')}
            </button>
          )}
        </div>
      </div>

      <InventoryFilters
        counts={inventory.counts}
        categoryTab={inventory.categoryTab}
        onCategoryTabChange={inventory.changeCategoryTab}
        query={inventory.query}
        onQueryChange={inventory.setQuery}
        isDetailedFiltersOpen={inventory.isDetailedFiltersOpen}
        onToggleDetailedFilters={() =>
          inventory.setIsDetailedFiltersOpen((current) => !current)
        }
        stockFilter={inventory.stockFilter}
        onStockFilterChange={inventory.setStockFilter}
        bikeTypeFilter={inventory.bikeTypeFilter}
        onBikeTypeFilterChange={inventory.setBikeTypeFilter}
        minPriceFilter={inventory.minPriceFilter}
        onMinPriceFilterChange={inventory.setMinPriceFilter}
        maxPriceFilter={inventory.maxPriceFilter}
        onMaxPriceFilterChange={inventory.setMaxPriceFilter}
        attributeFilters={inventory.attributeFilters}
        onAttributeFilterChange={inventory.changeAttributeFilter}
        visibleFilterAttributes={inventory.visibleFilterAttributes}
        attributeOptionsById={inventory.attributeOptionsById}
        driveTypeFilterOptions={inventory.driveTypeFilterOptions}
        onResetDetailedFilters={inventory.resetDetailedFilters}
      />

      <InventoryBulkToolbar
        statusView={statusView}
        selectedCount={inventory.selectedProductIds.length}
        allVisibleSelected={inventory.allVisibleSelected}
        canBulkReserve={inventory.canBulkReserve}
        canCancelReservation={inventory.canCancelReservation}
        canDiscountSelected={inventory.canDiscountSelected}
        canMarkSold={inventory.canMarkSold}
        canDelete={inventory.canDelete}
        canClearArchived={inventory.canClearArchived}
        workingKey={inventory.workingKey}
        bulkResult={inventory.bulkResult}
        onToggleSelectVisible={inventory.toggleSelectVisible}
        onStartReserve={inventory.startBulkReserve}
        onStartCancelReservation={inventory.startBulkCancelReservation}
        onStartDiscount={inventory.startBulkDiscount}
        onStartRemoveDiscount={inventory.startBulkRemoveDiscount}
        onStartSell={inventory.startBulkSell}
        onStartDelete={inventory.startBulkDelete}
        onClearSelection={inventory.clearSelection}
      />

      <InventoryProductList
        products={inventory.visibleProducts}
        attributes={inventory.attributes}
        statusView={statusView}
        isLoading={inventory.isLoading}
        selectedProductIds={inventory.selectedProductIds}
        criticalDrafts={inventory.criticalDrafts}
        workingKey={inventory.workingKey}
        actionError={inventory.actionError}
        actionErrorKey={inventory.actionErrorKey}
        activeReservationByProductId={inventory.activeReservationByProductId}
        areReservationCommentsLoading={inventory.areReservationCommentsLoading}
        reservationCommentError={inventory.reservationCommentError}
        canManageCatalog={inventory.canManageCatalog}
        canReserve={inventory.canReserve}
        canCancelReservation={inventory.canCancelReservation}
        canMarkSold={inventory.canMarkSold}
        canDelete={inventory.canDelete}
        canRestore={inventory.canRestore}
        onToggleProductSelection={inventory.toggleProductSelection}
        onCriticalDraftChange={inventory.updateDraft}
        onSaveCriticalFields={inventory.saveCriticalFields}
        onOpenEdit={inventory.openEdit}
        onOpenReserve={inventory.openReserve}
        onCancelReservation={inventory.cancelReservation}
        onOpenSell={inventory.openSell}
        onArchiveProduct={inventory.archiveProduct}
        onRestoreProduct={inventory.restoreArchivedProduct}
        onReloadReservationComments={inventory.reloadReservationComments}
      />

      <InventoryActionModals
        createOpen={inventory.createOpen}
        createDraft={inventory.createDraft}
        editProductId={inventory.editProductId}
        editDraft={inventory.editDraft}
        reserveProductId={inventory.reserveProductId}
        reserveAtLocal={inventory.reserveAtLocal}
        reserveNote={inventory.reserveNote}
        reservationContext={inventory.reservationContext}
        sellProductId={inventory.sellProductId}
        sellPrice={inventory.sellPrice}
        sellChannel={inventory.sellChannel}
        sellNote={inventory.sellNote}
        bulkMode={inventory.bulkMode}
        bulkDiscountInput={inventory.bulkDiscountInput}
        bulkDiscountReason={inventory.bulkDiscountReason}
        selectedCount={inventory.selectedProductIds.length}
        attributes={inventory.attributes}
        workingKey={inventory.workingKey}
        actionError={inventory.actionError}
        actionErrorKey={inventory.actionErrorKey}
        canUploadToStorage={inventory.canUploadToStorage}
        onCreateDraftChange={inventory.setCreateDraft}
        onEditDraftChange={inventory.setEditDraft}
        onReserveAtLocalChange={inventory.setReserveAtLocal}
        onReserveNoteChange={inventory.setReserveNote}
        onReservationContextChange={inventory.setReservationContext}
        onSellPriceChange={inventory.setSellPrice}
        onSellChannelChange={inventory.setSellChannel}
        onSellNoteChange={inventory.setSellNote}
        onBulkDiscountInputChange={inventory.setBulkDiscountInput}
        onBulkDiscountReasonChange={inventory.setBulkDiscountReason}
        onCloseCreate={() => inventory.setCreateOpen(false)}
        onCloseEdit={() => inventory.setEditProductId(null)}
        onCloseReserve={inventory.closeReserveDraft}
        onCloseSell={() => inventory.setSellProductId(null)}
        onCloseBulk={inventory.closeBulkModal}
        onSubmitCreate={inventory.submitCreate}
        onSubmitEdit={inventory.submitEdit}
        onSubmitReserve={inventory.submitReserve}
        onSubmitSell={inventory.submitSell}
        onSubmitBulkAction={inventory.submitBulkAction}
        onPreventImplicitReservationSubmit={inventory.preventImplicitReservationSubmit}
        onImageFileSelected={inventory.uploadImageIntoDraft}
      />
    </div>
  );
}

export default function AdminInventoryPage() {
  return <AdminInventoryView role="admin" statusView="active" />;
}
