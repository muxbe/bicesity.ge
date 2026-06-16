'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type {
  BulkActionResult,
  BulkMode,
  InventoryRole,
  ReservationContextDraft,
  SellChannel,
} from '@/features/admin/inventory/types';
import { getApiErrorMessage, parseActionError } from '@/features/admin/inventory/utils/api-errors';
import { reservationExpiryIso } from '@/features/admin/inventory/utils/date';
import type { ProductDTO } from '@/features/catalog';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { getJsonAuthHeaders } from '@/lib/auth/request-headers';
import type { useI18n } from '@/lib/i18n';

type RunAction = (key: string, action: () => Promise<void>) => Promise<void>;
type TranslationFn = ReturnType<typeof useI18n>['t'];

type BulkApiAction =
  | 'apply_discount'
  | 'remove_discount'
  | 'reserve'
  | 'cancel_reservation'
  | 'mark_sold'
  | 'archive';

type UseInventoryBulkActionsParams = {
  role: InventoryRole;
  products: ProductDTO[];
  selectedProductIds: string[];
  setSelectedProductIds: Dispatch<SetStateAction<string[]>>;
  clearSelectedProductIds: () => void;
  canClearArchived: boolean;
  bulkMode: BulkMode | null;
  bulkDiscountInput: string;
  bulkDiscountReason: string;
  reserveAtLocal: string;
  reserveNote: string;
  reservationContext: ReservationContextDraft;
  sellChannel: SellChannel;
  sellNote: string;
  setActionError: Dispatch<SetStateAction<string | null>>;
  runAction: RunAction;
  setBulkResult: Dispatch<SetStateAction<BulkActionResult | null>>;
  closeBulkModal: () => void;
  t: TranslationFn;
};

export function useInventoryBulkActions({
  role,
  products,
  selectedProductIds,
  setSelectedProductIds,
  clearSelectedProductIds,
  canClearArchived,
  bulkMode,
  bulkDiscountInput,
  bulkDiscountReason,
  reserveAtLocal,
  reserveNote,
  reservationContext,
  sellChannel,
  sellNote,
  setActionError,
  runAction,
  setBulkResult,
  closeBulkModal,
  t,
}: UseInventoryBulkActionsParams) {
  const postBulkAction = async (
    action: BulkApiAction,
    itemIds: string[],
    payload?: Record<string, unknown>
  ) => {
    const response = await fetch('/api/catalog/bulk', {
      method: 'POST',
      headers: await getJsonAuthHeaders(role),
      body: JSON.stringify({
        action,
        itemIds,
        payload,
      }),
    });

    const parsed = (await response.json().catch(() => null)) as
      | { data?: BulkActionResult; error?: string; details?: unknown }
      | null;

    if (!response.ok || !parsed?.data) {
      throw new Error(getApiErrorMessage(parsed, t('inventory.bulkActionFailed')));
    }

    return parsed.data;
  };

  const submitBulkAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!bulkMode) {
      return;
    }

    if (bulkMode === 'discount' && !bulkDiscountInput.trim()) {
      setActionError(t('inventory.discountRequired'));
      return;
    }
    if (bulkMode === 'reserve') {
      const reserveDate = new Date(reserveAtLocal);
      if (Number.isNaN(reserveDate.getTime())) {
        setActionError(t('inventory.validReservationDate'));
        return;
      }
    }

    await runAction(`bulk:${bulkMode}`, async () => {
      const result = await postBulkAction(
        bulkMode === 'discount'
          ? 'apply_discount'
          : bulkMode === 'remove-discount'
          ? 'remove_discount'
          : bulkMode === 'reserve'
          ? 'reserve'
          : bulkMode === 'cancel-reservation'
          ? 'cancel_reservation'
          : bulkMode === 'sell'
          ? 'mark_sold'
          : 'archive',
        selectedProductIds,
        bulkMode === 'discount'
          ? {
              discountInput: bulkDiscountInput,
              reason: bulkDiscountReason || null,
            }
          : bulkMode === 'reserve'
          ? {
              reservedForAt: new Date(reserveAtLocal).toISOString(),
              expiresAt: reservationExpiryIso(new Date(reserveAtLocal)),
              note: reserveNote || null,
              sellerComment: reserveNote || null,
              customerName: reservationContext.customerName || null,
              customerPhone: reservationContext.customerPhone || null,
              messengerProfileUrl: reservationContext.messengerProfileUrl || null,
              reservationSource: reservationContext.reservationSource,
            }
          : bulkMode === 'cancel-reservation'
          ? {
              note: role === 'seller' ? t('inventory.sellerCancelledNote') : t('inventory.adminCancelledNote'),
            }
          : bulkMode === 'sell'
          ? {
              saleChannel: sellChannel,
              auditNote: sellNote || null,
            }
          : undefined
      );

      setBulkResult(result);
      setSelectedProductIds([]);
      closeBulkModal();
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
    });
  };

  const clearSelectedArchivedProducts = async () => {
    if (!canClearArchived || selectedProductIds.length === 0) {
      return;
    }

    const selectedCount = selectedProductIds.length;
    const confirmed = window.confirm(
      t('inventory.clearDeletedConfirm', {
        count: selectedCount,
        plural: selectedCount === 1 ? '' : 's',
      })
    );
    if (!confirmed) {
      return;
    }

    await runAction('clear-archived', async () => {
      const productsById = new Map(products.map((product) => [product.id, product]));
      const result: BulkActionResult = {
        success: [],
        skipped: [],
      };

      for (const productId of selectedProductIds) {
        const product = productsById.get(productId);
        try {
          const response = await fetch(`/api/catalog/${encodeURIComponent(productId)}/clear`, {
            method: 'DELETE',
            headers: await getJsonAuthHeaders('admin'),
          });
          const payload = (await response.json().catch(() => null)) as
            | { data?: { cleared: boolean }; error?: string; details?: unknown }
            | null;

          if (!response.ok || !payload?.data?.cleared) {
            result.skipped.push({
              id: productId,
              name: product?.name,
              reason: getApiErrorMessage(payload, t('inventory.failedClear')),
            });
            continue;
          }

          result.success.push({ id: productId, name: product?.name ?? productId });
        } catch (caughtError) {
          result.skipped.push({
            id: productId,
            name: product?.name,
            reason: parseActionError(caughtError),
          });
        }
      }

      setBulkResult(result);
      setSelectedProductIds([]);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
    });
  };

  const clearSelection = () => {
    if (canClearArchived) {
      void clearSelectedArchivedProducts();
      return;
    }
    clearSelectedProductIds();
  };

  return {
    postBulkAction,
    submitBulkAction,
    clearSelectedArchivedProducts,
    clearSelection,
  };
}
