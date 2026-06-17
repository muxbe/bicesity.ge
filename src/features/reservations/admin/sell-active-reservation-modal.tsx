'use client';

import { BadgeDollarSign, Loader2, X } from 'lucide-react';
import type { ReservationDTO, SellActiveReservationDTO } from '@/features/reservations';
import { useI18n } from '@/lib/i18n';

type ActiveSaleChannel = SellActiveReservationDTO['saleChannel'];

type SellActiveReservationModalProps = {
  reservation: ReservationDTO | null;
  soldPrice: string;
  saleChannel: ActiveSaleChannel;
  auditNote: string;
  error: string | null;
  isSubmitting: boolean;
  onSoldPriceChange: (soldPrice: string) => void;
  onSaleChannelChange: (saleChannel: ActiveSaleChannel) => void;
  onAuditNoteChange: (auditNote: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

const SALE_CHANNEL_OPTIONS: Array<{ value: ActiveSaleChannel; labelKey: string }> = [
  { value: 'in_store', labelKey: 'sale.inStore' },
  { value: 'online', labelKey: 'sale.online' },
  { value: 'as_is', labelKey: 'sale.asIs' },
];

export function SellActiveReservationModal({
  reservation,
  soldPrice,
  saleChannel,
  auditNote,
  error,
  isSubmitting,
  onSoldPriceChange,
  onSaleChannelChange,
  onAuditNoteChange,
  onClose,
  onSubmit,
}: SellActiveReservationModalProps) {
  const { t } = useI18n();

  if (!reservation) {
    return null;
  }

  const soldPriceMissing = soldPrice.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="sell-active-reservation-title"
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-sky-600">
              {t('reservations.markActiveSold')}
            </p>
            <h2
              id="sell-active-reservation-title"
              className="mt-1 text-xl font-black text-slate-950"
            >
              {t('reservations.sellActiveModalTitle')}
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
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sky-800">
            <p className="flex items-center gap-2 text-sm font-black">
              <BadgeDollarSign className="h-4 w-4" />
              {t('reservations.sellActiveModalDescription')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-900">
                {t('reservations.sellActiveSoldPrice')}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={soldPrice}
                onChange={(event) => onSoldPriceChange(event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-900">
                {t('reservations.sellActiveSaleChannel')}
              </span>
              <select
                value={saleChannel}
                onChange={(event) =>
                  onSaleChannelChange(event.target.value as ActiveSaleChannel)
                }
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              >
                {SALE_CHANNEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-900">
              {t('reservations.sellActiveAuditNote')}
            </span>
            <textarea
              value={auditNote}
              onChange={(event) => onAuditNoteChange(event.target.value)}
              maxLength={500}
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
            <span className="mt-1 block text-xs font-semibold text-slate-500">
              {auditNote.length}/500
            </span>
          </label>

          {soldPriceMissing && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {t('reservations.sellActivePriceRequired')}
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
            disabled={isSubmitting || soldPriceMissing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('reservations.sellActiveSubmit')}
          </button>
        </div>
      </form>
    </div>
  );
}
