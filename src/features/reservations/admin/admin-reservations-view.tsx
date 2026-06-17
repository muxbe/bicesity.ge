'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { CancelReservationModal } from '@/features/reservations/admin/cancel-reservation-modal';
import { CompleteReservationModal } from '@/features/reservations/admin/complete-reservation-modal';
import { ReservationCard } from '@/features/reservations/admin/reservation-card';
import { ReservationFilters } from '@/features/reservations/admin/reservation-filters';
import { ReservationSummaryCards } from '@/features/reservations/admin/reservation-summary-cards';
import { ResolveExpiredReservationModal } from '@/features/reservations/admin/resolve-expired-reservation-modal';
import { SellActiveReservationModal } from '@/features/reservations/admin/sell-active-reservation-modal';
import { useAdminReservationsController } from '@/features/reservations/admin/use-admin-reservations-controller';

export function AdminReservationsView() {
  const reservations = useAdminReservationsController();
  const { t } = reservations;

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-black text-slate-900 sm:text-4xl">
              {t('reservations.title')}
            </h1>
            <p className="text-slate-600">{t('reservations.lifecycleDescription')}</p>
          </div>

          <button
            type="button"
            onClick={() => void reservations.reload()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-cyan-50"
          >
            <RefreshCw className="h-4 w-4" />
            {t('common.reload')}
          </button>
        </div>

        {reservations.isRefreshing && (
          <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('reservations.refreshing')}
          </p>
        )}
        {reservations.lastRefreshAt && (
          <p className="mt-2 text-xs text-slate-500">
            {t('inventory.lastRefresh', {
              value: new Date(reservations.lastRefreshAt).toLocaleString(),
            })}
          </p>
        )}
        {reservations.isStale && (
          <div className="mt-2 flex items-center gap-3">
            <p className="text-xs text-amber-700">{t('reservations.stale')}</p>
            <button
              type="button"
              onClick={() => void reservations.reload()}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              <RefreshCw className="h-3 w-3" />
              {t('reports.retry')}
            </button>
          </div>
        )}
        {reservations.error && (
          <p className="mt-2 text-sm text-rose-600">{reservations.error}</p>
        )}
      </div>

      <ReservationSummaryCards counts={reservations.reservationCounts} />

      <ReservationFilters
        statusFilter={reservations.statusFilter}
        onStatusFilterChange={reservations.setStatusFilter}
        dateFilter={reservations.dateFilter}
        onDateFilterChange={reservations.setDateFilter}
        query={reservations.query}
        onQueryChange={reservations.setQuery}
      />

      {reservations.isLoading && reservations.reservations.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <p className="mb-2 text-lg font-semibold text-slate-900">
            {t('reservations.loadingTitle')}
          </p>
          <p className="text-slate-600">{t('reservations.loadingCopy')}</p>
        </div>
      ) : reservations.reservations.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <p className="mb-2 text-lg font-semibold text-slate-900">
            {t('reservations.emptyTitle')}
          </p>
          <p className="text-slate-600">{t('reservations.emptyCopy')}</p>
        </div>
      ) : reservations.visibleReservations.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <p className="mb-2 text-lg font-semibold text-slate-900">
            {t('reservations.noFilteredTitle')}
          </p>
          <p className="text-slate-600">{t('reservations.noFilteredCopy')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.visibleReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              isCancelling={reservations.isCancellingProductId === reservation.productId}
              isCompleting={reservations.isCompletingProductId === reservation.productId}
              isSellingActive={
                reservations.isSellingActiveReservationId === reservation.id
              }
              isResolvingExpired={
                reservations.isResolvingExpiredReservationId === reservation.id
              }
              onOpenCancelReservation={reservations.openCancelReservation}
              onOpenCompleteReservation={reservations.openCompleteReservation}
              onOpenActiveSale={reservations.openActiveSale}
              onOpenExpiredResolution={reservations.openExpiredResolution}
              onReload={reservations.reload}
            />
          ))}
        </div>
      )}

      <CancelReservationModal
        reservation={reservations.cancelModalReservation}
        reason={reservations.cancelReason}
        note={reservations.cancelNote}
        error={reservations.cancelError}
        isSubmitting={reservations.isCancelModalSubmitting}
        onReasonChange={reservations.setCancelReason}
        onNoteChange={reservations.setCancelNote}
        onClose={reservations.closeCancelReservation}
        onSubmit={reservations.submitCancelReservation}
      />
      <CompleteReservationModal
        reservation={reservations.completeModalReservation}
        error={reservations.completeError}
        isSubmitting={reservations.isCompleteModalSubmitting}
        onClose={reservations.closeCompleteReservation}
        onSubmit={reservations.submitCompleteReservation}
      />
      <SellActiveReservationModal
        reservation={reservations.activeSaleReservation}
        soldPrice={reservations.activeSalePrice}
        saleChannel={reservations.activeSaleChannel}
        auditNote={reservations.activeSaleNote}
        error={reservations.activeSaleError}
        isSubmitting={reservations.isActiveSaleSubmitting}
        onSoldPriceChange={reservations.setActiveSalePrice}
        onSaleChannelChange={reservations.setActiveSaleChannel}
        onAuditNoteChange={reservations.setActiveSaleNote}
        onClose={reservations.closeActiveSale}
        onSubmit={reservations.submitActiveSale}
      />
      <ResolveExpiredReservationModal
        reservation={reservations.expiredResolutionReservation}
        outcome={reservations.expiredResolutionOutcome}
        note={reservations.expiredResolutionNote}
        soldPrice={reservations.expiredSoldPrice}
        saleChannel={reservations.expiredSaleChannel}
        error={reservations.expiredResolutionError}
        isSubmitting={reservations.isExpiredResolutionSubmitting}
        onNoteChange={reservations.setExpiredResolutionNote}
        onSoldPriceChange={reservations.setExpiredSoldPrice}
        onSaleChannelChange={reservations.setExpiredSaleChannel}
        onClose={reservations.closeExpiredResolution}
        onSubmit={reservations.submitExpiredResolution}
      />
    </div>
  );
}
