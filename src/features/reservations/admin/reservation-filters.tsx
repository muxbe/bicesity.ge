'use client';

import { CalendarDays, Search } from 'lucide-react';
import type {
  ReservationDateFilter,
  ReservationStatusFilter,
} from '@/features/reservations/admin/use-admin-reservations-controller';
import { useI18n } from '@/lib/i18n';

type ReservationFiltersProps = {
  statusFilter: ReservationStatusFilter;
  onStatusFilterChange: (status: ReservationStatusFilter) => void;
  dateFilter: ReservationDateFilter;
  onDateFilterChange: (dateFilter: ReservationDateFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
};

const STATUS_FILTERS = ['all', 'active', 'completed', 'cancelled', 'expired'] as const;
const DATE_FILTERS = ['all', 'today', 'upcoming', 'past'] as const;

function statusLabel(status: ReservationStatusFilter, t: ReturnType<typeof useI18n>['t']) {
  if (status === 'all') {
    return t('common.all');
  }
  if (status === 'active') {
    return t('reservation.statusActive');
  }
  if (status === 'completed') {
    return t('reservation.statusCompleted');
  }
  if (status === 'cancelled') {
    return t('reservation.statusCancelled');
  }
  return t('reservation.statusExpired');
}

function dateLabel(dateFilter: ReservationDateFilter, t: ReturnType<typeof useI18n>['t']) {
  if (dateFilter === 'all') {
    return t('reservations.dateAll');
  }
  if (dateFilter === 'today') {
    return t('reservations.dateToday');
  }
  if (dateFilter === 'upcoming') {
    return t('reservations.dateUpcoming');
  }
  return t('reservations.datePast');
}

export function ReservationFilters({
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  query,
  onQueryChange,
}: ReservationFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="mb-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatusFilterChange(status)}
            className={`h-10 rounded-xl px-4 text-sm font-bold transition ${
              statusFilter === status
                ? 'bg-[var(--brand-navy)] text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-cyan-50'
            }`}
          >
            {statusLabel(status, t)}
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('reservations.searchPlaceholder')}
            className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        <label className="relative">
          <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={dateFilter}
            onChange={(event) => onDateFilterChange(event.target.value as ReservationDateFilter)}
            className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
          >
            {DATE_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {dateLabel(filter, t)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
