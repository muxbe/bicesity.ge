'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Clock3 } from 'lucide-react';
import { formatGel, getFallbackImage } from '@/features/catalog';
import type { ReservationDTO } from '@/features/reservations';
import { ReservationCommentEditor } from '@/features/reservations/components/reservation-comment-editor';
import { ReservationActions } from '@/features/reservations/admin/reservation-actions';
import type { ExpiredResolutionOutcome } from '@/features/reservations/admin/use-admin-reservations-controller';
import { categoryLabel, reservationSourceLabel, useI18n } from '@/lib/i18n';

type ReservationCardProps = {
  reservation: ReservationDTO;
  isCancelling: boolean;
  isCompleting: boolean;
  isSellingActive: boolean;
  isResolvingExpired: boolean;
  onOpenCancelReservation: (reservation: ReservationDTO) => void;
  onOpenCompleteReservation: (reservation: ReservationDTO) => void;
  onOpenActiveSale: (reservation: ReservationDTO) => void;
  onOpenExpiredResolution: (
    reservation: ReservationDTO,
    outcome: ExpiredResolutionOutcome
  ) => void;
  onReload: () => void | Promise<void>;
};

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
      sizes="96px"
      className="object-cover"
      onError={() => setImageSrc(fallback)}
    />
  );
}

function statusClass(status: ReservationDTO['status']) {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'completed') {
    return 'bg-cyan-50 text-cyan-700';
  }
  if (status === 'cancelled') {
    return 'bg-rose-100 text-rose-700';
  }
  return 'bg-amber-100 text-amber-700';
}

function statusLabel(reservation: ReservationDTO, t: ReturnType<typeof useI18n>['t']) {
  if (reservation.status === 'active') {
    return t('reservation.statusActive');
  }
  if (reservation.status === 'completed') {
    return t('reservation.statusCompleted');
  }
  if (reservation.status === 'cancelled') {
    return t('reservation.statusCancelled');
  }
  return t('reservation.statusExpired');
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
            <p className="text-[11px] font-bold uppercase tracking-widest text-sky-700">
              {label}
            </p>
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

export function ReservationCard({
  reservation,
  isCancelling,
  isCompleting,
  isSellingActive,
  isResolvingExpired,
  onOpenCancelReservation,
  onOpenCompleteReservation,
  onOpenActiveSale,
  onOpenExpiredResolution,
  onReload,
}: ReservationCardProps) {
  const { t } = useI18n();

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[96px_minmax(0,1fr)] sm:p-5">
        <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-24 sm:w-24 sm:rounded-2xl">
          <ReservationImage reservation={reservation} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="line-clamp-2 break-words text-lg font-black text-slate-900">
                {reservation.productName}
              </h2>
              <p className="mt-1 break-words text-sm text-slate-500">
                {t('common.serial')}: {reservation.serial}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-xs lg:justify-end">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {categoryLabel(reservation.category, t)}
              </span>
              <span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                {formatGel(reservation.price)}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                  reservation.status
                )}`}
              >
                {statusLabel(reservation, t)}
              </span>
            </div>
          </div>
          <ReservationCustomerSummary reservation={reservation} />
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {reservation.status === 'active' ? (
          <ReservationCommentEditor
            reservationId={reservation.id}
            initialComment={reservation.sellerComment}
            onSaved={onReload}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">
              {t('reservations.readOnlyComment')}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold text-slate-700">
              {reservation.sellerComment || t('common.notSet')}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <div className="rounded-2xl border border-sky-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
                {t('reservations.meetingTime')}
              </p>
              <p className="mt-1 text-sm font-bold text-sky-900">
                {formatReservationDate(reservation.reservedForAt)}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-sky-800">
                <Clock3 className="h-4 w-4" />
                {formatReservationTime(reservation.reservedForAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                {t('reservations.expiryTime')}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {formatReservationDate(reservation.expiresAt)} {formatReservationTime(reservation.expiresAt)}
              </p>
            </div>
          </div>

          {(reservation.status === 'active' || reservation.status === 'expired') && (
            <div className="shrink-0 lg:min-w-[180px]">
              <ReservationActions
                reservation={reservation}
                isCancelling={isCancelling}
                isCompleting={isCompleting}
                isSellingActive={isSellingActive}
                isResolvingExpired={isResolvingExpired}
                onOpenCancelReservation={onOpenCancelReservation}
                onOpenCompleteReservation={onOpenCompleteReservation}
                onOpenActiveSale={onOpenActiveSale}
                onOpenExpiredResolution={onOpenExpiredResolution}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
