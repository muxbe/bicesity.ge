import type { ProductDTO } from '@/features/catalog';
import { statusLabel, useI18n } from '@/lib/i18n';

export function StatusBadge({ status }: { status: ProductDTO['status'] }) {
  const { t } = useI18n();
  const classes =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'reserved'
      ? 'bg-sky-100 text-sky-700'
      : status === 'sold'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-200 text-slate-700';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${classes}`}>
      {statusLabel(status, t)}
    </span>
  );
}
