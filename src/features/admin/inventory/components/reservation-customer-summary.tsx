import type { ReservationDTO } from '@/features/reservations';
import { reservationSourceLabel, useI18n } from '@/lib/i18n';

export function ReservationCustomerSummary({ reservation }: { reservation: ReservationDTO }) {
  const { t } = useI18n();
  const contextRows = [
    [t('common.customer'), reservation.customerName || t('common.notSet')],
    [t('common.phone'), reservation.customerPhone || t('common.notSet')],
    [t('common.messenger'), reservation.messengerProfileUrl || t('common.notSet')],
    [t('common.source'), reservationSourceLabel(reservation.reservationSource, t)],
  ] satisfies Array<[string, string]>;

  return (
    <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-sky-800">
        {t('inventory.customerDetails')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {contextRows.map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-sky-700">{label}</p>
            {label === t('common.messenger') && value !== t('common.notSet') ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm font-semibold text-cyan-700 hover:underline"
              >
                {value}
              </a>
            ) : (
              <p className="break-words text-sm font-semibold text-slate-800">{value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
