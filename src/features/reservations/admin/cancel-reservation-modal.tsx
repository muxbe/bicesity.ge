'use client';

import { Loader2, X } from 'lucide-react';
import type { ReservationCancelReason, ReservationDTO } from '@/features/reservations';
import { useI18n } from '@/lib/i18n';

type ManualCancelReason = Exclude<ReservationCancelReason, 'expired'>;

type CancelReservationModalProps = {
  reservation: ReservationDTO | null;
  reason: ReservationCancelReason | '';
  note: string;
  error: string | null;
  isSubmitting: boolean;
  onReasonChange: (reason: ManualCancelReason) => void;
  onNoteChange: (note: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

const REASON_OPTIONS: Array<{ value: ManualCancelReason; labelKey: string }> = [
  { value: 'customer_cancelled', labelKey: 'reservations.cancelReasonCustomerCancelled' },
  { value: 'seller_cancelled', labelKey: 'reservations.cancelReasonSellerCancelled' },
  { value: 'no_show', labelKey: 'reservations.cancelReasonNoShow' },
  { value: 'other', labelKey: 'reservations.cancelReasonOther' },
];

export function CancelReservationModal({
  reservation,
  reason,
  note,
  error,
  isSubmitting,
  onReasonChange,
  onNoteChange,
  onClose,
  onSubmit,
}: CancelReservationModalProps) {
  const { t } = useI18n();

  if (!reservation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-reservation-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-rose-600">
              {t('reservations.cancelModalEyebrow')}
            </p>
            <h2 id="cancel-reservation-title" className="mt-1 text-xl font-black text-slate-950">
              {t('reservations.cancelModalTitle')}
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

        <div className="space-y-5 px-5 py-5">
          <div>
            <p className="mb-3 text-sm font-black text-slate-900">
              {t('reservations.cancelReasonLabel')}
            </p>
            <div className="grid gap-2">
              {REASON_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    reason === option.value
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => onReasonChange(option.value)}
                    className="h-4 w-4 accent-rose-600"
                  />
                  {t(option.labelKey)}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-900">
              {t('reservations.cancelNoteLabel')}
            </span>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              maxLength={500}
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
              placeholder={t('reservations.cancelNotePlaceholder')}
            />
            <span className="mt-1 block text-xs font-semibold text-slate-500">
              {note.length}/500
            </span>
          </label>

          {!reason && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {t('reservations.cancelReasonRequired')}
            </p>
          )}

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
            disabled={isSubmitting || !reason}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('reservations.cancelModalSubmit')}
          </button>
        </div>
      </form>
    </div>
  );
}
