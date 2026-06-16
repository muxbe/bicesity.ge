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

type UseReservationDataOptions = {
  enabled?: boolean;
};

export function useReservationData(
  status: ReservationStatus | "all" = "all",
  options: UseReservationDataOptions = {}
): ReservationDataState {
  const enabled = options.enabled ?? true;
  const repository = useMemo(() => getReservationRepository(), []);
  const [reservations, setReservations] = useState<ReservationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async (options: { background?: boolean } = {}) => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      return;
    }

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
  }, [enabled, repository, status]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      return;
    }
    void load();
  }, [enabled, load]);

  const freshness = useFocusFreshness({
    tags: [CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL],
    onRefresh: () => load({ background: true }),
    enabled,
  });

  return {
    reservations: enabled ? reservations : [],
    isLoading: enabled ? isLoading : false,
    isRefreshing: enabled ? freshness.isRefreshing : false,
    error: enabled ? error : null,
    reload: () =>
      enabled ? load({ background: hasLoadedOnceRef.current }) : Promise.resolve(),
    isStale: enabled ? freshness.isStale : false,
    lastRefreshAt: enabled ? freshness.lastRefreshAt : null,
  };
}
