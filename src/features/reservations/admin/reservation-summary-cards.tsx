'use client';

import { CalendarClock, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import type { ReservationCounts } from '@/features/reservations/admin/use-admin-reservations-controller';
import { useI18n } from '@/lib/i18n';

type ReservationSummaryCardsProps = {
  counts: ReservationCounts;
};

export function ReservationSummaryCards({ counts }: ReservationSummaryCardsProps) {
  const { t } = useI18n();
  const cards = [
    {
      key: 'active',
      label: t('reservation.statusActive'),
      value: counts.active,
      icon: CalendarClock,
      className: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    },
    {
      key: 'completed',
      label: t('reservation.statusCompleted'),
      value: counts.completed,
      icon: CheckCircle2,
      className: 'border-cyan-100 bg-cyan-50 text-cyan-800',
    },
    {
      key: 'cancelled',
      label: t('reservation.statusCancelled'),
      value: counts.cancelled,
      icon: XCircle,
      className: 'border-rose-100 bg-rose-50 text-rose-800',
    },
    {
      key: 'expired',
      label: t('reservation.statusExpired'),
      value: counts.expired,
      icon: Clock3,
      className: 'border-amber-100 bg-amber-50 text-amber-800',
    },
  ] as const;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.key} className={`rounded-2xl border p-4 ${card.className}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-widest">{card.label}</p>
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-3 text-3xl font-black">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
