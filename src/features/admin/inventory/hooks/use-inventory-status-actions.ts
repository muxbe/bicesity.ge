'use client';

import type { Dispatch, FormEvent, KeyboardEvent, SetStateAction } from 'react';
import type {
  BulkActionResult,
  InventoryRole,
  ReservationContextDraft,
  SellChannel,
} from '@/features/admin/inventory/types';
import { getApiErrorMessage } from '@/features/admin/inventory/utils/api-errors';
import { reservationExpiryIso } from '@/features/admin/inventory/utils/date';
import { toMoney } from '@/features/admin/inventory/utils/money';
import type { ProductDTO, getCatalogRepository } from '@/features/catalog';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { getJsonAuthHeaders } from '@/lib/auth/request-headers';
import type { useI18n } from '@/lib/i18n';

type CatalogRepository = ReturnType<typeof getCatalogRepository>;
type RunAction = (key: string, action: () => Promise<void>) => Promise<void>;
type TranslationFn = ReturnType<typeof useI18n>['t'];
type PostBulkAction = (
  action: 'apply_discount' | 'remove_discount' | 'reserve' | 'cancel_reservation' | 'mark_sold' | 'archive',
  itemIds: string[],
  payload?: Record<string, unknown>
) => Promise<BulkActionResult>;

type UseInventoryStatusActionsParams = {
  role: InventoryRole;
  catalogRepository: CatalogRepository;
  runAction: RunAction;
  postBulkAction: PostBulkAction;
  t: TranslationFn;
  reserveProductId: string | null;
  reserveAtLocal: string;
  reserveNote: string;
  reservationContext: ReservationContextDraft;
  closeReserveDraft: () => void;
  sellProductId: string | null;
  sellPrice: string;
  sellChannel: SellChannel;
  sellNote: string;
  setSellProductId: Dispatch<SetStateAction<string | null>>;
  setSellPrice: Dispatch<SetStateAction<string>>;
  setSellNote: Dispatch<SetStateAction<string>>;
  setActionError: Dispatch<SetStateAction<string | null>>;
  setActionErrorKey: Dispatch<SetStateAction<string | null>>;
  openReserveDraft: (product: ProductDTO) => void;
  openSellDraft: (product: ProductDTO) => void;
};

export function useInventoryStatusActions({
  role,
  catalogRepository,
  runAction,
  postBulkAction,
  t,
  reserveProductId,
  reserveAtLocal,
  reserveNote,
  reservationContext,
  closeReserveDraft,
  sellProductId,
  sellPrice,
  sellChannel,
  sellNote,
  setSellProductId,
  setSellPrice,
  setSellNote,
  setActionError,
  setActionErrorKey,
  openReserveDraft,
  openSellDraft,
}: UseInventoryStatusActionsParams) {
  const openReserve = (product: ProductDTO) => {
    setActionError(null);
    setActionErrorKey(null);
    openReserveDraft(product);
  };

  const preventImplicitReservationSubmit = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    if (tagName === 'button' || tagName === 'textarea') {
      return;
    }

    event.preventDefault();
  };

  const submitReserve = async (event: FormEvent) => {
    event.preventDefault();
    if (!reserveProductId) {
      return;
    }
    setActionError(null);
    setActionErrorKey(null);
    const reserveDate = new Date(reserveAtLocal);
    if (Number.isNaN(reserveDate.getTime())) {
      setActionError(t('inventory.validReservationDate'));
      setActionErrorKey(`reserve:${reserveProductId}`);
      return;
    }

    await runAction(`reserve:${reserveProductId}`, async () => {
      const result = await postBulkAction('reserve', [reserveProductId], {
        reservedForAt: reserveDate.toISOString(),
        expiresAt: reservationExpiryIso(reserveDate),
        note: reserveNote || undefined,
        sellerComment: reserveNote || undefined,
        customerName: reservationContext.customerName || undefined,
        customerPhone: reservationContext.customerPhone || undefined,
        messengerProfileUrl: reservationContext.messengerProfileUrl || undefined,
        reservationSource: reservationContext.reservationSource,
      });
      if (result.success.length === 0) {
        throw new Error(result.skipped[0]?.reason ?? t('inventory.reservationFailed'));
      }
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      closeReserveDraft();
    });
  };

  const cancelReservation = async (product: ProductDTO) => {
    await runAction(`cancel-reservation:${product.id}`, async () => {
      const result = await postBulkAction('cancel_reservation', [product.id], {
        note: role === 'seller' ? t('inventory.sellerCancelledNote') : t('inventory.adminCancelledNote'),
      });
      if (result.success.length === 0) {
        throw new Error(result.skipped[0]?.reason ?? t('inventory.reservationCancellationFailed'));
      }
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
    });
  };

  const openSell = (product: ProductDTO) => {
    openSellDraft(product);
  };

  const submitSell = async (event: FormEvent) => {
    event.preventDefault();
    if (!sellProductId) {
      return;
    }
    const soldPrice = toMoney(sellPrice);
    if (soldPrice === null) {
      setActionError(t('inventory.soldPriceValidation'));
      return;
    }

    await runAction(`sell:${sellProductId}`, async () => {
      await catalogRepository.markAsSold(sellProductId, {
        soldPrice,
        saleChannel: sellChannel,
        soldAt: new Date().toISOString(),
        auditNote: sellNote || null,
      });
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      setSellProductId(null);
      setSellPrice('');
      setSellNote('');
    });
  };

  const restoreArchivedProduct = async (product: ProductDTO) => {
    await runAction(`restore:${product.id}`, async () => {
      const response = await fetch(`/api/catalog/${encodeURIComponent(product.id)}/restore`, {
        method: 'POST',
        headers: await getJsonAuthHeaders('admin'),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; details?: unknown }
          | null;
        throw new Error(getApiErrorMessage(payload, t('inventory.failedRestore')));
      }
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
    });
  };

  const archiveProduct = async (product: ProductDTO) => {
    await runAction(`archive:${product.id}`, async () => {
      await catalogRepository.archiveProduct(product.id);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
    });
  };

  return {
    openReserve,
    preventImplicitReservationSubmit,
    submitReserve,
    cancelReservation,
    openSell,
    submitSell,
    restoreArchivedProduct,
    archiveProduct,
  };
}
