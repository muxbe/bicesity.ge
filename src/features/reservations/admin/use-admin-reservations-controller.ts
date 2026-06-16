'use client';

import { useMemo, useState } from 'react';
import {
  getReservationRepository,
  useReservationData,
  type ResolveExpiredReservationDTO,
  type ReservationCancelReason,
  type ReservationDTO,
  type ReservationStatus,
} from '@/features/reservations';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { useI18n } from '@/lib/i18n';

export type ReservationStatusFilter = ReservationStatus | 'all';
export type ReservationDateFilter = 'all' | 'today' | 'upcoming' | 'past';
export type ReservationCounts = Record<ReservationStatus, number>;
export type ExpiredResolutionOutcome = ResolveExpiredReservationDTO['outcome'];

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
  const [cancelModalReservation, setCancelModalReservation] = useState<ReservationDTO | null>(null);
  const [cancelReason, setCancelReason] = useState<ReservationCancelReason | ''>('');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [completeModalReservation, setCompleteModalReservation] =
    useState<ReservationDTO | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [isCompletingProductId, setIsCompletingProductId] = useState<string | null>(null);
  const [expiredResolutionReservation, setExpiredResolutionReservation] =
    useState<ReservationDTO | null>(null);
  const [expiredResolutionOutcome, setExpiredResolutionOutcome] =
    useState<ExpiredResolutionOutcome>('release');
  const [expiredResolutionNote, setExpiredResolutionNote] = useState('');
  const [expiredSoldPrice, setExpiredSoldPrice] = useState('');
  const [expiredSaleChannel, setExpiredSaleChannel] =
    useState<'online' | 'in_store' | 'as_is'>('in_store');
  const [expiredResolutionError, setExpiredResolutionError] = useState<string | null>(null);
  const [isResolvingExpiredReservationId, setIsResolvingExpiredReservationId] =
    useState<string | null>(null);
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

  const openCancelReservation = (reservation: ReservationDTO) => {
    setCancelModalReservation(reservation);
    setCancelReason('');
    setCancelNote('');
    setCancelError(null);
  };

  const closeCancelReservation = () => {
    if (isCancellingProductId !== null) {
      return;
    }
    setCancelModalReservation(null);
    setCancelReason('');
    setCancelNote('');
    setCancelError(null);
  };

  const submitCancelReservation = async () => {
    if (!cancelModalReservation) {
      return;
    }
    if (!cancelReason) {
      setCancelError(t('reservations.cancelReasonRequired'));
      return;
    }

    const reservation = cancelModalReservation;
    setIsCancellingProductId(reservation.productId);
    setCancelError(null);
    try {
      await reservationRepository.cancelReservationByProductId(
        reservation.productId,
        cancelReason,
        cancelNote
      );
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
      setCancelModalReservation(null);
      setCancelReason('');
      setCancelNote('');
    } catch (caughtError) {
      setCancelError(
        caughtError instanceof Error ? caughtError.message : t('reservations.cancelFailed')
      );
    } finally {
      setIsCancellingProductId(null);
    }
  };

  const openCompleteReservation = (reservation: ReservationDTO) => {
    setCompleteModalReservation(reservation);
    setCompleteError(null);
  };

  const closeCompleteReservation = () => {
    if (isCompletingProductId !== null) {
      return;
    }
    setCompleteModalReservation(null);
    setCompleteError(null);
  };

  const submitCompleteReservation = async () => {
    if (!completeModalReservation) {
      return;
    }

    const reservation = completeModalReservation;
    setIsCompletingProductId(reservation.productId);
    setCompleteError(null);
    try {
      await reservationRepository.completeReservationByProductId(reservation.productId);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
      setCompleteModalReservation(null);
    } catch (caughtError) {
      setCompleteError(
        caughtError instanceof Error ? caughtError.message : t('reservations.completeFailed')
      );
    } finally {
      setIsCompletingProductId(null);
    }
  };

  const openExpiredResolution = (
    reservation: ReservationDTO,
    outcome: ExpiredResolutionOutcome
  ) => {
    setExpiredResolutionReservation(reservation);
    setExpiredResolutionOutcome(outcome);
    setExpiredResolutionNote('');
    setExpiredSoldPrice(outcome === 'sold' ? String(reservation.price) : '');
    setExpiredSaleChannel('in_store');
    setExpiredResolutionError(null);
  };

  const closeExpiredResolution = () => {
    if (isResolvingExpiredReservationId !== null) {
      return;
    }
    setExpiredResolutionReservation(null);
    setExpiredResolutionNote('');
    setExpiredSoldPrice('');
    setExpiredResolutionError(null);
  };

  const submitExpiredResolution = async () => {
    if (!expiredResolutionReservation) {
      return;
    }

    const input: ResolveExpiredReservationDTO =
      expiredResolutionOutcome === 'release'
        ? { outcome: 'release', note: expiredResolutionNote }
        : {
            outcome: 'sold',
            soldPrice: Number(expiredSoldPrice),
            saleChannel: expiredSaleChannel,
            note: expiredResolutionNote,
          };

    if (input.outcome === 'sold' && (!Number.isFinite(input.soldPrice) || input.soldPrice < 0)) {
      setExpiredResolutionError(t('reservations.resolveExpiredPriceRequired'));
      return;
    }

    setIsResolvingExpiredReservationId(expiredResolutionReservation.id);
    setExpiredResolutionError(null);
    try {
      await reservationRepository.resolveExpiredReservation(
        expiredResolutionReservation.id,
        input
      );
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
      setExpiredResolutionReservation(null);
      setExpiredResolutionNote('');
      setExpiredSoldPrice('');
    } catch (caughtError) {
      setExpiredResolutionError(
        caughtError instanceof Error ? caughtError.message : t('reservations.resolveExpiredFailed')
      );
    } finally {
      setIsResolvingExpiredReservationId(null);
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
    cancelModalReservation,
    cancelReason,
    setCancelReason,
    cancelNote,
    setCancelNote,
    cancelError,
    isCancelModalSubmitting:
      Boolean(cancelModalReservation) &&
      isCancellingProductId === cancelModalReservation?.productId,
    openCancelReservation,
    closeCancelReservation,
    submitCancelReservation,
    completeModalReservation,
    completeError,
    isCompletingProductId,
    isCompleteModalSubmitting:
      Boolean(completeModalReservation) &&
      isCompletingProductId === completeModalReservation?.productId,
    openCompleteReservation,
    closeCompleteReservation,
    submitCompleteReservation,
    expiredResolutionReservation,
    expiredResolutionOutcome,
    expiredResolutionNote,
    setExpiredResolutionNote,
    expiredSoldPrice,
    setExpiredSoldPrice,
    expiredSaleChannel,
    setExpiredSaleChannel,
    expiredResolutionError,
    isResolvingExpiredReservationId,
    isExpiredResolutionSubmitting:
      Boolean(expiredResolutionReservation) &&
      isResolvingExpiredReservationId === expiredResolutionReservation?.id,
    openExpiredResolution,
    closeExpiredResolution,
    submitExpiredResolution,
  };
}
