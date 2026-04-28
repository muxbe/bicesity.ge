'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, RefreshCw } from 'lucide-react';
import { buildDefaultReportDateRange } from '@/features/reports/domain/report-date-range';
import { useOperationalReportData } from '@/features/reports';
import { useI18n } from '@/lib/i18n';

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

function formatDelta(value: number, isCurrency = false) {
  if (isCurrency) {
    const absolute = formatCurrency(Math.abs(value));
    if (value > 0) {
      return `+${absolute}`;
    }
    if (value < 0) {
      return `-${absolute}`;
    }
    return absolute;
  }
  return formatSignedNumber(value);
}

function comparisonLabel(
  metric: { changeValue: number; changePercent: number | null; previousValue: number },
  previousLabel: string,
  t: (key: string, params?: Record<string, string | number>) => string,
  isCurrency = false
) {
  const delta = formatDelta(metric.changeValue, isCurrency);
  if (metric.changePercent === null) {
    if (metric.previousValue === 0 && metric.changeValue === 0) {
      return t('reports.noChangeVs', { label: previousLabel });
    }
    return t('reports.deltaVs', { delta, label: previousLabel });
  }
  return t('reports.deltaPercentVs', {
    delta,
    percent: `${metric.changePercent > 0 ? '+' : ''}${metric.changePercent}`,
    label: previousLabel,
  });
}

export default function SalesReportsPage() {
  const { t } = useI18n();
  const [draftRange, setDraftRange] = useState(() => buildDefaultReportDateRange());
  const [appliedRange, setAppliedRange] = useState(() => buildDefaultReportDateRange());
  const [rangeError, setRangeError] = useState<string | null>(null);
  const { report, isLoading, isRefreshing, error, isStale, lastRefreshAt, reload } =
    useOperationalReportData(appliedRange);
  const salesSeries = report?.salesSeries ?? [];
  const maxSalesPoint = Math.max(...salesSeries.map((sale) => sale.value), 1);
  const topModels = report?.topModels ?? [];
  const previousLabel = report?.previousDateRange.label ?? t('reports.previousPeriod');

  const applyRange = () => {
    if (!draftRange.startDate || !draftRange.endDate) {
      setRangeError(t('reports.chooseDates'));
      return;
    }
    if (draftRange.endDate < draftRange.startDate) {
      setRangeError(t('reports.endAfterStart'));
      return;
    }

    setRangeError(null);
    setAppliedRange({ ...draftRange });
  };

  const resetRange = () => {
    const nextRange = buildDefaultReportDateRange();
    setRangeError(null);
    setDraftRange(nextRange);
    setAppliedRange(nextRange);
  };

  return (
    <div className="w-full max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
          {t('reports.eyebrow')}
        </p>
        <h1 className="mb-2 text-3xl font-black text-slate-900 sm:text-4xl">{t('reports.title')}</h1>
        <p className="text-slate-600">
          {t('reports.description')}
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,1fr,auto,auto]">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
                {t('reports.startDate')}
              </span>
              <input
                type="date"
                value={draftRange.startDate}
                onChange={(event) =>
                  setDraftRange((current) => ({ ...current, startDate: event.target.value }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-sky-600"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">
                {t('reports.endDate')}
              </span>
              <input
                type="date"
                value={draftRange.endDate}
                onChange={(event) =>
                  setDraftRange((current) => ({ ...current, endDate: event.target.value }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-sky-600"
              />
            </label>

            <button
              type="button"
              onClick={applyRange}
              className="h-11 self-end rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-black"
            >
              {t('reports.apply')}
            </button>

            <button
              type="button"
              onClick={resetRange}
              className="h-11 self-end rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {t('reports.last30Days')}
            </button>
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-700">
            {t('reports.showing', { range: report?.dateRange.label ?? `${appliedRange.startDate} - ${appliedRange.endDate}` })}
          </p>
          {rangeError && <p className="mt-2 text-sm text-rose-600">{rangeError}</p>}
        </div>

        {isLoading && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('reports.loading')}
          </p>
        )}
        {isRefreshing && (
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('reports.refreshing')}
          </p>
        )}
        {lastRefreshAt && (
          <p className="mt-2 text-xs text-slate-500">
            {t('reports.lastRefresh', { value: new Date(lastRefreshAt).toLocaleString() })}
          </p>
        )}
        {isStale && (
          <div className="mt-2 flex items-center gap-3">
            <p className="text-xs text-amber-700">{t('reports.stale')}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              <RefreshCw className="h-3 w-3" />
              {t('reports.retry')}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('reports.revenue')}</p>
          <p className="mt-2 text-2xl font-black">{formatCurrency(report?.revenue ?? 0)}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {report
              ? comparisonLabel(report.comparison.revenue, previousLabel, t, true)
              : t('reports.selectedPeriod')}
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('reports.unitsSold')}</p>
          <p className="mt-2 text-2xl font-black">{report?.unitsSold ?? 0}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {report
              ? comparisonLabel(report.comparison.unitsSold, previousLabel, t)
              : t('reports.completedSales')}
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('reports.avgOrderValue')}</p>
          <p className="mt-2 text-2xl font-black">{formatCurrency(report?.avgOrderValue ?? 0)}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{t('reports.selectedAverage')}</p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('reports.reservationsStarted')}</p>
          <p className="mt-2 text-2xl font-black">{report?.reservationsCreated ?? 0}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {report
              ? comparisonLabel(report.comparison.reservationsCreated, previousLabel, t)
              : t('reports.reservedRange')}
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('reports.activeReservations')}</p>
          <p className="mt-2 text-2xl font-black">{report?.reservation.activeCount ?? 0}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{t('reports.stillActive')}</p>
        </article>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">{t('reports.revenueOverTime')}</h2>
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {salesSeries.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                <p className="mt-1 text-sm font-black text-slate-900">
                  {formatCurrency(item.value)}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                    style={{ width: `${(item.value / maxSalesPoint) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {salesSeries.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-3 xl:col-span-6">
                {t('reports.noRevenue')}
              </div>
            )}
          </div>

          <h2 className="mb-3 text-lg font-black text-slate-900">{t('reports.topModels')}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-widest text-slate-500">
                  <th className="py-3 pr-3">{t('reports.model')}</th>
                  <th className="py-3 pr-3">{t('reports.units')}</th>
                  <th className="py-3 pr-3">{t('reports.revenue')}</th>
                  <th className="py-3">{t('reports.trend')}</th>
                </tr>
              </thead>
              <tbody>
                {topModels.map((row) => (
                  <tr key={row.productId} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          <Image src={row.image} alt={row.name} fill sizes="40px" className="object-cover" />
                        </div>
                        <span className="font-semibold text-slate-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3">{row.units}</td>
                    <td className="py-3 pr-3">{formatCurrency(row.revenue)}</td>
                    <td className="py-3">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                          style={{ width: `${row.trend}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {topModels.length === 0 && (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={4}>
                      {t('reports.noSales')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-lg font-black text-slate-900">{t('reports.outcomes')}</h2>
          <p className="mb-4 text-sm text-slate-500">
            {t('reports.outcomesDescription')}
          </p>
          <ul className="space-y-3 text-sm">
            <li className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">{t('reports.started')}</p>
              <p className="text-slate-700">{report?.reservation.totalCount ?? 0} {t('reports.reservations')}</p>
            </li>
            <li className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="font-semibold text-emerald-800">{t('common.active')}</p>
              <p className="text-emerald-700">{report?.reservation.activeCount ?? 0} {t('reports.activeLower')}</p>
            </li>
            <li className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
              <p className="font-semibold text-sky-800">{t('reports.completed')}</p>
              <p className="text-sky-700">
                {report?.reservation.completedCount ?? 0} {t('reports.completedLower')} ({report?.reservation.conversionRate ?? 0}%)
              </p>
            </li>
            <li className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="font-semibold text-amber-800">{t('reports.cancelled')}</p>
              <p className="text-amber-700">
                {report?.reservation.cancelledCount ?? 0} {t('reports.cancelledLower')} ({report?.reservation.cancellationRate ?? 0}%)
              </p>
            </li>
            <li className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <p className="font-semibold text-rose-800">{t('reports.expired')}</p>
              <p className="text-rose-700">
                {report?.reservation.expiredCount ?? 0} {t('reports.expiredLower')} ({report?.reservation.expiryRate ?? 0}%)
              </p>
            </li>
          </ul>
        </article>
      </section>
    </div>
  );
}
