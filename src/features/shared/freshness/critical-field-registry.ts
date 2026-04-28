export const CRITICAL_INVALIDATION_TAGS = {
  CATALOG_CRITICAL: "catalog:critical",
  RESERVATIONS_CRITICAL: "reservations:critical",
  REPORTS_KPI: "reports:kpi",
} as const;

export type CriticalInvalidationTag =
  (typeof CRITICAL_INVALIDATION_TAGS)[keyof typeof CRITICAL_INVALIDATION_TAGS];

