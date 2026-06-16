'use client';

import { Loader2 } from 'lucide-react';
import type { BulkActionResult } from '@/features/admin/inventory/types';
import type { ProductStatus } from '@/features/catalog';
import { useI18n } from '@/lib/i18n';

type InventoryBulkToolbarProps = {
  statusView: ProductStatus;
  selectedCount: number;
  allVisibleSelected: boolean;
  canBulkReserve: boolean;
  canCancelReservation: boolean;
  canDiscountSelected: boolean;
  canMarkSold: boolean;
  canDelete: boolean;
  canClearArchived: boolean;
  workingKey: string | null;
  bulkResult: BulkActionResult | null;
  onToggleSelectVisible: () => void;
  onStartReserve: () => void;
  onStartCancelReservation: () => void;
  onStartDiscount: () => void;
  onStartRemoveDiscount: () => void;
  onStartSell: () => void;
  onStartDelete: () => void;
  onClearSelection: () => void;
};

export function InventoryBulkToolbar({
  statusView,
  selectedCount,
  allVisibleSelected,
  canBulkReserve,
  canCancelReservation,
  canDiscountSelected,
  canMarkSold,
  canDelete,
  canClearArchived,
  workingKey,
  bulkResult,
  onToggleSelectVisible,
  onStartReserve,
  onStartCancelReservation,
  onStartDiscount,
  onStartRemoveDiscount,
  onStartSell,
  onStartDelete,
  onClearSelection,
}: InventoryBulkToolbarProps) {
  const { t } = useI18n();
  const hasSelection = selectedCount > 0;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={onToggleSelectVisible}
            className="h-4 w-4 rounded border-slate-300 accent-cyan-600"
          />
          {t('inventory.selectVisible')}
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <span className="text-sm font-semibold text-slate-600">
            {t('inventory.selectedCount', { count: selectedCount })}
          </span>
          {canBulkReserve && (
            <button
              type="button"
              disabled={!hasSelection}
              onClick={onStartReserve}
              className="h-9 rounded-lg border border-sky-300 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
            >
              {t('common.reserve')}
            </button>
          )}
          {canCancelReservation && (
            <button
              type="button"
              disabled={!hasSelection}
              onClick={onStartCancelReservation}
              className="h-9 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              {t('inventory.cancelReservation')}
            </button>
          )}
          {(canDiscountSelected || canMarkSold || canDelete) && (
            <>
              {canDiscountSelected && (
                <>
                  <button
                    type="button"
                    disabled={!hasSelection}
                    onClick={onStartDiscount}
                    className="brand-primary h-9 rounded-lg px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {t('common.discount')}
                  </button>
                  <button
                    type="button"
                    disabled={!hasSelection}
                    onClick={onStartRemoveDiscount}
                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t('inventory.removeDiscount')}
                  </button>
                </>
              )}
              {canMarkSold && (
                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={onStartSell}
                  className="h-9 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {t('inventory.markSold')}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={onStartDelete}
                  className="h-9 rounded-lg border border-rose-300 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {t('common.delete')}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            disabled={!hasSelection || workingKey === 'clear-archived'}
            onClick={onClearSelection}
            className={`h-9 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 ${
              canClearArchived
                ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {workingKey === 'clear-archived' && <Loader2 size={14} className="mr-1 inline animate-spin" />}
            {t('common.clear')}
          </button>
        </div>
      </div>

      {bulkResult && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          <p className="font-bold">
            {t('inventory.resultSummary', {
              success: bulkResult.success.length,
              action: statusView === 'archived' ? t('inventory.resultCleared') : t('inventory.resultUpdated'),
              skipped:
                bulkResult.skipped.length > 0
                  ? t('inventory.resultSkipped', { count: bulkResult.skipped.length })
                  : '',
            })}
          </p>
          {bulkResult.skipped.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {bulkResult.skipped.slice(0, 5).map((item) => (
                <li key={item.id}>
                  {item.name ?? item.id}: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

