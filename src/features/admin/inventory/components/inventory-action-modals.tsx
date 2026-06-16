'use client';

import type { Dispatch, FormEvent, KeyboardEvent, SetStateAction } from 'react';
import { X } from 'lucide-react';
import { EMPTY_RESERVATION_CONTEXT, RESERVATION_SOURCE_OPTIONS } from '@/features/admin/inventory/constants';
import { ProductForm } from '@/features/admin/inventory/components/product-form';
import type { BulkMode, ProductFormDraft, ReservationContextDraft, SellChannel } from '@/features/admin/inventory/types';
import type { AttributeDTO } from '@/features/catalog';
import type { ReservationSource } from '@/features/reservations';
import { reservationSourceLabel, useI18n } from '@/lib/i18n';

type InventoryActionModalsProps = {
  createOpen: boolean;
  createDraft: ProductFormDraft;
  editProductId: string | null;
  editDraft: ProductFormDraft;
  reserveProductId: string | null;
  reserveAtLocal: string;
  reserveNote: string;
  reservationContext: ReservationContextDraft;
  sellProductId: string | null;
  sellPrice: string;
  sellChannel: SellChannel;
  sellNote: string;
  bulkMode: BulkMode | null;
  bulkDiscountInput: string;
  bulkDiscountReason: string;
  selectedCount: number;
  attributes: AttributeDTO[];
  workingKey: string | null;
  actionError: string | null;
  actionErrorKey: string | null;
  canUploadToStorage: boolean;
  onCreateDraftChange: Dispatch<SetStateAction<ProductFormDraft>>;
  onEditDraftChange: Dispatch<SetStateAction<ProductFormDraft>>;
  onReserveAtLocalChange: (value: string) => void;
  onReserveNoteChange: (value: string) => void;
  onReservationContextChange: Dispatch<SetStateAction<ReservationContextDraft>>;
  onSellPriceChange: (value: string) => void;
  onSellChannelChange: (value: SellChannel) => void;
  onSellNoteChange: (value: string) => void;
  onBulkDiscountInputChange: (value: string) => void;
  onBulkDiscountReasonChange: (value: string) => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCloseReserve: () => void;
  onCloseSell: () => void;
  onCloseBulk: () => void;
  onSubmitCreate: (event: FormEvent) => void | Promise<void>;
  onSubmitEdit: (event: FormEvent) => void | Promise<void>;
  onSubmitReserve: (event: FormEvent) => void | Promise<void>;
  onSubmitSell: (event: FormEvent) => void | Promise<void>;
  onSubmitBulkAction: (event: FormEvent) => void | Promise<void>;
  onPreventImplicitReservationSubmit: (event: KeyboardEvent<HTMLFormElement>) => void;
  onImageFileSelected: (target: 'create' | 'edit', file: File) => void | Promise<void>;
};

export function InventoryActionModals({
  createOpen,
  createDraft,
  editProductId,
  editDraft,
  reserveProductId,
  reserveAtLocal,
  reserveNote,
  reservationContext,
  sellProductId,
  sellPrice,
  sellChannel,
  sellNote,
  bulkMode,
  bulkDiscountInput,
  bulkDiscountReason,
  selectedCount,
  attributes,
  workingKey,
  actionError,
  actionErrorKey,
  canUploadToStorage,
  onCreateDraftChange,
  onEditDraftChange,
  onReserveAtLocalChange,
  onReserveNoteChange,
  onReservationContextChange,
  onSellPriceChange,
  onSellChannelChange,
  onSellNoteChange,
  onBulkDiscountInputChange,
  onBulkDiscountReasonChange,
  onCloseCreate,
  onCloseEdit,
  onCloseReserve,
  onCloseSell,
  onCloseBulk,
  onSubmitCreate,
  onSubmitEdit,
  onSubmitReserve,
  onSubmitSell,
  onSubmitBulkAction,
  onPreventImplicitReservationSubmit,
  onImageFileSelected,
}: InventoryActionModalsProps) {
  const { t } = useI18n();

  if (!createOpen && !editProductId && !reserveProductId && !sellProductId && !bulkMode) {
    return null;
  }

  const renderReservationContextFields = (scope: 'single' | 'bulk') => (
    <div className="brand-filter-panel space-y-3 rounded-2xl border p-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        {scope === 'bulk' ? t('inventory.customerContextSelected') : t('inventory.customerContext')}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={reservationContext.customerName}
          onChange={(event) =>
            onReservationContextChange((current) => ({ ...current, customerName: event.target.value }))
          }
          className="brand-control h-11 rounded-xl border px-3 text-sm"
          placeholder={t('inventory.customerName')}
        />
        <input
          value={reservationContext.customerPhone}
          onChange={(event) =>
            onReservationContextChange((current) => ({ ...current, customerPhone: event.target.value }))
          }
          className="brand-control h-11 rounded-xl border px-3 text-sm"
          placeholder={t('inventory.customerPhone')}
        />
      </div>
      <input
        type="url"
        value={reservationContext.messengerProfileUrl}
        onChange={(event) =>
          onReservationContextChange((current) => ({ ...current, messengerProfileUrl: event.target.value }))
        }
        className="brand-control h-11 w-full rounded-xl border px-3 text-sm"
        placeholder={t('inventory.messengerLink')}
      />
      <select
        value={reservationContext.reservationSource}
        onChange={(event) =>
          onReservationContextChange((current) => ({
            ...current,
            reservationSource: event.target.value as ReservationSource,
          }))
        }
        className="brand-control h-11 w-full rounded-xl border px-3 text-sm"
      >
        {RESERVATION_SOURCE_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {reservationSourceLabel(value, t)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex min-h-full items-start justify-center py-3 sm:py-10">
        <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:rounded-3xl sm:p-6">
          {createOpen && (
            <ProductForm
              title={t('inventory.createProduct')}
              draft={createDraft}
              attributes={attributes}
              onChange={onCreateDraftChange}
              onSubmit={onSubmitCreate}
              onClose={onCloseCreate}
              canChangeCategory
              isSaving={workingKey === 'create'}
              canUploadImage={canUploadToStorage}
              isUploadingImage={workingKey === 'upload:create'}
              onImageFileSelected={(file) => onImageFileSelected('create', file)}
            />
          )}

          {editProductId && (
            <ProductForm
              title={t('inventory.editProduct')}
              draft={editDraft}
              attributes={attributes}
              onChange={onEditDraftChange}
              onSubmit={onSubmitEdit}
              onClose={onCloseEdit}
              canChangeCategory={false}
              isSaving={workingKey === `edit:${editProductId}`}
              canUploadImage={canUploadToStorage}
              isUploadingImage={workingKey === 'upload:edit'}
              onImageFileSelected={(file) => onImageFileSelected('edit', file)}
            />
          )}

          {reserveProductId && (
            <form onSubmit={onSubmitReserve} onKeyDown={onPreventImplicitReservationSubmit} className="flex min-h-[min(34rem,calc(100vh-1.5rem))] flex-col">
              <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-2 flex justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6">
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">{t('inventory.reserveProduct')}</h2>
                <button type="button" onClick={onCloseReserve} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={t('inventory.closeForm')}>
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4 py-3">
                {actionErrorKey === `reserve:${reserveProductId}` && actionError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {actionError}
                  </div>
                )}
                <input type="datetime-local" value={reserveAtLocal} onChange={(event) => onReserveAtLocalChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
                {renderReservationContextFields('single')}
                <textarea value={reserveNote} onChange={(event) => onReserveNoteChange(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('inventory.sellerComment')} />
              </div>
              <div className="reservation-modal-footer sticky -bottom-4 z-10 -mx-4 -mb-4 mt-auto grid grid-cols-1 gap-3 border-t border-slate-100 bg-white px-4 py-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:grid-cols-2 sm:px-6">
                <button type="button" onClick={onCloseReserve} aria-label={t('common.cancel')} className="brand-control h-11 rounded-xl border text-sm font-semibold text-slate-700 hover:bg-cyan-50">
                  {t('common.cancel')}
                </button>
                <button type="submit" aria-label={t('inventory.saveReservation')} disabled={workingKey === `reserve:${reserveProductId}`} className="brand-primary h-11 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {workingKey === `reserve:${reserveProductId}` ? t('common.saving') : t('inventory.saveReservation')}
                </button>
              </div>
            </form>
          )}

          {sellProductId && (
            <form onSubmit={onSubmitSell} className="space-y-4">
              <div className="flex justify-between gap-3">
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">{t('inventory.markAsSold')}</h2>
                <button type="button" onClick={onCloseSell}>
                  <X size={18} />
                </button>
              </div>
              <input type="number" min="0" step="0.01" value={sellPrice} onChange={(event) => onSellPriceChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('inventory.soldPrice')} />
              <select value={sellChannel} onChange={(event) => onSellChannelChange(event.target.value as SellChannel)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm">
                <option value="in_store">{t('sale.inStore')}</option>
                <option value="online">{t('sale.online')}</option>
                <option value="as_is">{t('sale.asIs')}</option>
              </select>
              <textarea value={sellNote} onChange={(event) => onSellNoteChange(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('inventory.auditNote')} />
              <button type="submit" disabled={workingKey === `sell:${sellProductId}`} className="h-11 w-full rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50">
                {workingKey === `sell:${sellProductId}` ? t('common.saving') : t('inventory.confirmSale')}
              </button>
            </form>
          )}

          {bulkMode && (
            <form onSubmit={onSubmitBulkAction} className="space-y-4">
              <div className="flex justify-between gap-3">
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                  {bulkMode === 'discount'
                    ? t('inventory.discountSelectedItems')
                    : bulkMode === 'remove-discount'
                    ? t('inventory.removeDiscounts')
                    : bulkMode === 'reserve'
                    ? t('inventory.reserveSelectedItems')
                    : bulkMode === 'cancel-reservation'
                    ? t('inventory.cancelSelectedReservations')
                    : bulkMode === 'sell'
                    ? t('inventory.markSelectedSold')
                    : t('inventory.deleteSelectedItems')}
                </h2>
                <button type="button" onClick={onCloseBulk}>
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-600">
                {t('inventory.selectedItemsNote', {
                  count: selectedCount,
                  plural: selectedCount === 1 ? '' : 's',
                })}
              </p>
              {bulkMode === 'discount' && (
                <>
                  <input
                    value={bulkDiscountInput}
                    onChange={(event) => onBulkDiscountInputChange(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                    placeholder={t('inventory.discountPlaceholder')}
                  />
                  <textarea
                    value={bulkDiscountReason}
                    onChange={(event) => onBulkDiscountReasonChange(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder={t('inventory.reasonOptional')}
                  />
                </>
              )}
              {bulkMode === 'remove-discount' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {t('inventory.clearDiscountNotice')}
                </div>
              )}
              {bulkMode === 'reserve' && (
                <>
                  <input type="datetime-local" value={reserveAtLocal} onChange={(event) => onReserveAtLocalChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
                  {renderReservationContextFields('bulk')}
                  <textarea value={reserveNote} onChange={(event) => onReserveNoteChange(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('inventory.sellerComment')} />
                </>
              )}
              {bulkMode === 'cancel-reservation' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {t('inventory.reservedBackNotice')}
                </div>
              )}
              {bulkMode === 'sell' && (
                <>
                  <select value={sellChannel} onChange={(event) => onSellChannelChange(event.target.value as SellChannel)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm">
                    <option value="in_store">{t('sale.inStore')}</option>
                    <option value="online">{t('sale.online')}</option>
                    <option value="as_is">{t('sale.asIs')}</option>
                  </select>
                  <textarea value={sellNote} onChange={(event) => onSellNoteChange(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('inventory.auditNote')} />
                </>
              )}
              {bulkMode === 'delete' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {t('inventory.deleteNotice')}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:flex">
                <button
                  type="submit"
                  disabled={workingKey === `bulk:${bulkMode}`}
                  className="brand-primary h-11 flex-1 rounded-xl font-semibold disabled:opacity-50"
                >
                  {workingKey === `bulk:${bulkMode}`
                    ? t('common.saving')
                    : bulkMode === 'discount'
                    ? t('inventory.applyDiscount')
                    : bulkMode === 'remove-discount'
                    ? t('inventory.removeDiscount')
                    : bulkMode === 'reserve'
                    ? t('inventory.reserveItems')
                    : bulkMode === 'cancel-reservation'
                    ? t('inventory.cancelReservations')
                    : bulkMode === 'sell'
                    ? t('inventory.markSold')
                    : t('inventory.deleteItems')}
                </button>
                <button
                  type="button"
                  onClick={onCloseBulk}
                  className="h-11 flex-1 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
