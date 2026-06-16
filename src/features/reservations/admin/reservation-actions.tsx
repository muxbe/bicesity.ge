'use client';

import { Loader2, Trash2 } from 'lucide-react';
import type { ReservationDTO } from '@/features/reservations';
import { useI18n } from '@/lib/i18n';

type ReservationActionsProps = {
  reservation: ReservationDTO;
  isCancelling: boolean;
  onOpenCancelReservation: (reservation: ReservationDTO) => void;
};

export function ReservationActions({
  reservation,
  isCancelling,
  onOpenCancelReservation,
}: ReservationActionsProps) {
  const { t } = useI18n();

  if (reservation.status !== 'active') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenCancelReservation(reservation)}
      disabled={isCancelling}
      className="flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {t('reservations.cancel')}
    </button>
  );
}
