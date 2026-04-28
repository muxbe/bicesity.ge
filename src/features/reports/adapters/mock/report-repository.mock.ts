import { mockRuntimeStore } from "@/features/mock-runtime/store";
import {
  buildPreviousReportDateRange,
  resolveReportDateRange,
  type ReportDateRangeInput,
} from "@/features/reports/domain/report-date-range";
import type { OperationalReportDTO, SalesTrendPoint } from "@/features/reports/dto/report-dto";
import type { ReportRepository } from "@/features/reports/repositories/report-repository";

function formatBucketLabel(start: Date, endExclusive: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const inclusiveEnd = new Date(endExclusive.getTime() - 1);
  const startLabel = formatter.format(start);
  const endLabel = formatter.format(inclusiveEnd);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function isoToDate(value: string): Date {
  return new Date(value);
}

function computeSalesSeries(
  sales: Array<{ soldAt: string; salePrice: number }>,
  start: Date,
  endExclusive: Date,
  dayCount: number
): SalesTrendPoint[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const bucketCount = Math.min(dayCount, 6);
  const bucketSize = Math.max(1, Math.ceil(dayCount / bucketCount));
  const series: SalesTrendPoint[] = [];

  for (let index = 0; index < bucketCount; index += 1) {
    const bucketStart = new Date(start.getTime() + index * bucketSize * dayMs);
    const bucketEnd = new Date(
      Math.min(endExclusive.getTime(), bucketStart.getTime() + bucketSize * dayMs)
    );
    const sum = sales
      .filter((sale) => {
        const soldAt = isoToDate(sale.soldAt);
        return soldAt >= bucketStart && soldAt < bucketEnd;
      })
      .reduce((acc, sale) => acc + sale.salePrice, 0);

    series.push({
      label: formatBucketLabel(bucketStart, bucketEnd),
      value: Math.round(sum),
    });
  }

  return series;
}

function comparisonMetric(currentValue: number, previousValue: number) {
  const changeValue = currentValue - previousValue;
  if (previousValue === 0) {
    return {
      previousValue,
      changeValue,
      changePercent: currentValue === 0 ? 0 : null,
    };
  }

  return {
    previousValue,
    changeValue,
    changePercent: Math.round((changeValue / previousValue) * 100),
  };
}

export function createMockReportRepository(): ReportRepository {
  return {
    async getOperationalReport(dateRange?: ReportDateRangeInput, nowIso?: string) {
      const now = nowIso ? new Date(nowIso) : new Date();
      const resolvedRange = resolveReportDateRange(dateRange, now);
      const previousRange = buildPreviousReportDateRange(resolvedRange, now);
      const start = isoToDate(resolvedRange.startIso);
      const endExclusive = isoToDate(resolvedRange.endIsoExclusive);
      const previousStart = isoToDate(previousRange.startIso);
      const sales = mockRuntimeStore.sales.filter((sale) => {
        const soldAt = isoToDate(sale.soldAt);
        return soldAt >= start && soldAt < endExclusive;
      });
      const previousSales = mockRuntimeStore.sales.filter((sale) => {
        const soldAt = isoToDate(sale.soldAt);
        return soldAt >= previousStart && soldAt < start;
      });
      const reservations = mockRuntimeStore.reservations.filter((reservation) => {
        const reservedAt = isoToDate(reservation.reservedForAt);
        return reservedAt >= start && reservedAt < endExclusive;
      });
      const previousReservations = mockRuntimeStore.reservations.filter((reservation) => {
        const reservedAt = isoToDate(reservation.reservedForAt);
        return reservedAt >= previousStart && reservedAt < start;
      });

      const revenue = sales.reduce((sum, sale) => sum + sale.salePrice, 0);
      const unitsSold = sales.length;
      const avgOrderValue = unitsSold > 0 ? Math.round(revenue / unitsSold) : 0;
      const previousRevenue = previousSales.reduce((sum, sale) => sum + sale.salePrice, 0);
      const previousUnitsSold = previousSales.length;
      const previousReservationsCreated = previousReservations.length;
      const salesSeries = computeSalesSeries(
        sales,
        start,
        endExclusive,
        resolvedRange.dayCount
      );
      const maxSeries = Math.max(...salesSeries.map((point) => point.value), 1);

      const unitCounts = new Map<string, { units: number; revenue: number }>();
      for (const sale of sales) {
        const current = unitCounts.get(sale.productId) ?? { units: 0, revenue: 0 };
        current.units += 1;
        current.revenue += sale.salePrice;
        unitCounts.set(sale.productId, current);
      }

      const topModels = Array.from(unitCounts.entries())
        .map(([productId, metrics]) => {
          const product = mockRuntimeStore.products.find((item) => item.id === productId);
          if (!product) {
            return null;
          }
          return {
            productId,
            name: product.name,
            image: product.image,
            units: metrics.units,
            revenue: Math.round(metrics.revenue),
            trend: Math.min(
              100,
              Math.max(20, Math.round((metrics.revenue / maxSeries) * 100))
            ),
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
        .slice(0, 4);

      const totalReservations = reservations.length;
      const activeCount = reservations.filter((item) => item.status === "active").length;
      const completedCount = reservations.filter((item) => item.status === "completed").length;
      const cancelledCount = reservations.filter((item) => item.status === "cancelled").length;
      const expiredCount = reservations.filter((item) => item.status === "expired").length;

      const conversionRate =
        totalReservations > 0 ? Math.round((completedCount / totalReservations) * 100) : 0;
      const cancellationRate =
        totalReservations > 0 ? Math.round((cancelledCount / totalReservations) * 100) : 0;
      const expiryRate =
        totalReservations > 0 ? Math.round((expiredCount / totalReservations) * 100) : 0;

      return {
        dateRange: resolvedRange,
        previousDateRange: previousRange,
        revenue: Math.round(revenue),
        unitsSold,
        avgOrderValue,
        reservationsCreated: totalReservations,
        comparison: {
          revenue: comparisonMetric(Math.round(revenue), Math.round(previousRevenue)),
          unitsSold: comparisonMetric(unitsSold, previousUnitsSold),
          reservationsCreated: comparisonMetric(totalReservations, previousReservationsCreated),
        },
        salesSeries,
        topModels,
        reservation: {
          totalCount: totalReservations,
          activeCount,
          completedCount,
          cancelledCount,
          expiredCount,
          conversionRate,
          cancellationRate,
          expiryRate,
        },
      };
    },
  };
}
