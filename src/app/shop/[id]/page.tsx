'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Zap, Bike, LogOut, Loader2 } from 'lucide-react';
import { formatGel, getCatalogRepository, getFallbackImage, type AttributeDTO, type ProductDTO } from '@/features/catalog';
import { useAuth } from '@/features/auth';
import { buildFieldLayoutItems, type FieldLayoutItem } from '@/features/fields/field-layout';
import { useFieldLayout } from '@/features/fields';
import { DEFAULT_APP_SETTINGS, type AppSettingsDTO } from '@/lib/settings';
import {
  LanguageSwitcher,
  categoryLabel,
  discountLabel as translatedDiscountLabel,
  driveTypeLabel,
  fieldNameLabel,
  useI18n,
} from '@/lib/i18n';

type DetailAttribute = {
  id: string;
  name: string;
  value: string;
  isPublic: boolean;
};

type KeySpec = {
  id: string;
  name: string;
  value: string;
};

const MATRIX_EXCLUDED_DETAIL_IDS = new Set([
  'core:name',
  'core:price',
  'core:discount',
  'core:image',
  'core:description',
  'core:stock_count',
]);

function normalizedDetailName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findDetailAttribute(attributes: DetailAttribute[], terms: string[]) {
  return attributes.find((attribute) => {
    const normalizedName = normalizedDetailName(attribute.name);
    return terms.some((term) => normalizedName.includes(term));
  });
}

function keySpecFromAttribute(
  attribute: DetailAttribute | undefined,
  fallback: KeySpec
): KeySpec {
  if (!attribute) {
    return fallback;
  }

  return {
    id: attribute.id,
    name: attribute.name,
    value: attribute.value,
  };
}

function coreDetailValue(
  product: ProductDTO,
  item: Extract<FieldLayoutItem, { kind: 'core' }>,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  switch (item.core.key) {
    case 'category':
      return categoryLabel(product.category, t);
    case 'name':
      return product.name;
    case 'drive_type':
      return product.category === 'Bicycle' ? driveTypeLabel(product.type, t) : t('common.notUsedForParts');
    case 'serial':
      return product.serial;
    case 'price':
      return formatGel(product.price);
    case 'discount':
      return translatedDiscountLabel(product, t) ?? t('common.noDiscount');
    case 'stock_count':
      return String(product.stockCount);
    case 'image':
      return product.images.length > 0
        ? `${product.images.length} ${product.images.length === 1 ? t('common.photo') : t('common.photos')}`
        : t('common.fallbackImageOnly');
    case 'description':
      return product.description || t('common.notSet');
    default:
      return t('common.notSet');
  }
}

type SettingsApiResponse = {
  data?: AppSettingsDTO;
  error?: string;
};

function fallbackMessengerTargetUrl() {
  return (
    process.env.NEXT_PUBLIC_MESSENGER_TARGET_URL?.trim() ||
    process.env.NEXT_PUBLIC_MESSENGER_URL?.trim() ||
    ''
  );
}

async function loadAppSettings(): Promise<AppSettingsDTO> {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as SettingsApiResponse | null;
    if (!response.ok || !payload?.data) {
      throw new Error(payload?.error ?? 'Failed to load settings.');
    }
    return payload.data;
  } catch {
    return {
      ...DEFAULT_APP_SETTINGS,
      messengerUrl: fallbackMessengerTargetUrl(),
    };
  }
}

function buildItemMessage(
  product: ProductDTO,
  itemUrl: string,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  return [
    t('shop.itemMessageLine1', { name: product.name }),
    `Link: ${itemUrl}`,
    `Price: ${formatGel(product.discountedPrice ?? product.price)}`,
    `Serial: ${product.serial}`,
  ].join('\n');
}

function buildMessengerUrl(targetUrl: string, message: string) {
  if (!targetUrl) {
    return null;
  }

  try {
    const url = new URL(targetUrl);
    url.searchParams.set('text', message);
    return url.toString();
  } catch {
    return null;
  }
}

function ProductDetailImage({
  product,
  src,
}: {
  product: ProductDTO;
  src: string;
}) {
  const fallback = getFallbackImage(product.category);
  const [imageSrc, setImageSrc] = useState(src || fallback);

  useEffect(() => {
    setImageSrc(src || fallback);
  }, [fallback, src]);

  return (
    <Image
      src={imageSrc}
      alt={product.name}
      width={600}
      height={600}
      className="w-full h-full object-cover"
      priority
      onError={() => setImageSrc(fallback)}
    />
  );
}

function ProductGallery({ product }: { product: ProductDTO }) {
  const { t } = useI18n();
  const images = product.images.length > 0 ? product.images : [product.image].filter(Boolean);
  const [selectedImage, setSelectedImage] = useState(images[0] ?? product.image);

  useEffect(() => {
    setSelectedImage(images[0] ?? product.image);
  }, [images, product.image]);

  return (
    <div>
      <div className="mb-4 aspect-square overflow-hidden rounded-3xl bg-slate-100 shadow-xl sm:rounded-[4rem] sm:shadow-2xl">
        <ProductDetailImage product={product} src={selectedImage} />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 mb-8">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setSelectedImage(image)}
              className={`relative aspect-square overflow-hidden rounded-xl border bg-slate-100 ${
                selectedImage === image ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-slate-200'
              }`}
              aria-label={t('shop.viewProductImage', { number: index + 1 })}
            >
              <ProductDetailImage product={product} src={image} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const tRef = useRef(t);
  const { status, user, role, signOut, isBootstrapping, isRefreshing: isAuthRefreshing } = useAuth();
  const isStaff = role === 'admin' || role === 'seller';
  const { config: fieldLayoutConfig } = useFieldLayout({ enabled: isStaff });
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [attributes, setAttributes] = useState<AttributeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messengerUrl, setMessengerUrl] = useState(fallbackMessengerTargetUrl());
  const [messengerError, setMessengerError] = useState<string | null>(null);
  const [messengerMessage, setMessengerMessage] = useState<string | null>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let isMounted = true;
    const repository = getCatalogRepository();
    setIsLoading(true);
    setError(null);

    Promise.all([repository.getProductById(productId), repository.listAttributes(), loadAppSettings()])
      .then(([nextProduct, nextAttributes, nextSettings]) => {
        if (!isMounted) {
          return;
        }
        setProduct(nextProduct);
        setAttributes(nextAttributes);
        setMessengerUrl(nextSettings.messengerUrl.trim());
      })
      .catch((caughtError: unknown) => {
        if (!isMounted) {
          return;
        }
        setProduct(null);
        setError(caughtError instanceof Error ? caughtError.message : tRef.current('shop.failedProductDetails'));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId, status]);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black mb-4">{t('common.loadingRequired')}</h1>
          <p className="text-slate-600">{t('common.checkingProductAccess')}</p>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-black sm:text-3xl">{t('shop.loadingProduct')}</h1>
          <p className="text-slate-600">{t('home.fetchingCatalog')}</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-black sm:text-3xl">{t('shop.productNotFound')}</h1>
          {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
          <Link href={role === 'seller' ? '/seller' : role === 'admin' ? '/admin' : '/'} className="text-[var(--brand-cyan-dark)] hover:underline font-semibold">
            {t('shop.backToInventory')}
          </Link>
        </div>
      </div>
    );
  }

  const backHref = isStaff ? (role === 'seller' ? '/seller' : '/admin') : '/';
  const backLabel = isStaff ? t('shop.backToInventory') : t('shop.backToCatalog');
  const detailAttrs: DetailAttribute[] = buildFieldLayoutItems(
    product.category,
    attributes,
    fieldLayoutConfig
  )
    .filter((item) => isStaff || item.isPublic)
    .flatMap((item) => {
      if (item.kind === 'core') {
        return [
          {
            id: item.id,
            name: item.core.name,
            value: coreDetailValue(product, item, t),
            isPublic: item.isPublic,
          },
        ];
      }

      const value = product.values[item.field.id];
      if (!isStaff && !value) {
        return [];
      }

      return [
        {
          id: item.field.id,
          name: fieldNameLabel(item.field, locale),
          value: value || t('common.notSet'),
          isPublic: item.isPublic,
        },
      ];
    });
  const frameSpec = findDetailAttribute(detailAttrs, ['frame']) ?? findDetailAttribute(detailAttrs, ['material']);
  const groupsetSpec = findDetailAttribute(detailAttrs, ['groupset']) ?? findDetailAttribute(detailAttrs, ['compatibility']);
  const batterySpec = findDetailAttribute(detailAttrs, ['battery', 'range']);
  const wheelSpec = findDetailAttribute(detailAttrs, ['wheel']);
  const rideSpec = product.type === 'Electrical' ? batterySpec ?? wheelSpec : wheelSpec ?? batterySpec;
  const keySpecs: KeySpec[] = [
    keySpecFromAttribute(frameSpec, {
      id: 'fallback:category',
      name: t('common.category'),
      value: categoryLabel(product.category, t),
    }),
    keySpecFromAttribute(groupsetSpec, {
      id: 'fallback:drive-type',
      name: t('shop.configuration'),
      value: product.type ? driveTypeLabel(product.type, t) : categoryLabel(product.category, t),
    }),
    keySpecFromAttribute(rideSpec, {
      id: 'fallback:serial',
      name: t('common.serial'),
      value: product.serial,
    }),
    {
      id: 'core:stock_count',
      name: t('shop.stock'),
      value: product.inStock ? `${t('common.inStock')} (${product.stockCount})` : t('common.preOrder'),
    },
  ];
  const keySpecIds = new Set(keySpecs.map((spec) => spec.id));
  const matrixDetails = [
    ...detailAttrs.filter((attribute) => (
      !keySpecIds.has(attribute.id) &&
      !MATRIX_EXCLUDED_DETAIL_IDS.has(attribute.id)
    )),
    ...(isStaff
      ? [{
          id: 'product:status',
          name: t('staff.status'),
          value: product.status,
          isPublic: false,
        }]
      : []),
  ];
  const currentPrice = formatGel(product.discountedPrice ?? product.price);
  const originalPrice = product.discountedPrice !== null ? formatGel(product.price) : null;
  const currentDiscountLabel = translatedDiscountLabel(product, t) ?? product.discountLabel;
  const typeColor = product.type === 'Electrical' ? 'bg-amber-500' : 'bg-slate-900';

  const logout = async () => {
    await signOut();
    router.replace('/login');
  };

  const openMessengerForItem = async () => {
    if (!product) {
      return;
    }

    setMessengerError(null);
    setMessengerMessage(null);
    const itemUrl =
      typeof window === 'undefined'
        ? `/shop/${product.id}`
        : `${window.location.origin}/shop/${product.id}`;
    const message = buildItemMessage(product, itemUrl, t);
    const targetMessengerUrl = buildMessengerUrl(messengerUrl, message);
    if (!targetMessengerUrl) {
      setMessengerError(t('shop.messageLinkMissing'));
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      }
      const opened = window.open(targetMessengerUrl, '_blank', 'noopener,noreferrer');
      setMessengerMessage(
        opened
          ? t('shop.itemMessageCopiedOpened')
          : t('shop.itemMessageCopied')
      );
    } catch (caughtError) {
      setMessengerError(
        caughtError instanceof Error ? caughtError.message : t('shop.messageError')
      );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-[var(--brand-cyan-dark)] sm:text-base"
          >
            <ChevronLeft className="w-5 h-5" />
            {backLabel}
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthRefreshing && (
              <span className="hidden items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500 sm:inline-flex">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('common.refreshingAccess')}
              </span>
            )}
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-900">{user?.email ?? t('common.account')}</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {role === 'admin' ? t('role.admin') : role === 'seller' ? t('role.seller') : t('role.user')}
              </p>
            </div>
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={() => void logout()}
              aria-label={t('common.logout')}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:h-10 sm:text-sm"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">{t('common.logout')}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Product Detail */}
      <section className="max-w-7xl mx-auto grid grid-cols-1 gap-7 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] lg:gap-12 lg:py-12">
        {/* Left Column - Image */}
        <ProductGallery product={product} />

        {/* Right Column - Details */}
        <div className="flex flex-col py-0 lg:py-2">
          {/* Type Badges */}
          <div className="mb-4 flex flex-wrap gap-2 sm:gap-3">
            {product.type && (
              <span className={`${typeColor} flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase text-white sm:px-5`}>
                {product.type === 'Electrical' ? <Zap size={12} fill="currentColor" /> : <Bike size={12} />}
                {driveTypeLabel(product.type, t)}
              </span>
            )}
            <span className="rounded-full bg-cyan-50 px-4 py-2 text-[10px] font-black uppercase text-cyan-700 sm:px-5">
              {categoryLabel(product.category, t)}
            </span>
            {isStaff && (
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase text-emerald-700 sm:px-5">
                {product.status}
              </span>
            )}
          </div>

          {/* Product Name */}
          <h1 className="mb-3 break-words text-4xl font-black leading-tight text-slate-900 sm:text-5xl lg:text-6xl lg:leading-none">
            {product.name}
          </h1>

          {/* Description */}
          <p className="mb-5 text-base leading-7 text-slate-500 sm:text-lg sm:leading-relaxed">{product.description}</p>
          {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

          {/* A1 compact price/action bar */}
          <div className="mb-4 grid gap-4 rounded-2xl bg-slate-950 p-4 text-white shadow-2xl shadow-slate-900/20 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-[10px] font-black uppercase text-white/60">{t('common.price')}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                {originalPrice && (
                  <span className="text-sm font-bold text-white/45 line-through sm:text-base">
                    {originalPrice}
                  </span>
                )}
                <span className="text-3xl font-black text-amber-300 sm:text-4xl">
                  {currentPrice}
                </span>
              </div>
              {currentDiscountLabel && (
                <span className="mt-2 inline-flex rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-black text-rose-100">
                  {currentDiscountLabel}
                </span>
              )}
            </div>
            {isStaff ? (
              <Link
                href={backHref}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
              >
                {t('shop.useInventoryActions')}
              </Link>
            ) : product.status === 'active' && product.inStock ? (
              <button
                type="button"
                onClick={() => void openMessengerForItem()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
              >
                {t('shop.messageSeller')}
              </button>
            ) : null}
          </div>

          <div className="detail-key-specs mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {keySpecs.map((spec) => (
              <div
                key={spec.id}
                className="rounded-xl border border-cyan-100 border-t-4 border-t-cyan-400 bg-white p-3 shadow-sm"
              >
                <p className="mb-1 text-[10px] font-black uppercase text-slate-400">{spec.name}</p>
                <p className="break-words text-sm font-black leading-snug text-slate-900">{spec.value}</p>
              </div>
            ))}
          </div>

          <div className="detail-spec-grid mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {matrixDetails.map((attr) => (
              <div
                key={attr.id}
                className="detail-spec-cell rounded-xl border border-cyan-100 bg-gradient-to-b from-white to-cyan-50/40 p-3 shadow-sm"
              >
                <p className={`mb-1 text-[10px] font-black uppercase ${
                  attr.isPublic ? 'text-slate-400' : 'text-amber-500'
                }`}>
                  {attr.name}
                  {isStaff && !attr.isPublic && <span className="ml-1">({t('common.internal')})</span>}
                </p>
                <p className="break-words text-sm font-black leading-snug text-slate-900">{attr.value}</p>
              </div>
            ))}
            {matrixDetails.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                {t('shop.noCustomDetails')}
              </p>
            )}
          </div>

          {messengerMessage && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              {messengerMessage}
            </div>
          )}
          {messengerError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {messengerError}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
