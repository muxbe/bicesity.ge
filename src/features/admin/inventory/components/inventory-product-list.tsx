'use client';

import Link from 'next/link';
import { CalendarClock, DollarSign, Eye, Loader2, Pencil, RefreshCw, ShoppingCart, Trash2, X } from 'lucide-react';
import { PriceDisplay } from '@/features/catalog/components/price-display';
import type { AttributeDTO, ProductDTO, ProductStatus } from '@/features/catalog';
import { ReservationCommentEditor } from '@/features/reservations/components/reservation-comment-editor';
import type { ReservationDTO } from '@/features/reservations';
import { ProductImage } from '@/features/admin/inventory/components/product-image';
import { ReservationCustomerSummary } from '@/features/admin/inventory/components/reservation-customer-summary';
import { StatusBadge } from '@/features/admin/inventory/components/status-badge';
import { categoryLabel, driveTypeLabel, fieldNameLabel, useI18n } from '@/lib/i18n';

type CriticalDraft = { price: string; stock: string };

type InventoryProductListProps = {
  products: ProductDTO[];
  attributes: AttributeDTO[];
  statusView: ProductStatus;
  isLoading: boolean;
  selectedProductIds: string[];
  criticalDrafts: Record<string, CriticalDraft>;
  workingKey: string | null;
  actionError: string | null;
  actionErrorKey: string | null;
  activeReservationByProductId: Map<string, ReservationDTO>;
  areReservationCommentsLoading: boolean;
  reservationCommentError: string | null;
  canManageCatalog: boolean;
  canReserve: boolean;
  canCancelReservation: boolean;
  canMarkSold: boolean;
  canDelete: boolean;
  canRestore: boolean;
  onToggleProductSelection: (productId: string) => void;
  onCriticalDraftChange: (productId: string, patch: Partial<CriticalDraft>, fallback: CriticalDraft) => void;
  onSaveCriticalFields: (product: ProductDTO) => void | Promise<void>;
  onOpenEdit: (product: ProductDTO) => void | Promise<void>;
  onOpenReserve: (product: ProductDTO) => void;
  onCancelReservation: (product: ProductDTO) => void | Promise<void>;
  onOpenSell: (product: ProductDTO) => void;
  onArchiveProduct: (product: ProductDTO) => void | Promise<void>;
  onRestoreProduct: (product: ProductDTO) => void | Promise<void>;
  onReloadReservationComments: () => void | Promise<void>;
};

export function InventoryProductList({
  products,
  attributes,
  statusView,
  isLoading,
  selectedProductIds,
  criticalDrafts,
  workingKey,
  actionError,
  actionErrorKey,
  activeReservationByProductId,
  areReservationCommentsLoading,
  reservationCommentError,
  canManageCatalog,
  canReserve,
  canCancelReservation,
  canMarkSold,
  canDelete,
  canRestore,
  onToggleProductSelection,
  onCriticalDraftChange,
  onSaveCriticalFields,
  onOpenEdit,
  onOpenReserve,
  onCancelReservation,
  onOpenSell,
  onArchiveProduct,
  onRestoreProduct,
  onReloadReservationComments,
}: InventoryProductListProps) {
  const { locale, t } = useI18n();

  if (isLoading && products.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 text-slate-600">
          {t('inventory.loadingInventory')}
        </div>
      </div>
    );
  }

  if (!isLoading && products.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 text-slate-600">
          {t('inventory.noProducts')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {products.map((product) => {
        const fallback = { price: String(product.price), stock: String(product.stockCount) };
        const critical = criticalDrafts[product.id] ?? fallback;
        const isBusy = workingKey?.includes(product.id) ?? false;
        const reservationForProduct = activeReservationByProductId.get(product.id);
        const staffFieldValues = attributes
          .filter(
            (attribute) =>
              attribute.category === product.category &&
              Boolean(product.values[attribute.id])
          )
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .slice(0, 8);

        return (
          <article key={product.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 p-3 sm:grid-cols-[auto_80px_minmax(0,1fr)] sm:gap-x-5 sm:p-4">
              <label className="col-span-2 flex items-start gap-2 text-sm font-semibold text-slate-600 sm:col-span-1 sm:pt-2">
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(product.id)}
                  onChange={() => onToggleProductSelection(product.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 accent-cyan-600"
                  aria-label={`Select ${product.name}`}
                />
                <span className="sr-only">Select {product.name}</span>
              </label>

              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:h-20 sm:w-20">
                <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-100">
                  <ProductImage src={product.image} alt={product.name} category={product.category} className="object-cover" />
                </div>
              </div>

              <div className="min-w-0 self-start sm:pt-1">
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <h2 className="line-clamp-2 break-words text-base font-black text-slate-900 sm:text-lg">{product.name}</h2>
                  <StatusBadge status={product.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {categoryLabel(product.category, t)}
                  </span>
                  <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                    {product.type ? driveTypeLabel(product.type, t) : t('inventory.part')}
                  </span>
                </div>

              <p className="text-sm text-slate-500">{t('common.serial')}: {product.serial}</p>
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">{product.description}</p>
              <div className="mt-2">
                <PriceDisplay product={product} size="compact" />
              </div>

              {staffFieldValues.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {staffFieldValues.map((attribute) => (
                    <span
                      key={attribute.id}
                      className={`max-w-full break-words rounded-full px-2.5 py-1 text-xs font-semibold ${
                        attribute.isPublic
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {fieldNameLabel(attribute, locale)}: {product.values[attribute.id]}
                      {!attribute.isPublic && <span className="ml-1 font-black">({t('inventory.internal')})</span>}
                    </span>
                  ))}
                </div>
              )}

              {statusView === 'reserved' && reservationForProduct && (
                <>
                  <ReservationCustomerSummary reservation={reservationForProduct} />
                  <ReservationCommentEditor
                    reservationId={reservationForProduct.id}
                    initialComment={reservationForProduct.sellerComment}
                    onSaved={onReloadReservationComments}
                  />
                </>
              )}

              {statusView === 'reserved' && !reservationForProduct && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-800">{t('inventory.sellerComment')}</p>
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    {areReservationCommentsLoading
                      ? t('inventory.loadingReservationComment')
                      : reservationCommentError
                      ? t('inventory.reservationCommentCouldNotLoad')
                      : t('inventory.noReservationRecord')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void onReloadReservationComments()}
                    className="mt-3 h-8 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800 hover:bg-amber-100"
                  >
                    {t('inventory.loadComment')}
                  </button>
                </div>
              )}

              {canManageCatalog && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
                  <label className="text-xs text-slate-500">{t('common.price')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={critical.price}
                    onChange={(event) => onCriticalDraftChange(product.id, { price: event.target.value }, fallback)}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm sm:w-28"
                  />
                  <label className="text-xs text-slate-500">{t('common.stock')}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={critical.stock}
                    onChange={(event) => onCriticalDraftChange(product.id, { stock: event.target.value }, fallback)}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm sm:w-20"
                  />
                  <button
                    type="button"
                    onClick={() => void onSaveCriticalFields(product)}
                    disabled={isBusy}
                    className="col-span-2 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:col-span-1"
                  >
                    {workingKey === `critical:${product.id}` ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
                    {t('common.save')}
                  </button>
                </div>
              )}
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-3 sm:px-4">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <Link href={`/shop/${product.id}`} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Eye size={14} />
                {t('common.details')}
              </Link>
              {canManageCatalog && (
                <button type="button" onClick={() => void onOpenEdit(product)} disabled={isBusy} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  <Pencil size={14} />
                  {t('common.edit')}
                </button>
              )}
              {canReserve && (
                <button type="button" onClick={() => onOpenReserve(product)} disabled={isBusy || product.status !== 'active' || product.stockCount <= 0} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-300 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50">
                  <CalendarClock size={14} />
                  {t('common.reserve')}
                </button>
              )}
              {canCancelReservation && (
                <button type="button" onClick={() => void onCancelReservation(product)} disabled={isBusy || product.status !== 'reserved'} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                  {workingKey === `cancel-reservation:${product.id}` ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  {t('inventory.cancelReservation')}
                </button>
              )}
              {canMarkSold && (
                <button type="button" onClick={() => onOpenSell(product)} disabled={isBusy || product.status === 'archived' || product.status === 'sold' || product.stockCount <= 0} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                  <ShoppingCart size={14} />
                  {t('common.sell')}
                </button>
              )}
              {canDelete && (
                <button type="button" onClick={() => void onArchiveProduct(product)} disabled={isBusy || product.status === 'archived'} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-300 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                  {workingKey === `archive:${product.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {t('common.delete')}
                </button>
              )}
              {canRestore && (
                <div className="col-span-2 flex flex-col items-start gap-2 sm:col-span-1 sm:items-end">
                  <button
                    type="button"
                    onClick={() => void onRestoreProduct(product)}
                    disabled={isBusy}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {workingKey === `restore:${product.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {t('common.restore')}
                  </button>
                  {actionErrorKey === `restore:${product.id}` && actionError && (
                    <p className="max-w-56 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {actionError}
                    </p>
                  )}
                </div>
              )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
