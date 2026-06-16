'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { EMPTY_DRAFT } from '@/features/admin/inventory/constants';
import type { ProductFormDraft } from '@/features/admin/inventory/types';
import { getApiErrorMessage, parseActionError } from '@/features/admin/inventory/utils/api-errors';
import { toMoney, toStock } from '@/features/admin/inventory/utils/money';
import { imagesFromDraft, valuesForCategory } from '@/features/admin/inventory/utils/product-draft';
import type { AttributeDTO, ProductDTO, getCatalogRepository } from '@/features/catalog';
import { parseDiscountInput } from '@/features/catalog';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { getJsonAuthHeaders } from '@/lib/auth/request-headers';
import { uploadCatalogImageFile } from '@/lib/supabase/storage';
import type { useI18n } from '@/lib/i18n';

type CatalogRepository = ReturnType<typeof getCatalogRepository>;
type RunAction = (key: string, action: () => Promise<void>) => Promise<void>;
type TranslationFn = ReturnType<typeof useI18n>['t'];
type CriticalDrafts = Record<string, { price: string; stock: string }>;

type UseInventoryProductActionsParams = {
  attributes: AttributeDTO[];
  catalogRepository: CatalogRepository;
  runAction: RunAction;
  t: TranslationFn;
  createDraft: ProductFormDraft;
  setCreateDraft: Dispatch<SetStateAction<ProductFormDraft>>;
  setCreateOpen: Dispatch<SetStateAction<boolean>>;
  editProductId: string | null;
  editDraft: ProductFormDraft;
  setEditDraft: Dispatch<SetStateAction<ProductFormDraft>>;
  setEditProductId: Dispatch<SetStateAction<string | null>>;
  criticalDrafts: CriticalDrafts;
  setCriticalDrafts: Dispatch<SetStateAction<CriticalDrafts>>;
  setWorkingKey: Dispatch<SetStateAction<string | null>>;
  setActionError: Dispatch<SetStateAction<string | null>>;
  openEditDraft: (product: ProductDTO) => void;
};

export function useInventoryProductActions({
  attributes,
  catalogRepository,
  runAction,
  t,
  createDraft,
  setCreateDraft,
  setCreateOpen,
  editProductId,
  editDraft,
  setEditDraft,
  setEditProductId,
  criticalDrafts,
  setCriticalDrafts,
  setWorkingKey,
  setActionError,
  openEditDraft,
}: UseInventoryProductActionsParams) {
  const openCreate = () => {
    setActionError(null);
    setCreateDraft(EMPTY_DRAFT);
    setCreateOpen(true);
  };

  const updateDraft = (
    productId: string,
    patch: Partial<{ price: string; stock: string }>,
    fallback: { price: string; stock: string }
  ) => {
    setCriticalDrafts((current) => ({
      ...current,
      [productId]: { ...(current[productId] ?? fallback), ...patch },
    }));
  };

  const saveCriticalFields = async (product: ProductDTO) => {
    const fallback = { price: String(product.price), stock: String(product.stockCount) };
    const critical = criticalDrafts[product.id] ?? fallback;
    const nextPrice = toMoney(critical.price);
    const nextStock = toStock(critical.stock);

    if (nextPrice === null || nextStock === null) {
      setActionError(t('inventory.priceStockValidation'));
      return;
    }

    await runAction(`critical:${product.id}`, async () => {
      const response = await fetch(`/api/catalog/${product.id}/critical`, {
        method: 'PATCH',
        headers: await getJsonAuthHeaders('admin'),
        body: JSON.stringify({ price: nextPrice, stockCount: nextStock }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; details?: unknown }
          | null;
        throw new Error(getApiErrorMessage(payload, 'Failed to save price/stock.'));
      }

      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      setCriticalDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
    });
  };

  const uploadImageIntoDraft = async (target: 'create' | 'edit', file: File) => {
    setActionError(null);
    const currentImages = imagesFromDraft(target === 'create' ? createDraft : editDraft);
    if (currentImages.length >= 5) {
      setActionError(t('inventory.uploadLimit'));
      return;
    }

    setWorkingKey(`upload:${target}`);
    try {
      const publicUrl = await uploadCatalogImageFile(file);
      const setDraft = target === 'create' ? setCreateDraft : setEditDraft;
      setDraft((current) => {
        const currentImages = imagesFromDraft(current);
        if (currentImages.length >= 5) {
          setActionError(t('inventory.uploadLimit'));
          return current;
        }
        const images = [...currentImages, publicUrl];
        return { ...current, image: images[0] ?? '', images };
      });
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
    } finally {
      setWorkingKey(null);
    }
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    const price = toMoney(createDraft.price);
    const stockCount = toStock(createDraft.stockCount);
    if (price === null || stockCount === null) {
      setActionError(t('inventory.priceStockValidation'));
      return;
    }
    const discount = parseDiscountInput(createDraft.discountInput, price);
    if (!discount.ok) {
      setActionError(discount.error);
      return;
    }

    await runAction('create', async () => {
      await catalogRepository.createProduct({
        name: createDraft.name,
        category: createDraft.category,
        type: createDraft.category === 'Bicycle' ? createDraft.type : undefined,
        serial: createDraft.serial,
        price,
        stockCount,
        discountInput: createDraft.discountInput,
        description: createDraft.description,
        image: createDraft.images[0] || createDraft.image || undefined,
        images: createDraft.images,
        values: valuesForCategory(createDraft.values, createDraft.category, attributes),
      });
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      setCreateOpen(false);
      setCreateDraft(EMPTY_DRAFT);
    });
  };

  const openEdit = (product: ProductDTO) => {
    setActionError(null);
    openEditDraft(product);
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editProductId) {
      return;
    }
    const price = toMoney(editDraft.price);
    const stockCount = toStock(editDraft.stockCount);
    if (price === null || stockCount === null) {
      setActionError(t('inventory.priceStockValidation'));
      return;
    }
    const discount = parseDiscountInput(editDraft.discountInput, price);
    if (!discount.ok) {
      setActionError(discount.error);
      return;
    }

    await runAction(`edit:${editProductId}`, async () => {
      await catalogRepository.updateProduct(editProductId, {
        name: editDraft.name,
        serial: editDraft.serial,
        description: editDraft.description,
        type: editDraft.category === 'Bicycle' ? editDraft.type : undefined,
        image: editDraft.images[0] || editDraft.image || undefined,
        images: editDraft.images,
        price,
        discountInput: editDraft.discountInput,
        stockCount,
        values: valuesForCategory(editDraft.values, editDraft.category, attributes),
      });
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      setEditProductId(null);
    });
  };

  return { openCreate, updateDraft, saveCriticalFields, uploadImageIntoDraft, submitCreate, openEdit, submitEdit };
}
