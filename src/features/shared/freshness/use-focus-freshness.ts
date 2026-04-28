"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeInvalidation } from "@/features/shared/freshness/invalidation";
import type { CriticalInvalidationTag } from "@/features/shared/freshness/critical-field-registry";

type UseFocusFreshnessOptions = {
  tags: CriticalInvalidationTag[];
  onRefresh: () => Promise<void>;
  minIntervalMs?: number;
  enabled?: boolean;
};

type FreshnessState = {
  isRefreshing: boolean;
  isStale: boolean;
  lastRefreshAt: string | null;
  refreshNow: () => Promise<void>;
};

export function useFocusFreshness({
  tags,
  onRefresh,
  minIntervalMs = 30000,
  enabled = true,
}: UseFocusFreshnessOptions): FreshnessState {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const lastRefreshMsRef = useRef(0);
  const tagsSet = useMemo(() => new Set(tags), [tags]);

  const refreshNow = useCallback(async () => {
    if (!enabled || inFlightRef.current) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs - lastRefreshMsRef.current < minIntervalMs) {
      return;
    }

    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await onRefresh();
      const nowIso = new Date().toISOString();
      setLastRefreshAt(nowIso);
      setIsStale(false);
      lastRefreshMsRef.current = nowMs;
    } catch {
      setIsStale(true);
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [enabled, minIntervalMs, onRefresh]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const onFocus = () => {
      void refreshNow();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshNow();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, refreshNow]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return subscribeInvalidation((payload) => {
      if (!tagsSet.has(payload.tag)) {
        return;
      }
      void refreshNow();
    });
  }, [enabled, refreshNow, tagsSet]);

  return {
    isRefreshing,
    isStale,
    lastRefreshAt,
    refreshNow,
  };
}
