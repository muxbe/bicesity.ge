'use client';

import { useState } from 'react';
import { EMPTY_DRAFT, EMPTY_RESERVATION_CONTEXT } from '@/features/admin/inventory/constants';
import type {
  BulkActionResult,
  BulkMode,
  ProductFormDraft,
  ReservationContextDraft,
  SellChannel,
} from '@/features/admin/inventory/types';
import { formatDatetimeForInput } from '@/features/admin/inventory/utils/date';
import { draftFromProduct } from '@/features/admin/inventory/utils/product-draft';
import { getCurrentPrice, type ProductDTO } from '@/features/catalog';

type UseInventoryModalStateParams = {
  soldFromAdminNote: string;
  bulkSaleNote: string;
};

export function useInventoryModalState({
  soldFromAdminNote,
  bulkSaleNote,
}: UseInventoryModalStateParams) {
  const [criticalDrafts, setCriticalDrafts] = useState<Record<string, { price: string; stock: string }>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ProductFormDraft>(EMPTY_DRAFT);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProductFormDraft>(EMPTY_DRAFT);
  const [reserveProductId, setReserveProductId] = useState<string | null>(null);
  const [reserveAtLocal, setReserveAtLocal] = useState('');
  const [reserveNote, setReserveNote] = useState('');
  const [reservationContext, setReservationContext] = useState<ReservationContextDraft>(EMPTY_RESERVATION_CONTEXT);
  const [sellProductId, setSellProductId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellChannel, setSellChannel] = useState<SellChannel>('in_store');
  const [sellNote, setSellNote] = useState('');
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);
  const [bulkDiscountInput, setBulkDiscountInput] = useState('');
  const [bulkDiscountReason, setBulkDiscountReason] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkActionResult | null>(null);

  const openEditDraft = (product: ProductDTO) => {
    setEditProductId(product.id);
    setEditDraft(draftFromProduct(product));
  };

  const openReserveDraft = (product: ProductDTO) => {
    setReserveProductId(product.id);
    setReserveAtLocal(formatDatetimeForInput(new Date().toISOString()));
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
  };

  const closeReserveDraft = () => {
    setReserveProductId(null);
    setReserveAtLocal('');
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
  };

  const openSellDraft = (product: ProductDTO) => {
    setSellProductId(product.id);
    setSellPrice(String(getCurrentPrice(product)));
    setSellChannel('in_store');
    setSellNote(soldFromAdminNote);
  };

  const closeBulkModal = () => {
    setBulkMode(null);
    setBulkDiscountInput('');
    setBulkDiscountReason('');
    setReserveAtLocal('');
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
    setSellChannel('in_store');
    setSellNote('');
  };

  const startBulkReserve = () => {
    setBulkMode('reserve');
    setReserveAtLocal(formatDatetimeForInput(new Date().toISOString()));
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
    setBulkResult(null);
  };

  const startBulkCancelReservation = () => {
    setBulkMode('cancel-reservation');
    setBulkResult(null);
  };

  const startBulkDiscount = () => {
    setBulkMode('discount');
    setBulkResult(null);
  };

  const startBulkRemoveDiscount = () => {
    setBulkMode('remove-discount');
    setBulkResult(null);
  };

  const startBulkSell = () => {
    setBulkMode('sell');
    setSellChannel('in_store');
    setSellNote(bulkSaleNote);
    setBulkResult(null);
  };

  const startBulkDelete = () => {
    setBulkMode('delete');
    setBulkResult(null);
  };

  return {
    criticalDrafts,
    setCriticalDrafts,
    createOpen,
    setCreateOpen,
    createDraft,
    setCreateDraft,
    editProductId,
    setEditProductId,
    editDraft,
    setEditDraft,
    reserveProductId,
    setReserveProductId,
    reserveAtLocal,
    setReserveAtLocal,
    reserveNote,
    setReserveNote,
    reservationContext,
    setReservationContext,
    sellProductId,
    setSellProductId,
    sellPrice,
    setSellPrice,
    sellChannel,
    setSellChannel,
    sellNote,
    setSellNote,
    bulkMode,
    setBulkMode,
    bulkDiscountInput,
    setBulkDiscountInput,
    bulkDiscountReason,
    setBulkDiscountReason,
    bulkResult,
    setBulkResult,
    openEditDraft,
    openReserveDraft,
    closeReserveDraft,
    openSellDraft,
    closeBulkModal,
    startBulkReserve,
    startBulkCancelReservation,
    startBulkDiscount,
    startBulkRemoveDiscount,
    startBulkSell,
    startBulkDelete,
  };
}
