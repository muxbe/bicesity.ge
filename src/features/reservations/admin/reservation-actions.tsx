'use client';

import { BadgeDollarSign, CheckCircle2, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import type { ReservationDTO } from '@/features/reservations';
import type { ExpiredResolutionOutcome } from '@/features/reservations/admin/use-admin-reservations-controller';
import { useI18n } from '@/lib/i18n';

type ReservationActionsProps = {
  reservation: ReservationDTO;
  isCancelling: boolean;
  isCompleting: boolean;
  isResolvingExpired: boolean;
  onOpenCancelReservation: (reservation: ReservationDTO) => void;
  onOpenCompleteReservation: (reservation: ReservationDTO) => void;
  onOpenExpiredResolution: (
    reservation: ReservationDTO,
    outcome: ExpiredResolutionOutcome
  ) => void;
};

export function ReservationActions({
  reservation,
  isCancelling,
  isCompleting,
  isResolvingExpired,
  onOpenCancelReservation,
  onOpenCompleteReservation,
  onOpenExpiredResolution,
}: ReservationActionsProps) {
  const { t } = useI18n();

  if (reservation.status === 'expired') {
    return (
      <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
        <button
          type="button"
          onClick={() => onOpenExpiredResolution(reservation, 'release')}
          disabled={isResolvingExpired}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResolvingExpired ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {t('reservations.releaseProduct')}
        </button>
        <button
          type="button"
          onClick={() => onOpenExpiredResolution(reservation, 'sold')}
          disabled={isResolvingExpired}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-300 px-4 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResolvingExpired ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BadgeDollarSign className="h-4 w-4" />
          )}
          {t('reservations.markSoldAfterExpiry')}
        </button>
      </div>
    );
  }

  if (reservation.status !== 'active') {
    return null;
  }

  const isBusy = isCancelling || isCompleting;

  return (
    <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
      <button
        type="button"
        onClick={() => onOpenCompleteReservation(reservation)}
        disabled={isBusy}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCompleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {t('reservations.complete')}
      </button>
      <button
        type="button"
        onClick={() => onOpenCancelReservation(reservation)}
        disabled={isBusy}
        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCancelling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {t('reservations.cancel')}
      </button>
    </div>
  );
}
