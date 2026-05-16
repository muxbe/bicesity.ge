'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { CalendarClock, Clock3, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { getReservationRepository, useReservationData } from '@/features/reservations';
import type { ReservationDTO } from '@/features/reservations';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { getFallbackImage } from '@/features/catalog';
import { ReservationCommentEditor } from '@/features/reservations/components/reservation-comment-editor';
import { categoryLabel, reservationSourceLabel, useI18n } from '@/lib/i18n';

function formatReservationDate(rawDate: string) {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }
  return parsed.toLocaleDateString();
}

function formatReservationTime(rawDate: string) {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ReservationImage({ reservation }: { reservation: ReservationDTO }) {
  const fallback = getFallbackImage(reservation.category);
  const [imageSrc, setImageSrc] = useState(reservation.image || fallback);

  useEffect(() => {
    setImageSrc(reservation.image || fallback);
  }, [fallback, reservation.image]);

  return (
    <Image
      src={imageSrc}
      alt={reservation.productName}
      fill
      sizes="80px"
      className="object-cover"
      onError={() => setImageSrc(fallback)}
    />
  );
}

function ReservationCustomerSummary({ reservation }: { reservation: ReservationDTO }) {
  const { t } = useI18n();
  const rows = [
    [t('common.customer'), reservation.customerName || t('common.notSet')],
    [t('common.phone'), reservation.customerPhone || t('common.notSet')],
    [t('common.messenger'), reservation.messengerProfileUrl || t('common.notSet')],
    [t('common.source'), reservationSourceLabel(reservation.reservationSource, t)],
  ] satisfies Array<[string, string]>;

  return (
    <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-sky-800">
        {t('inventory.customerDetails')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-sky-700">{label}</p>
            {label === t('common.messenger') && value !== t('common.notSet') ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm font-semibold text-cyan-700 hover:underline"
              >
                {value}
              </a>
            ) : (
              <p className="break-words text-sm font-semibold text-slate-800">{value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReservationsPage() {
  const { t } = useI18n();
  const { reservations, isLoading, isRefreshing, error, reload, isStale, lastRefreshAt } = useReservationData('all');
  const [isCancellingProductId, setIsCancellingProductId] = useState<string | null>(null);
  const reservationRepository = useMemo(() => getReservationRepository(), []);

  const sortedReservations = useMemo(
    () =>
      [...reservations].sort((a, b) => a.reservedForAt.localeCompare(b.reservedForAt)),
    [reservations]
  );

  const activeReservations = sortedReservations.filter((reservation) => reservation.status === 'active');

  const cancelReservation = async (reservation: ReservationDTO) => {
    setIsCancellingProductId(reservation.productId);
    try {
      await reservationRepository.cancelReservationByProductId(
        reservation.productId,
        'seller_cancelled',
        t('reservations.cancelledNote')
      );
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
    } finally {
      setIsCancellingProductId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2 text-3xl font-black text-slate-900 sm:text-4xl">{t('reservations.title')}</h1>
        <p className="text-slate-600">{t('reservations.description')}</p>
        {isRefreshing && (
          <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('reservations.refreshing')}
          </p>
        )}
        {lastRefreshAt && (
          <p className="text-xs text-slate-500 mt-2">
            {t('inventory.lastRefresh', { value: new Date(lastRefreshAt).toLocaleString() })}
          </p>
        )}
        {isStale && (
          <div className="mt-2 flex items-center gap-3">
            <p className="text-xs text-amber-700">
              {t('reservations.stale')}
            </p>
            <button
              type="button"
              onClick={() => void reload()}
              className="h-7 px-2 rounded-md border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-50 inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              {t('reports.retry')}
            </button>
          </div>
        )}
        {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex items-center gap-3 text-slate-700">
          <CalendarClock className="w-5 h-5 text-[var(--brand-cyan-dark)]" />
          <p className="font-semibold">
            {t('reservations.activeCount', {
              count: activeReservations.length,
              plural: activeReservations.length === 1 ? '' : 's',
            })}
          </p>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
      </div>

      {isLoading && sortedReservations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <p className="text-lg font-semibold text-slate-900 mb-2">{t('reservations.loadingTitle')}</p>
          <p className="text-slate-600">{t('reservations.loadingCopy')}</p>
        </div>
      ) : sortedReservations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <p className="text-lg font-semibold text-slate-900 mb-2">{t('reservations.emptyTitle')}</p>
          <p className="text-slate-600">
            {t('reservations.emptyCopy')}
          </p>
        </div>
      ) : (
          <div className="space-y-4">
          {sortedReservations.map((reservation) => (
            <article
              key={reservation.id}
              className="grid grid-cols-[auto,1fr] gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-6 lg:grid-cols-[auto,1fr,auto] lg:gap-5"
            >
              <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-24 sm:w-24 sm:rounded-2xl">
                <ReservationImage reservation={reservation} />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900">{reservation.productName}</h2>
                <p className="text-sm text-slate-500 mt-1">{t('common.serial')}: {reservation.serial}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                    {categoryLabel(reservation.category, t)}
                  </span>
                  <span className="inline-block px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full text-xs font-semibold">
                    ${reservation.price.toLocaleString()}
                  </span>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      reservation.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : reservation.status === 'completed'
                        ? 'bg-cyan-50 text-cyan-700'
                        : reservation.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {reservation.status === 'active'
                      ? t('reservation.statusActive')
                      : reservation.status === 'completed'
                      ? t('reservation.statusCompleted')
                      : reservation.status === 'cancelled'
                      ? t('reservation.statusCancelled')
                      : t('reservation.statusExpired')}
                  </span>
                </div>
                <ReservationCustomerSummary reservation={reservation} />
                <ReservationCommentEditor
                  reservationId={reservation.id}
                  initialComment={reservation.sellerComment}
                  onSaved={reload}
                />
              </div>

              <div className="col-span-2 flex flex-col items-stretch justify-between gap-3 lg:col-span-1 lg:items-end">
                <div className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">{t('reservations.meetingTime')}</p>
                  <p className="text-sm font-bold text-sky-900 mt-1">
                    {formatReservationDate(reservation.reservedForAt)}
                  </p>
                  <p className="text-sm text-sky-800 flex items-center gap-2 mt-1">
                    <Clock3 className="w-4 h-4" />
                    {formatReservationTime(reservation.reservedForAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => cancelReservation(reservation)}
                  disabled={reservation.status !== 'active' || isCancellingProductId === reservation.productId}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCancellingProductId === reservation.productId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {t('reservations.cancel')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
