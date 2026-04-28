"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReportDateRangeInput } from "@/features/reports/domain/report-date-range";
import type { OperationalReportDTO } from "@/features/reports/dto/report-dto";
import { getReportRepository } from "@/features/reports/repositories/report-repository.factory";
import { CRITICAL_INVALIDATION_TAGS } from "@/features/shared/freshness/critical-field-registry";
import { useFocusFreshness } from "@/features/shared/freshness/use-focus-freshness";

type ReportDataState = {
  report: OperationalReportDTO | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  isStale: boolean;
  lastRefreshAt: string | null;
};

export function useOperationalReportData(dateRange?: ReportDateRangeInput): ReportDataState {
  const repository = useMemo(() => getReportRepository(), []);
  const [report, setReport] = useState<OperationalReportDTO | null>(null);
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
      const data = await repository.getOperationalReport(dateRange);
      setReport(data);
      hasLoadedOnceRef.current = true;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load report.";
      setError(message);
    } finally {
      if (shouldShowInitialLoader) {
        setIsLoading(false);
      }
    }
  }, [dateRange, repository]);

  useEffect(() => {
    void load();
  }, [load]);

  const freshness = useFocusFreshness({
    tags: [CRITICAL_INVALIDATION_TAGS.REPORTS_KPI],
    onRefresh: () => load({ background: true }),
  });

  return {
    report,
    isLoading,
    isRefreshing: freshness.isRefreshing,
    error,
    reload: () => load({ background: hasLoadedOnceRef.current }),
    isStale: freshness.isStale,
    lastRefreshAt: freshness.lastRefreshAt,
  };
}
