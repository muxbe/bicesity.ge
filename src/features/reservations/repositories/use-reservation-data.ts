"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReservationDTO, ReservationStatus } from "@/features/reservations/dto/reservation-dto";
import { getReservationRepository } from "@/features/reservations/repositories/reservation-repository.factory";
import { CRITICAL_INVALIDATION_TAGS } from "@/features/shared/freshness/critical-field-registry";
import { useFocusFreshness } from "@/features/shared/freshness/use-focus-freshness";

type ReservationDataState = {
  reservations: ReservationDTO[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  isStale: boolean;
  lastRefreshAt: string | null;
};

export function useReservationData(status: ReservationStatus | "all" = "all"): ReservationDataState {
  const repository = useMemo(() => getReservationRepository(), []);
  const [reservations, setReservations] = useState<ReservationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async (options: { background?: boolean } = {}) => {
    const shouldUseBackgroundRefresh = options.background === true;
    const shouldShowInitialLoader = !shouldUseBackgroundRefresh || !hasLoadedOnceRef.current;

    if (shouldShowInitialLoader) {
      setIsLoading(true);
    }
    setError(null);
    try {
      try {
        await repository.expirePastReservations();
      } catch (expireError) {
        console.warn("Failed to expire old reservations before loading reservations.", expireError);
      }
      const data = await repository.listReservations(status);
      setReservations(data);
      hasLoadedOnceRef.current = true;
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load reservations.";
      setError(message);
    } finally {
      if (shouldShowInitialLoader) {
        setIsLoading(false);
      }
    }
  }, [repository, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const freshness = useFocusFreshness({
    tags: [CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL],
    onRefresh: () => load({ background: true }),
  });

  return {
    reservations,
    isLoading,
    isRefreshing: freshness.isRefreshing,
    error,
    reload: () => load({ background: hasLoadedOnceRef.current }),
    isStale: freshness.isStale,
    lastRefreshAt: freshness.lastRefreshAt,
  };
}
