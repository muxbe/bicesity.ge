'use client';

import { CheckCircle2, Loader2, X } from 'lucide-react';
import type { ReservationDTO } from '@/features/reservations';
import { useI18n } from '@/lib/i18n';

type CompleteReservationModalProps = {
  reservation: ReservationDTO | null;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

export function CompleteReservationModal({
  reservation,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: CompleteReservationModalProps) {
  const { t } = useI18n();

  if (!reservation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-reservation-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
              {t('reservations.complete')}
            </p>
            <h2 id="complete-reservation-title" className="mt-1 text-xl font-black text-slate-950">
              {t('reservations.completeModalTitle')}
            </h2>
            <p className="mt-2 break-words text-sm font-semibold text-slate-600">
              {reservation.productName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-800">
            <p className="flex items-center gap-2 text-sm font-black">
              <CheckCircle2 className="h-4 w-4" />
              {t('reservations.completeModalDescription')}
            </p>
          </div>

          {error && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('reservations.completeModalSubmit')}
          </button>
        </div>
      </form>
    </div>
  );
}
