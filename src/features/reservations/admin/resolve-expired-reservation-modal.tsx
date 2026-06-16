'use client';

import { BadgeDollarSign, Loader2, RotateCcw, X } from 'lucide-react';
import type { ResolveExpiredReservationDTO, ReservationDTO } from '@/features/reservations';
import type { ExpiredResolutionOutcome } from '@/features/reservations/admin/use-admin-reservations-controller';
import { useI18n } from '@/lib/i18n';

type ExpiredSaleChannel = Extract<
  ResolveExpiredReservationDTO,
  { outcome: 'sold' }
>['saleChannel'];

type ResolveExpiredReservationModalProps = {
  reservation: ReservationDTO | null;
  outcome: ExpiredResolutionOutcome;
  note: string;
  soldPrice: string;
  saleChannel: ExpiredSaleChannel;
  error: string | null;
  isSubmitting: boolean;
  onNoteChange: (note: string) => void;
  onSoldPriceChange: (soldPrice: string) => void;
  onSaleChannelChange: (saleChannel: ExpiredSaleChannel) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

const OUTCOME_META = {
  release: {
    outcome: 'release',
    accent: 'emerald',
    Icon: RotateCcw,
  },
  sold: {
    outcome: 'sold',
    accent: 'sky',
    Icon: BadgeDollarSign,
  },
} as const satisfies Record<
  ExpiredResolutionOutcome,
  {
    outcome: ExpiredResolutionOutcome;
    accent: 'emerald' | 'sky';
    Icon: typeof RotateCcw;
  }
>;

const SALE_CHANNEL_OPTIONS: Array<{ value: ExpiredSaleChannel; labelKey: string }> = [
  { value: 'in_store', labelKey: 'sale.inStore' },
  { value: 'online', labelKey: 'sale.online' },
  { value: 'as_is', labelKey: 'sale.asIs' },
];

function outcomeLabel(outcome: ExpiredResolutionOutcome, t: ReturnType<typeof useI18n>['t']) {
  return outcome === 'release'
    ? t('reservations.releaseProduct')
    : t('reservations.markSoldAfterExpiry');
}

export function ResolveExpiredReservationModal({
  reservation,
  outcome,
  note,
  soldPrice,
  saleChannel,
  error,
  isSubmitting,
  onNoteChange,
  onSoldPriceChange,
  onSaleChannelChange,
  onClose,
  onSubmit,
}: ResolveExpiredReservationModalProps) {
  const { t } = useI18n();

  if (!reservation) {
    return null;
  }

  const meta = OUTCOME_META[outcome];
  const Icon = meta.Icon;
  const label = outcomeLabel(outcome, t);
  const isSoldOutcome = outcome === 'sold';
  const soldPriceMissing = isSoldOutcome && soldPrice.trim().length === 0;
  const accentClasses =
    meta.accent === 'emerald'
      ? 'border-emerald-100 text-emerald-700 bg-emerald-50'
      : 'border-sky-100 text-sky-700 bg-sky-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-expired-reservation-title"
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
              {t('reservations.expiredOutcomeTitle')}
            </p>
            <h2
              id="resolve-expired-reservation-title"
              className="mt-1 text-xl font-black text-slate-950"
            >
              {label}
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
          <div className={`rounded-2xl border px-4 py-3 ${accentClasses}`}>
            <p className="flex items-center gap-2 text-sm font-black">
              <Icon className="h-4 w-4" />
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {t('reservations.expiredOutcomeDescription')}
            </p>
          </div>

          {isSoldOutcome && (
            <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-900">
                  {t('reservations.resolveExpiredSoldPrice')}
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
                  {t('reservations.resolveExpiredSaleChannel')}
                </span>
                <select
                  value={saleChannel}
                  onChange={(event) =>
                    onSaleChannelChange(event.target.value as ExpiredSaleChannel)
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
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-900">
              {t('reservations.resolveExpiredNote')}
            </span>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              maxLength={500}
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
            <span className="mt-1 block text-xs font-semibold text-slate-500">
              {note.length}/500
            </span>
          </label>

          {soldPriceMissing && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {t('reservations.resolveExpiredPriceRequired')}
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('reservations.resolveExpiredSubmit')}
          </button>
        </div>
      </form>
    </div>
  );
}
