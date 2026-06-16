'use client';

import { useMemo, useState } from 'react';
import {
  getReservationRepository,
  useReservationData,
  type ReservationDTO,
  type ReservationStatus,
} from '@/features/reservations';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { useI18n } from '@/lib/i18n';

export type ReservationStatusFilter = ReservationStatus | 'all';
export type ReservationDateFilter = 'all' | 'today' | 'upcoming' | 'past';
export type ReservationCounts = Record<ReservationStatus, number>;

const EMPTY_COUNTS: ReservationCounts = {
  active: 0,
  completed: 0,
  cancelled: 0,
  expired: 0,
};

function timestamp(rawDate: string) {
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function matchesDateFilter(reservation: ReservationDTO, dateFilter: ReservationDateFilter) {
  if (dateFilter === 'all') {
    return true;
  }

  const value = timestamp(reservation.reservedForAt);
  if (value === null) {
    return false;
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (dateFilter === 'today') {
    return value >= todayStart.getTime() && value < tomorrowStart.getTime();
  }

  if (dateFilter === 'upcoming') {
    return value >= now.getTime();
  }

  return value < now.getTime();
}

function matchesSearch(reservation: ReservationDTO, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    reservation.productName,
    reservation.serial,
    reservation.customerName,
    reservation.customerPhone,
    reservation.messengerProfileUrl,
    reservation.reservationSource,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}

export function useAdminReservationsController() {
  const { t } = useI18n();
  const { reservations, isLoading, isRefreshing, error, reload, isStale, lastRefreshAt } =
    useReservationData('all');
  const [statusFilter, setStatusFilter] = useState<ReservationStatusFilter>('active');
  const [dateFilter, setDateFilter] = useState<ReservationDateFilter>('all');
  const [query, setQuery] = useState('');
  const [isCancellingProductId, setIsCancellingProductId] = useState<string | null>(null);
  const reservationRepository = useMemo(() => getReservationRepository(), []);

  const sortedReservations = useMemo(
    () => [...reservations].sort((a, b) => a.reservedForAt.localeCompare(b.reservedForAt)),
    [reservations]
  );

  const reservationCounts = useMemo(
    () =>
      sortedReservations.reduce<ReservationCounts>(
        (counts, reservation) => ({
          ...counts,
          [reservation.status]: counts[reservation.status] + 1,
        }),
        EMPTY_COUNTS
      ),
    [sortedReservations]
  );

  const visibleReservations = useMemo(
    () =>
      sortedReservations.filter((reservation) => {
        if (statusFilter !== 'all' && reservation.status !== statusFilter) {
          return false;
        }
        if (!matchesDateFilter(reservation, dateFilter)) {
          return false;
        }
        return matchesSearch(reservation, query);
      }),
    [dateFilter, query, sortedReservations, statusFilter]
  );

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

  return {
    t,
    reservations: sortedReservations,
    visibleReservations,
    reservationCounts,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    query,
    setQuery,
    isLoading,
    isRefreshing,
    error,
    reload,
    isStale,
    lastRefreshAt,
    isCancellingProductId,
    cancelReservation,
  };
}
