import type { AppliedReportDateRange } from "@/features/reports/domain/report-date-range";

export type SalesTrendPoint = {
  label: string;
  value: number;
};

export type TopModelReportItem = {
  productId: string;
  name: string;
  image: string;
  units: number;
  revenue: number;
  trend: number;
};

export type ReservationKpis = {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  expiredCount: number;
  conversionRate: number;
  cancellationRate: number;
  expiryRate: number;
};

export type PeriodComparisonMetric = {
  previousValue: number;
  changeValue: number;
  changePercent: number | null;
};

export type OperationalReportDTO = {
  dateRange: AppliedReportDateRange;
  previousDateRange: AppliedReportDateRange;
  revenue: number;
  unitsSold: number;
  avgOrderValue: number;
  reservationsCreated: number;
  comparison: {
    revenue: PeriodComparisonMetric;
    unitsSold: PeriodComparisonMetric;
    reservationsCreated: PeriodComparisonMetric;
  };
  salesSeries: SalesTrendPoint[];
  topModels: TopModelReportItem[];
  reservation: ReservationKpis;
};
