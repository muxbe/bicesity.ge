'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  CalendarClock,
  ChevronDown,
  DollarSign,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  getCatalogRepository,
  getFallbackImage,
  type ProductCategory,
  type AttributeDTO,
  type ProductDTO,
  type ProductStatus,
  useCatalogData,
} from '@/features/catalog';
import { getCurrentPrice, parseDiscountInput } from '@/features/catalog';
import { PriceDisplay } from '@/features/catalog/components/price-display';
import { useReservationData, type ReservationDTO, type ReservationSource } from '@/features/reservations';
import { ReservationCommentEditor } from '@/features/reservations/components/reservation-comment-editor';
import {
  buildFieldLayoutItems,
  coreFieldOptions,
  loadFieldLayoutConfig,
  type FieldLayoutItem,
} from '@/features/fields/field-layout';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { getCatalogDataSource } from '@/lib/feature-flags';
import { getJsonAuthHeaders } from '@/lib/auth/request-headers';
import { hasSupabasePublicEnv } from '@/lib/supabase/client';
import { uploadCatalogImageFile } from '@/lib/supabase/storage';
import {
  categoryLabel,
  driveTypeLabel,
  fieldNameLabel,
  reservationSourceLabel,
  statusLabel,
  useI18n,
} from '@/lib/i18n';

type CategoryTab = 'All' | 'Bicycle' | 'Parts';
type SellChannel = 'online' | 'in_store' | 'as_is';
type StockFilter = 'All' | 'In Stock' | 'Out of Stock';
type BikeTypeFilter = 'All' | string;
type InventoryRole = 'admin' | 'seller';
type BulkMode = 'discount' | 'remove-discount' | 'reserve' | 'cancel-reservation' | 'sell' | 'delete';

type AdminInventoryPageProps = {
  role?: InventoryRole;
  statusView?: ProductStatus;
  title?: string;
  description?: string;
};

type BulkActionResult = {
  success: Array<{ id: string; name: string }>;
  skipped: Array<{ id: string; name?: string; reason: string }>;
};

type ReservationContextDraft = {
  customerName: string;
  customerPhone: string;
  messengerProfileUrl: string;
  reservationSource: ReservationSource;
};

type ProductFormDraft = {
  name: string;
  category: ProductCategory;
  type: string;
  serial: string;
  price: string;
  discountInput: string;
  stockCount: string;
  description: string;
  image: string;
  images: string[];
  values: Record<string, string>;
};

const EMPTY_DRAFT: ProductFormDraft = {
  name: '',
  category: 'Bicycle',
  type: 'Manual',
  serial: '',
  price: '',
  discountInput: '',
  stockCount: '1',
  description: '',
  image: '',
  images: [],
  values: {},
};

const RESERVATION_HOLD_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_RESERVATION_CONTEXT: ReservationContextDraft = {
  customerName: '',
  customerPhone: '',
  messengerProfileUrl: '',
  reservationSource: 'manual',
};
const RESERVATION_SOURCE_OPTIONS: ReservationSource[] = ['manual', 'messenger', 'phone', 'walk_in', 'other'];

function toMoney(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function toStock(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseFilterPrice(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function formatDatetimeForInput(rawIso: string): string {
  const date = new Date(rawIso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function reservationExpiryIso(reserveDate: Date): string {
  return new Date(reserveDate.getTime() + RESERVATION_HOLD_MS).toISOString();
}

function imagesFromDraft(draft: ProductFormDraft): string[] {
  return draft.images.length > 0 ? draft.images : draft.image ? [draft.image] : [];
}

function draftFromProduct(product: ProductDTO): ProductFormDraft {
  const fallbackImage = getFallbackImage(product.category);
  const images = product.images.filter((image) => image !== fallbackImage);

  return {
    name: product.name,
    category: product.category,
    type: product.type ?? 'Manual',
    serial: product.serial,
    price: String(product.price),
    discountInput: product.discountInput,
    stockCount: String(product.stockCount),
    description: product.description,
    image: images[0] ?? '',
    images,
    values: { ...product.values },
  };
}

function parseActionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Action failed. Try again.';
}

function inventoryTitleKey(role: InventoryRole, statusView: ProductStatus) {
  if (statusView === 'reserved') {
    return 'inventory.titleReserved';
  }
  if (statusView === 'sold') {
    return 'inventory.titleSold';
  }
  if (statusView === 'archived') {
    return 'inventory.titleDeleted';
  }
  return role === 'seller' ? 'inventory.titleSeller' : 'inventory.titleAdmin';
}

function inventoryDescriptionKey(role: InventoryRole, statusView: ProductStatus) {
  if (statusView === 'reserved') {
    return 'inventory.descReserved';
  }
  if (statusView === 'sold') {
    return 'inventory.descSold';
  }
  if (statusView === 'archived') {
    return 'inventory.descDeleted';
  }
  return role === 'seller' ? 'inventory.descSeller' : 'inventory.descAdmin';
}

function getApiErrorMessage(payload: { error?: string; details?: unknown } | null, fallback: string) {
  const message = payload?.error ?? fallback;
  const details = payload?.details;
  if (
    details &&
    typeof details === 'object' &&
    'message' in details &&
    typeof details.message === 'string'
  ) {
    return `${message} ${details.message}`;
  }
  return message;
}

function valuesForCategory(
  values: Record<string, string>,
  category: ProductFormDraft['category'],
  attributes: AttributeDTO[]
) {
  const allowedIds = new Set(
    attributes
      .filter((attribute) => attribute.category === category)
      .map((attribute) => attribute.id)
  );
  return Object.fromEntries(
    Object.entries(values)
      .filter(([attributeId]) => allowedIds.has(attributeId))
      .map(([attributeId, value]) => [attributeId, value.trim()])
  );
}

function StatusBadge({ status }: { status: ProductDTO['status'] }) {
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

function ReservationCustomerSummary({ reservation }: { reservation: ReservationDTO }) {
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

function ProductImage({
  src,
  alt,
  category,
  className,
}: {
  src: string;
  alt: string;
  category: ProductDTO['category'];
  className?: string;
}) {
  const fallback = getFallbackImage(category);
  const [imageSrc, setImageSrc] = useState(src || fallback);

  useEffect(() => {
    setImageSrc(src || fallback);
  }, [fallback, src]);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, 160px"
      className={className}
      onError={() => setImageSrc(fallback)}
    />
  );
}

export function AdminInventoryView({
  role = 'admin',
  statusView = 'active',
  title: _title,
  description: _description,
}: AdminInventoryPageProps) {
  const { locale, t } = useI18n();
  const catalogStatus = statusView === 'archived' ? 'archived' : 'all';
  const { products, attributes, isLoading, isRefreshing, error, reload, isStale, lastRefreshAt } = useCatalogData({
    status: catalogStatus,
  });
  const {
    reservations: activeReservationsForComments,
    isLoading: areReservationCommentsLoading,
    error: reservationCommentError,
    reload: reloadReservationComments,
  } = useReservationData('active');
  const catalogRepository = useMemo(() => getCatalogRepository(), []);
  const isAdmin = role === 'admin';
  const canManageCatalog = isAdmin && statusView === 'active';
  const canReserve = statusView === 'active';
  const canBulkReserve = canReserve;
  const canCancelReservation = statusView === 'reserved';
  const canDiscountSelected = isAdmin && (statusView === 'active' || statusView === 'reserved');
  const canMarkSold = isAdmin && (statusView === 'active' || statusView === 'reserved');
  const canDelete = isAdmin && statusView !== 'archived';
  const canRestore = isAdmin && statusView === 'archived';
  const canClearArchived = isAdmin && statusView === 'archived';
  const pageTitle = t(inventoryTitleKey(role, statusView));
  const pageDescription = t(inventoryDescriptionKey(role, statusView));

  const reloadPageData = async () => {
    setActionError(null);
    setActionErrorKey(null);
    await Promise.all([
      reload(),
      statusView === 'reserved' ? reloadReservationComments() : Promise.resolve(),
    ]);
  };

  const [categoryTab, setCategoryTab] = useState<CategoryTab>('All');
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('All');
  const [bikeTypeFilter, setBikeTypeFilter] = useState<BikeTypeFilter>('All');
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const [isDetailedFiltersOpen, setIsDetailedFiltersOpen] = useState(false);
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
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);
  const [bulkDiscountInput, setBulkDiscountInput] = useState('');
  const [bulkDiscountReason, setBulkDiscountReason] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkActionResult | null>(null);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
  const canUploadToStorage = getCatalogDataSource() === 'supabase' && hasSupabasePublicEnv();

  const openCreate = async () => {
    setActionError(null);
    await reload();
    setCreateDraft(EMPTY_DRAFT);
    setCreateOpen(true);
  };

  const visibleFilterAttributes = useMemo(
    () =>
      attributes.filter(
        (attribute) =>
          (categoryTab === 'All' || attribute.category === categoryTab)
      ),
    [attributes, categoryTab]
  );

  const attributeOptionsById = useMemo(() => {
    const scopedProducts = products.filter(
      (product) =>
        product.status === statusView &&
        (categoryTab === 'All' || product.category === categoryTab)
    );
    const options: Record<string, string[]> = {};
    for (const attribute of visibleFilterAttributes) {
      if (attribute.inputMode === 'single_select' && attribute.options.length > 0) {
        options[attribute.id] = attribute.options.map((option) => option.value);
        continue;
      }
      options[attribute.id] = Array.from(
        new Set(
          scopedProducts
            .map((product) => product.values[attribute.id])
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b));
    }
    return options;
  }, [categoryTab, products, statusView, visibleFilterAttributes]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minPrice = parseFilterPrice(minPriceFilter);
    const maxPrice = parseFilterPrice(maxPriceFilter);
    return products.filter((product) => {
      if (product.status !== statusView) {
        return false;
      }
      if (categoryTab !== 'All' && product.category !== categoryTab) {
        return false;
      }
      if (!normalizedQuery) {
        // keep checking other filters
      } else if (
        ![product.name, product.serial, product.description]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }

      if (stockFilter === 'In Stock' && !product.inStock) {
        return false;
      }
      if (stockFilter === 'Out of Stock' && product.inStock) {
        return false;
      }

      if (bikeTypeFilter !== 'All') {
        if (product.category !== 'Bicycle' || product.type !== bikeTypeFilter) {
          return false;
        }
      }

      const currentPrice = getCurrentPrice(product);
      if (minPrice !== null && currentPrice < minPrice) {
        return false;
      }
      if (maxPrice !== null && currentPrice > maxPrice) {
        return false;
      }

      for (const [attributeId, selectedValue] of Object.entries(attributeFilters)) {
        if (!selectedValue) {
          continue;
        }
        if (product.values[attributeId] !== selectedValue) {
          return false;
        }
      }

      return true;
    });
  }, [
    products,
    categoryTab,
    query,
    stockFilter,
    bikeTypeFilter,
    minPriceFilter,
    maxPriceFilter,
    attributeFilters,
    statusView,
  ]);

  const driveTypeFilterOptions = useMemo(() => {
    const configuredOptions = coreFieldOptions(loadFieldLayoutConfig(), 'drive_type').map((option) => option.value);
    const productOptions = products
      .map((product) => product.type)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set([...configuredOptions, ...productOptions])).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const counts = useMemo(
    () => ({
      active: products.filter((item) => item.status === 'active').length,
      reserved: products.filter((item) => item.status === 'reserved').length,
      sold: products.filter((item) => item.status === 'sold').length,
    }),
    [products]
  );

  const activeReservationByProductId = useMemo(
    () =>
      new Map(
        activeReservationsForComments
          .filter((reservation) => reservation.status === 'active')
          .map((reservation) => [reservation.productId, reservation])
      ),
    [activeReservationsForComments]
  );

  const visibleProductIds = useMemo(
    () => visibleProducts.map((product) => product.id),
    [visibleProducts]
  );

  const selectedVisibleCount = useMemo(
    () => selectedProductIds.filter((id) => visibleProductIds.includes(id)).length,
    [selectedProductIds, visibleProductIds]
  );

  const allVisibleSelected =
    visibleProductIds.length > 0 && selectedVisibleCount === visibleProductIds.length;

  const runAction = async (key: string, action: () => Promise<void>) => {
    setWorkingKey(key);
    setActionError(null);
    setActionErrorKey(null);
    try {
      await action();
      await reload();
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
      setActionErrorKey(key);
    } finally {
      setWorkingKey(null);
    }
  };

  const resetDetailedFilters = () => {
    setStockFilter('All');
    setBikeTypeFilter('All');
    setMinPriceFilter('');
    setMaxPriceFilter('');
    setAttributeFilters({});
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  const toggleSelectVisible = () => {
    setSelectedProductIds((current) => {
      const currentSet = new Set(current);
      if (allVisibleSelected) {
        return current.filter((id) => !visibleProductIds.includes(id));
      }
      visibleProductIds.forEach((id) => currentSet.add(id));
      return Array.from(currentSet);
    });
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

  const postBulkAction = async (
    action:
      | 'apply_discount'
      | 'remove_discount'
      | 'reserve'
      | 'cancel_reservation'
      | 'mark_sold'
      | 'archive',
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
      if (target === 'create') {
        setCreateDraft((current) => {
          const currentImages = imagesFromDraft(current);
          if (currentImages.length >= 5) {
            setActionError(t('inventory.uploadLimit'));
            return current;
          }
          const images = [...currentImages, publicUrl];
          return { ...current, image: images[0] ?? '', images };
        });
      } else {
        setEditDraft((current) => {
          const currentImages = imagesFromDraft(current);
          if (currentImages.length >= 5) {
            setActionError(t('inventory.uploadLimit'));
            return current;
          }
          const images = [...currentImages, publicUrl];
          return { ...current, image: images[0] ?? '', images };
        });
      }
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

  const openEdit = async (product: ProductDTO) => {
    setActionError(null);
    await reload();
    setEditProductId(product.id);
    setEditDraft(draftFromProduct(product));
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

  const openReserve = (product: ProductDTO) => {
    setActionError(null);
    setActionErrorKey(null);
    setReserveProductId(product.id);
    setReserveAtLocal(formatDatetimeForInput(new Date().toISOString()));
    setReserveNote('');
    setReservationContext(EMPTY_RESERVATION_CONTEXT);
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
    const reserveIso = reserveDate.toISOString();
    const expiresIso = reservationExpiryIso(reserveDate);

    await runAction(`reserve:${reserveProductId}`, async () => {
      const result = await postBulkAction('reserve', [reserveProductId], {
        reservedForAt: reserveIso,
        expiresAt: expiresIso,
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
      setReserveProductId(null);
      setReserveAtLocal('');
      setReserveNote('');
      setReservationContext(EMPTY_RESERVATION_CONTEXT);
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
    setSellProductId(product.id);
    setSellPrice(String(getCurrentPrice(product)));
    setSellChannel('in_store');
    setSellNote(t('inventory.soldFromAdminNote'));
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
        } catch (error) {
          result.skipped.push({
            id: productId,
            name: product?.name,
            reason: parseActionError(error),
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

  const renderReservationContextFields = (scope: 'single' | 'bulk') => (
    <div className="brand-filter-panel space-y-3 rounded-2xl border p-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        {scope === 'bulk' ? t('inventory.customerContextSelected') : t('inventory.customerContext')}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={reservationContext.customerName}
          onChange={(event) =>
            setReservationContext((current) => ({ ...current, customerName: event.target.value }))
          }
          className="brand-control h-11 rounded-xl border px-3 text-sm"
          placeholder={t('inventory.customerName')}
        />
        <input
          value={reservationContext.customerPhone}
          onChange={(event) =>
            setReservationContext((current) => ({ ...current, customerPhone: event.target.value }))
          }
          className="brand-control h-11 rounded-xl border px-3 text-sm"
          placeholder={t('inventory.customerPhone')}
        />
      </div>
      <input
        type="url"
        value={reservationContext.messengerProfileUrl}
        onChange={(event) =>
          setReservationContext((current) => ({ ...current, messengerProfileUrl: event.target.value }))
        }
        className="brand-control h-11 w-full rounded-xl border px-3 text-sm"
        placeholder={t('inventory.messengerLink')}
      />
      <select
        value={reservationContext.reservationSource}
        onChange={(event) =>
          setReservationContext((current) => ({
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
    <div className="w-full max-w-7xl">
      <div className="mb-6 flex flex-col items-stretch gap-4 sm:mb-7 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-black text-slate-900 sm:text-4xl">{pageTitle}</h1>
          <p className="text-slate-600 mt-2">{pageDescription}</p>
          {isRefreshing && (
            <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('inventory.refreshing')}
            </p>
          )}
          {lastRefreshAt && (
            <p className="text-xs text-slate-500 mt-2">
              {t('inventory.lastRefresh', { value: new Date(lastRefreshAt).toLocaleString() })}
            </p>
          )}
          {isStale && <p className="text-xs text-amber-700 mt-1">{t('inventory.dataStale')}</p>}
          {(error || actionError) && (
            <div className="mt-2 flex max-w-2xl items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <p className="flex-1">{actionError ?? error}</p>
              {actionError && (
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActionErrorKey(null);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  {t('common.dismiss')}
                </button>
              )}
            </div>
          )}
          {statusView === 'reserved' && reservationCommentError && (
            <p className="text-sm text-rose-600 mt-2">
              {t('inventory.commentsCouldNotLoad', { error: reservationCommentError })}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => void reloadPageData()} className="brand-control flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold text-slate-700 hover:bg-cyan-50">
              <RefreshCw size={16} /> {t('common.reload')}
            </button>
          {canManageCatalog && statusView === 'active' && (
            <button type="button" onClick={() => void openCreate()} className="brand-primary flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
              <Plus size={16} /> {t('inventory.addProduct')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl border border-cyan-100 bg-white p-4"><p className="text-xs text-slate-500">{t('common.active')}</p><p className="text-2xl font-black text-slate-900">{counts.active}</p></div>
        <div className="rounded-2xl border border-cyan-100 bg-white p-4"><p className="text-xs text-slate-500">{t('common.reserved')}</p><p className="text-2xl font-black text-slate-900">{counts.reserved}</p></div>
        <div className="rounded-2xl border border-cyan-100 bg-white p-4"><p className="text-xs text-slate-500">{t('common.sold')}</p><p className="text-2xl font-black text-slate-900">{counts.sold}</p></div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Bicycle', 'Parts'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setCategoryTab(tab);
                if (tab === 'Parts') {
                  setBikeTypeFilter('All');
                }
                setAttributeFilters({});
              }}
              className={`h-10 px-4 rounded-xl text-sm font-semibold ${
                categoryTab === tab
                  ? 'bg-[var(--brand-navy)] text-white'
                  : 'brand-control border text-slate-700'
              }`}
            >
              {tab === 'All' ? t('common.all') : categoryLabel(tab, t)}
            </button>
          ))}

          <div className="relative w-full sm:min-w-72 sm:flex-1">
            <Search size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('inventory.searchPlaceholder')}
              className="brand-control h-10 w-full rounded-xl border pl-8 pr-3 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsDetailedFiltersOpen((current) => !current)}
            className="brand-control inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold text-slate-700 hover:bg-cyan-50 sm:w-auto"
          >
            <SlidersHorizontal size={14} />
            {t('inventory.detailedFilters')}
            <ChevronDown
              size={14}
              className={`transition-transform ${isDetailedFiltersOpen ? 'rotate-180' : 'rotate-0'}`}
            />
          </button>
        </div>

        {isDetailedFiltersOpen && (
          <div className="brand-filter-panel grid grid-cols-1 gap-3 rounded-2xl border p-4 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value as StockFilter)}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            >
              <option value="All">{t('inventory.allStock')}</option>
              <option value="In Stock">{t('common.inStock')}</option>
              <option value="Out of Stock">{t('common.outOfStock')}</option>
            </select>

            <select
              value={bikeTypeFilter}
              onChange={(event) => setBikeTypeFilter(event.target.value as BikeTypeFilter)}
              disabled={categoryTab === 'Parts'}
              className="brand-control h-10 rounded-xl border px-3 text-sm disabled:bg-slate-100"
            >
              <option value="All">{t('inventory.allBikeTypes')}</option>
              {driveTypeFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {driveTypeLabel(option, t)}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              value={minPriceFilter}
              onChange={(event) => setMinPriceFilter(event.target.value)}
              placeholder={t('inventory.minPrice')}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            />

            <input
              type="number"
              min="0"
              value={maxPriceFilter}
              onChange={(event) => setMaxPriceFilter(event.target.value)}
              placeholder={t('inventory.maxPrice')}
              className="brand-control h-10 rounded-xl border px-3 text-sm"
            />

            {visibleFilterAttributes.map((attribute) => (
              <select
                key={attribute.id}
                value={attributeFilters[attribute.id] ?? ''}
                onChange={(event) =>
                  setAttributeFilters((current) => ({
                    ...current,
                    [attribute.id]: event.target.value,
                  }))
                }
                className="brand-control h-10 rounded-xl border px-3 text-sm"
              >
                <option value="">{fieldNameLabel(attribute, locale)}: {t('common.any')}</option>
                {(attributeOptionsById[attribute.id] ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ))}

            <button
              type="button"
              onClick={resetDetailedFilters}
              className="brand-control h-10 px-4 rounded-xl border text-sm font-semibold text-slate-700 hover:bg-cyan-50"
            >
              {t('inventory.clearFilters')}
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectVisible}
            className="h-4 w-4 rounded border-slate-300 accent-cyan-600"
          />
          {t('inventory.selectVisible')}
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <span className="text-sm font-semibold text-slate-600">
            {t('inventory.selectedCount', { count: selectedProductIds.length })}
          </span>
          {canBulkReserve && (
            <button
              type="button"
              disabled={selectedProductIds.length === 0}
              onClick={() => {
                setBulkMode('reserve');
                setReserveAtLocal(formatDatetimeForInput(new Date().toISOString()));
                setReserveNote('');
                setReservationContext(EMPTY_RESERVATION_CONTEXT);
                setBulkResult(null);
              }}
              className="h-9 rounded-lg border border-sky-300 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
            >
              {t('common.reserve')}
            </button>
          )}
          {canCancelReservation && (
            <button
              type="button"
              disabled={selectedProductIds.length === 0}
              onClick={() => {
                setBulkMode('cancel-reservation');
                setBulkResult(null);
              }}
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
                    disabled={selectedProductIds.length === 0}
                    onClick={() => {
                      setBulkMode('discount');
                      setBulkResult(null);
                    }}
                    className="brand-primary h-9 rounded-lg px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {t('common.discount')}
                  </button>
                  <button
                    type="button"
                    disabled={selectedProductIds.length === 0}
                    onClick={() => {
                      setBulkMode('remove-discount');
                      setBulkResult(null);
                    }}
                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t('inventory.removeDiscount')}
                  </button>
                </>
              )}
              {canMarkSold && (
                <button
                  type="button"
                  disabled={selectedProductIds.length === 0}
                  onClick={() => {
                    setBulkMode('sell');
                    setSellChannel('in_store');
                    setSellNote(t('inventory.bulkSaleNote'));
                    setBulkResult(null);
                  }}
                  className="h-9 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {t('inventory.markSold')}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  disabled={selectedProductIds.length === 0}
                  onClick={() => {
                    setBulkMode('delete');
                    setBulkResult(null);
                  }}
                  className="h-9 rounded-lg border border-rose-300 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {t('common.delete')}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            disabled={selectedProductIds.length === 0 || workingKey === 'clear-archived'}
            onClick={() => {
              if (canClearArchived) {
                void clearSelectedArchivedProducts();
                return;
              }
              setSelectedProductIds([]);
            }}
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

      <div className="space-y-3">
        {isLoading && visibleProducts.length === 0 && <div className="rounded-2xl bg-white border border-slate-200 p-6 text-slate-600">{t('inventory.loadingInventory')}</div>}
        {!isLoading && visibleProducts.length === 0 && <div className="rounded-2xl bg-white border border-slate-200 p-6 text-slate-600">{t('inventory.noProducts')}</div>}

        {visibleProducts.map((product) => {
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
            <article key={product.id} className="grid grid-cols-[auto,1fr] gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:gap-4 sm:p-4 lg:grid-cols-[auto,auto,1fr,auto]">
              <label className="col-span-2 flex items-start gap-2 text-sm font-semibold text-slate-600 lg:col-span-1">
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(product.id)}
                  onChange={() => toggleProductSelection(product.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 accent-cyan-600"
                  aria-label={`Select ${product.name}`}
                />
                <span className="sr-only">Select {product.name}</span>
              </label>
              <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-24 sm:w-24">
                <ProductImage src={product.image} alt={product.name} category={product.category} className="object-cover" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="break-words text-base font-black text-slate-900 sm:text-lg">{product.name}</h2>
                  <StatusBadge status={product.status} />
                  <span className="text-xs rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{categoryLabel(product.category, t)}</span>
                  <span className="text-xs rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-700">{product.type ? driveTypeLabel(product.type, t) : t('inventory.part')}</span>
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
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
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
                      onSaved={reloadReservationComments}
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
                      onClick={() => void reloadReservationComments()}
                      className="mt-3 h-8 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800 hover:bg-amber-100"
                    >
                      {t('inventory.loadComment')}
                    </button>
                  </div>
                )}

                {canManageCatalog && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
                    <label className="text-xs text-slate-500">{t('common.price')}</label>
                    <input type="number" min="0" step="0.01" value={critical.price} onChange={(event) => updateDraft(product.id, { price: event.target.value }, fallback)} className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm sm:w-28" />
                    <label className="text-xs text-slate-500">{t('common.stock')}</label>
                    <input type="number" min="0" step="1" value={critical.stock} onChange={(event) => updateDraft(product.id, { stock: event.target.value }, fallback)} className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm sm:w-20" />
                    <button type="button" onClick={() => void saveCriticalFields(product)} disabled={isBusy} className="col-span-2 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:col-span-1">
                      {workingKey === `critical:${product.id}` ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />} {t('common.save')}
                    </button>
                  </div>
                )}
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:col-span-1 lg:flex-col lg:items-end">
                <Link
                  href={`/shop/${product.id}`}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={14} />
                  {t('common.details')}
                </Link>
                {canManageCatalog && (
                  <button type="button" onClick={() => void openEdit(product)} disabled={isBusy} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pencil size={14} /> {t('common.edit')}</button>
                )}
                {canReserve && (
                  <button type="button" onClick={() => openReserve(product)} disabled={isBusy || product.status !== 'active' || product.stockCount <= 0} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-300 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"><CalendarClock size={14} /> {t('common.reserve')}</button>
                )}
                {canCancelReservation && (
                  <button type="button" onClick={() => void cancelReservation(product)} disabled={isBusy || product.status !== 'reserved'} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                    {workingKey === `cancel-reservation:${product.id}` ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} {t('inventory.cancelReservation')}
                  </button>
                )}
                {canMarkSold && (
                  <button type="button" onClick={() => openSell(product)} disabled={isBusy || product.status === 'archived' || product.status === 'sold' || product.stockCount <= 0} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><ShoppingCart size={14} /> {t('common.sell')}</button>
                )}
                {canDelete && (
                  <button type="button" onClick={() => void runAction(`archive:${product.id}`, async () => {
                    await catalogRepository.archiveProduct(product.id);
                    publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
                    publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
                    publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
                  })} disabled={isBusy || product.status === 'archived'} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-300 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    {workingKey === `archive:${product.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {t('common.delete')}
                  </button>
                )}
                {canRestore && (
                    <div className="flex flex-col items-start gap-2 lg:items-end">
                    <button
                      type="button"
                      onClick={() => void restoreArchivedProduct(product)}
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
            </article>
          );
        })}
      </div>

      {(createOpen || editProductId || reserveProductId || sellProductId || bulkMode) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex min-h-full items-start justify-center py-3 sm:py-10">
            <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:rounded-3xl sm:p-6">
            {createOpen && (
              <ProductForm
                title={t('inventory.createProduct')}
                draft={createDraft}
                attributes={attributes}
                onChange={setCreateDraft}
                onSubmit={submitCreate}
                onClose={() => setCreateOpen(false)}
                canChangeCategory
                isSaving={workingKey === 'create'}
                canUploadImage={canUploadToStorage}
                isUploadingImage={workingKey === 'upload:create'}
                onImageFileSelected={(file) => uploadImageIntoDraft('create', file)}
              />
            )}
            {editProductId && (
              <ProductForm
                title={t('inventory.editProduct')}
                draft={editDraft}
                attributes={attributes}
                onChange={setEditDraft}
                onSubmit={submitEdit}
                onClose={() => setEditProductId(null)}
                canChangeCategory={false}
                isSaving={workingKey === `edit:${editProductId}`}
                canUploadImage={canUploadToStorage}
                isUploadingImage={workingKey === 'upload:edit'}
                onImageFileSelected={(file) => uploadImageIntoDraft('edit', file)}
              />
            )}
            {reserveProductId && (
              <form onSubmit={submitReserve} className="space-y-4">
                <div className="flex justify-between gap-3"><h2 className="text-lg font-black text-slate-900 sm:text-xl">{t('inventory.reserveProduct')}</h2><button type="button" onClick={() => { setReserveProductId(null); setReservationContext(EMPTY_RESERVATION_CONTEXT); setReserveNote(''); }}><X size={18} /></button></div>
                {actionErrorKey === `reserve:${reserveProductId}` && actionError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {actionError}
                  </div>
                )}
                <input type="datetime-local" value={reserveAtLocal} onChange={(event) => setReserveAtLocal(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
                {renderReservationContextFields('single')}
                <textarea value={reserveNote} onChange={(event) => setReserveNote(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('inventory.sellerComment')} />
                <button type="submit" disabled={workingKey === `reserve:${reserveProductId}`} className="h-11 w-full rounded-xl bg-sky-600 text-white font-semibold disabled:opacity-50">{workingKey === `reserve:${reserveProductId}` ? t('common.saving') : t('inventory.saveReservation')}</button>
              </form>
            )}
            {sellProductId && (
              <form onSubmit={submitSell} className="space-y-4">
                <div className="flex justify-between gap-3"><h2 className="text-lg font-black text-slate-900 sm:text-xl">{t('inventory.markAsSold')}</h2><button type="button" onClick={() => setSellProductId(null)}><X size={18} /></button></div>
                <input type="number" min="0" step="0.01" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('inventory.soldPrice')} />
                <select value={sellChannel} onChange={(event) => setSellChannel(event.target.value as SellChannel)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm">
                  <option value="in_store">{t('sale.inStore')}</option>
                  <option value="online">{t('sale.online')}</option>
                  <option value="as_is">{t('sale.asIs')}</option>
                </select>
                <textarea value={sellNote} onChange={(event) => setSellNote(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('inventory.auditNote')} />
                <button type="submit" disabled={workingKey === `sell:${sellProductId}`} className="h-11 w-full rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50">{workingKey === `sell:${sellProductId}` ? t('common.saving') : t('inventory.confirmSale')}</button>
              </form>
            )}
            {bulkMode && (
              <form onSubmit={submitBulkAction} className="space-y-4">
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
                  <button type="button" onClick={closeBulkModal}>
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-slate-600">
                  {t('inventory.selectedItemsNote', {
                    count: selectedProductIds.length,
                    plural: selectedProductIds.length === 1 ? '' : 's',
                  })}
                </p>
                {bulkMode === 'discount' && (
                  <>
                    <input
                      value={bulkDiscountInput}
                      onChange={(event) => setBulkDiscountInput(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                      placeholder={t('inventory.discountPlaceholder')}
                    />
                    <textarea
                      value={bulkDiscountReason}
                      onChange={(event) => setBulkDiscountReason(event.target.value)}
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
                    <input type="datetime-local" value={reserveAtLocal} onChange={(event) => setReserveAtLocal(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
                    {renderReservationContextFields('bulk')}
                    <textarea value={reserveNote} onChange={(event) => setReserveNote(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('inventory.sellerComment')} />
                  </>
                )}
                {bulkMode === 'cancel-reservation' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {t('inventory.reservedBackNotice')}
                  </div>
                )}
                {bulkMode === 'sell' && (
                  <>
                    <select value={sellChannel} onChange={(event) => setSellChannel(event.target.value as SellChannel)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm">
                      <option value="in_store">{t('sale.inStore')}</option>
                      <option value="online">{t('sale.online')}</option>
                      <option value="as_is">{t('sale.asIs')}</option>
                    </select>
                    <textarea value={sellNote} onChange={(event) => setSellNote(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('inventory.auditNote')} />
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
                    onClick={closeBulkModal}
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
      )}
    </div>
  );
}

export default function AdminInventoryPage() {
  return <AdminInventoryView role="admin" statusView="active" />;
}

function ProductForm({
  title,
  draft,
  attributes,
  onChange,
  onSubmit,
  onClose,
  canChangeCategory,
  isSaving,
  canUploadImage,
  isUploadingImage,
  onImageFileSelected,
}: {
  title: string;
  draft: ProductFormDraft;
  attributes: AttributeDTO[];
  onChange: (next: ProductFormDraft) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  canChangeCategory: boolean;
  isSaving: boolean;
  canUploadImage: boolean;
  isUploadingImage: boolean;
  onImageFileSelected: (file: File) => void | Promise<void>;
}) {
  const { locale, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const images = draft.images.length > 0 ? draft.images : draft.image ? [draft.image] : [];
  const setImages = (nextImages: string[]) => {
    const normalized = nextImages.map((image) => image.trim()).filter(Boolean).slice(0, 5);
    onChange({ ...draft, images: normalized, image: normalized[0] ?? '' });
  };
  const fieldLayoutConfig = loadFieldLayoutConfig();
  const fieldLayoutItems = buildFieldLayoutItems(
    draft.category,
    attributes,
    fieldLayoutConfig
  );
  const categoryOptions = coreFieldOptions(fieldLayoutConfig, 'category')
    .filter((option) => option.value === 'Bicycle' || option.value === 'Parts');
  const driveTypeOptions = (() => {
    const options = coreFieldOptions(fieldLayoutConfig, 'drive_type');
    if (draft.type && !options.some((option) => option.value === draft.type)) {
      return [...options, { label: draft.type, value: draft.type }];
    }
    return options;
  })();

  const updateFieldValue = (attributeId: string, value: string) => {
    onChange({
      ...draft,
      values: {
        ...draft.values,
        [attributeId]: value,
      },
    });
  };

  const changeCategory = (category: ProductCategory) => {
    onChange({
      ...draft,
      category,
      type: category === 'Parts' ? 'Manual' : draft.type,
      values: valuesForCategory(draft.values, category, attributes),
    });
  };

  const renderImageField = () => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      {images[0] && (
        <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <div className="relative h-44 w-full overflow-hidden rounded-xl">
            <ProductImage src={images[0]} alt={t('inventory.primaryProductPreview')} category={draft.category} className="object-cover" />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-600">{t('inventory.primaryImage')}</p>
        </div>
      )}

      {images.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {images.map((image, index) => (
            <div key={`${image}-${index}`} className="rounded-lg border border-slate-200 bg-white p-1">
              <div className="relative h-20 overflow-hidden rounded-md bg-slate-100">
                <ProductImage src={image} alt={t('inventory.productImage', { number: index + 1 })} category={draft.category} className="object-cover" />
              </div>
              <div className="mt-1 grid grid-cols-1 gap-1">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => setImages([image, ...images.filter((_, imageIndex) => imageIndex !== index)])}
                    className="h-7 rounded-md border border-cyan-200 text-xs font-bold text-cyan-700 hover:bg-cyan-50"
                  >
                    {t('inventory.makePrimary')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, imageIndex) => imageIndex !== index))}
                  className="h-7 rounded-md border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  {t('inventory.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canUploadImage ? (
        <div className="text-sm text-slate-700">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            disabled={isUploadingImage || images.length >= 5}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onImageFileSelected(file);
              }
              event.currentTarget.value = '';
            }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isUploadingImage || images.length >= 5}
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {images.length > 0 ? t('inventory.addPhoto') : t('inventory.addFirstPhoto')}
            </button>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => setImages([])}
                className="h-10 px-4 rounded-xl border border-rose-300 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                {t('inventory.removeAll')}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('inventory.imageHelp', { count: images.length })}
          </p>
          {isUploadingImage && (
            <span className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              {t('common.uploading')}
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t('inventory.imageDisabled')}
        </div>
      )}
    </div>
  );

  const renderCustomField = (attribute: AttributeDTO) => {
    const value = draft.values[attribute.id] ?? '';
    if (attribute.inputMode === 'single_select' && attribute.options.length > 0) {
      return (
        <select
          value={value}
          onChange={(event) => updateFieldValue(attribute.id, event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          aria-label={fieldNameLabel(attribute, locale)}
        >
          <option value="">{t('inventory.selectField', { name: fieldNameLabel(attribute, locale) })}</option>
          {attribute.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (attribute.dataType === 'boolean') {
      return (
        <select
          value={value}
          onChange={(event) => updateFieldValue(attribute.id, event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          aria-label={fieldNameLabel(attribute, locale)}
        >
          <option value="">{t('common.unset')}</option>
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </select>
      );
    }

    const inputType =
      attribute.dataType === 'number'
        ? 'number'
        : attribute.dataType === 'date'
        ? 'date'
        : attribute.dataType === 'url' || attribute.dataType === 'image'
        ? 'url'
        : 'text';

    return (
      <input
        type={inputType}
        value={value}
        onChange={(event) => updateFieldValue(attribute.id, event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
        placeholder={attribute.isPublic ? t('inventory.visibleFieldValue') : t('inventory.internalValue')}
        aria-label={fieldNameLabel(attribute, locale)}
      />
    );
  };

  const renderCoreField = (item: Extract<FieldLayoutItem, { kind: 'core' }>) => {
    switch (item.core.key) {
      case 'category':
        return (
          <select value={draft.category} disabled={!canChangeCategory} onChange={(event) => changeCategory(event.target.value as ProductCategory)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm disabled:bg-slate-100">
            {(categoryOptions.length > 0 ? categoryOptions : [
              { label: t('common.bicycle'), value: 'Bicycle' },
              { label: t('common.parts'), value: 'Parts' },
            ]).map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === 'Bicycle' || option.value === 'Parts' ? categoryLabel(option.value, t) : option.label}
              </option>
            ))}
          </select>
        );
      case 'name':
        return <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('common.name')} />;
      case 'drive_type':
        return (
          <select value={draft.type} disabled={draft.category === 'Parts'} onChange={(event) => onChange({ ...draft, type: event.target.value })} className="h-11 rounded-xl border border-slate-300 px-3 text-sm disabled:bg-slate-100">
            {(driveTypeOptions.length > 0 ? driveTypeOptions : [
              { label: t('common.manual'), value: 'Manual' },
              { label: t('common.electrical'), value: 'Electrical' },
            ]).map((option) => (
              <option key={option.value} value={option.value}>
                {driveTypeLabel(option.value, t)}
              </option>
            ))}
          </select>
        );
      case 'serial':
        return <input value={draft.serial} onChange={(event) => onChange({ ...draft, serial: event.target.value })} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('common.serial')} />;
      case 'price':
        return <input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => onChange({ ...draft, price: event.target.value })} className="h-11 rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('common.price')} />;
      case 'stock_count':
        return <input type="number" min="0" step="1" value={draft.stockCount} onChange={(event) => onChange({ ...draft, stockCount: event.target.value })} className="h-11 rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('common.stock')} />;
      case 'discount':
        return (
          <div>
            <input
              value={draft.discountInput}
              onChange={(event) => onChange({ ...draft, discountInput: event.target.value })}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder={t('inventory.discountPlaceholder')}
            />
            <p className="mt-1 text-xs text-slate-500">
              {t('inventory.discountHelp')}
            </p>
          </div>
        );
      case 'image':
        return renderImageField();
      case 'description':
        return <textarea rows={3} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('common.description')} />;
      default:
        return null;
    }
  };

  const renderFieldLayoutItem = (item: FieldLayoutItem) => (
    <div key={item.id}>
      <p className="mb-1 text-xs font-semibold text-slate-500">
        {item.kind === 'core' ? item.core.name : fieldNameLabel(item.field, locale)}
      </p>
      {item.kind === 'core' ? renderCoreField(item) : renderCustomField(item.field)}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-2 flex justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6">
        <h2 className="text-lg font-black text-slate-900 sm:text-xl">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={t('inventory.closeForm')}>
          <X size={18} />
        </button>
      </div>
      {fieldLayoutItems.map(renderFieldLayoutItem)}
      <button type="submit" disabled={isSaving || isUploadingImage} className="h-11 w-full rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-50">{isSaving ? t('common.saving') : isUploadingImage ? t('inventory.uploadingImage') : t('inventory.saveProduct')}</button>
    </form>
  );
}
