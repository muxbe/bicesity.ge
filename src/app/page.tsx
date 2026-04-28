'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bike,
  ChevronDown,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Route,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { buildPublicAttributes, getCurrentPrice, getFallbackImage, type AttributeDTO, type ProductDTO } from '@/features/catalog';
import { PriceDisplay } from '@/features/catalog/components/price-display';
import { useAuth } from '@/features/auth';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { useFocusFreshness } from '@/features/shared/freshness/use-focus-freshness';
import type { ShopBootstrapDTO } from '@/features/shop/shop-bootstrap';
import {
  LanguageSwitcher,
  categoryLabel,
  discountLabel,
  driveTypeLabel,
  fieldNameLabel,
  stockLabel,
  useI18n,
} from '@/lib/i18n';

type CategoryFilter = 'All' | 'Bicycle' | 'Parts';
type StockFilter = 'All' | 'In Stock' | 'Out of Stock';
type BikeTypeFilter = 'All' | string;
type HomeView = 'products' | 'rent';

type FilterState = {
  query: string;
  category: CategoryFilter;
  stock: StockFilter;
  bikeType: BikeTypeFilter;
  minPrice: string;
  maxPrice: string;
  attributeValues: Record<string, string>;
};

const INITIAL_FILTERS: FilterState = {
  query: '',
  category: 'All',
  stock: 'All',
  bikeType: 'All',
  minPrice: '',
  maxPrice: '',
  attributeValues: {},
};

type ShopBootstrapApiResponse = {
  data?: ShopBootstrapDTO;
  error?: string;
};

function accountRoleLabel(role: string | null | undefined, t: (key: string) => string) {
  if (role === 'admin') {
    return t('role.admin');
  }
  if (role === 'seller') {
    return t('role.seller');
  }
  return t('role.customer');
}

function parsePrice(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function fallbackMessengerTargetUrl() {
  return (
    process.env.NEXT_PUBLIC_MESSENGER_TARGET_URL?.trim() ||
    process.env.NEXT_PUBLIC_MESSENGER_URL?.trim() ||
    ''
  );
}

async function loadShopBootstrap(): Promise<ShopBootstrapDTO> {
  const response = await fetch('/api/shop/bootstrap', { cache: 'no-store' });
  const payload = (await response.json().catch(() => null)) as ShopBootstrapApiResponse | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error ?? 'Failed to load shop data.');
  }
  return payload.data;
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

function buildRentMessage(rentUrl: string, t: (key: string) => string) {
  return [
    t('rent.requestLine1'),
    `Link: ${rentUrl}`,
    t('rent.requestLine3'),
  ].join('\n');
}

function sanitizeAttributeValues(
  attributeValues: Record<string, string>,
  category: CategoryFilter,
  attributes: Array<{ id: string; category: 'Bicycle' | 'Parts'; isPublic: boolean }>
) {
  const sanitized: Record<string, string> = {};
  for (const attribute of attributes) {
    if (!attribute.isPublic) {
      continue;
    }
    if (category !== 'All' && attribute.category !== category) {
      continue;
    }
    const value = attributeValues[attribute.id];
    if (value) {
      sanitized[attribute.id] = value;
    }
  }
  return sanitized;
}

function ProductCardImage({ product }: { product: ProductDTO }) {
  const fallback = getFallbackImage(product.category);
  const [imageSrc, setImageSrc] = useState(product.image || fallback);

  useEffect(() => {
    setImageSrc(product.image || fallback);
  }, [fallback, product.image]);

  return (
    <Image
      src={imageSrc}
      alt={product.name}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className="object-cover group-hover:scale-110 transition duration-500"
      onError={() => setImageSrc(fallback)}
    />
  );
}

function RentView({
  onBrowseBicycles,
  onMessageSeller,
  messengerError,
  messengerMessage,
}: {
  onBrowseBicycles: () => void;
  onMessageSeller: () => void;
  messengerError: string | null;
  messengerMessage: string | null;
}) {
  const { t } = useI18n();

  return (
    <section id="rent" className="max-w-7xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid min-h-[calc(100vh-160px)] grid-cols-1 items-center gap-8 lg:min-h-[calc(100vh-190px)] lg:grid-cols-[1.05fr,0.95fr] lg:gap-10">
        <div>
          <p className="mb-4 text-sm font-black uppercase tracking-widest text-emerald-700">
            {t('rent.eyebrow')}
          </p>
          <h1 className="mb-5 max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:mb-6 sm:text-5xl lg:text-6xl">
            {t('rent.title')}
          </h1>
          <p className="mb-6 max-w-2xl text-base leading-7 text-slate-600 sm:mb-8 sm:text-lg sm:leading-8">
            {t('rent.copy')}
          </p>

          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onMessageSeller}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-blue-600 sm:w-auto"
            >
              <MessageCircle className="h-5 w-5" />
              {t('rent.messageSeller')}
            </button>
            <button
              type="button"
              onClick={onBrowseBicycles}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
            >
              <Bike className="h-5 w-5" />
              {t('rent.browseBicycles')}
            </button>
          </div>

          {messengerMessage && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              {messengerMessage}
            </div>
          )}
          {messengerError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {messengerError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-5">
              <MapPin className="mb-4 h-6 w-6 text-blue-600" />
              <h2 className="mb-2 text-base font-black text-slate-950">{t('rent.localPickup')}</h2>
              <p className="text-sm leading-6 text-slate-600">
                {t('rent.localPickupCopy')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-5">
              <Route className="mb-4 h-6 w-6 text-emerald-700" />
              <h2 className="mb-2 text-base font-black text-slate-950">{t('rent.travelRoutes')}</h2>
              <p className="text-sm leading-6 text-slate-600">
                {t('rent.travelRoutesCopy')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-5">
              <MessageCircle className="mb-4 h-6 w-6 text-amber-600" />
              <h2 className="mb-2 text-base font-black text-slate-950">{t('rent.directContact')}</h2>
              <p className="text-sm leading-6 text-slate-600">
                {t('rent.directContactCopy')}
              </p>
            </div>
          </div>
        </div>

        <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:min-h-[420px] sm:rounded-2xl">
          <Image
            src="/product-bicycle.svg"
            alt={t('home.productImageAlt')}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-contain p-6 sm:p-10"
          />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { status, session, user, role, signOut, isBootstrapping, isRefreshing: isAuthRefreshing } = useAuth();
  const canRenderShop = status === 'authenticated' || Boolean(session);
  const [activeView, setActiveView] = useState<HomeView>('products');
  const [draftFilters, setDraftFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [isDetailedOpen, setIsDetailedOpen] = useState(false);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [attributes, setAttributes] = useState<AttributeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messengerUrl, setMessengerUrl] = useState(fallbackMessengerTargetUrl());
  const [rentMessengerError, setRentMessengerError] = useState<string | null>(null);
  const [rentMessengerMessage, setRentMessengerMessage] = useState<string | null>(null);
  const hasLoadedBootstrapRef = useRef(false);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  const loadBootstrapData = useCallback(async (options: { background?: boolean } = {}) => {
    const shouldShowLoader = !options.background || !hasLoadedBootstrapRef.current;

    if (shouldShowLoader) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const nextData = await loadShopBootstrap();
      setProducts(nextData.products);
      setAttributes(nextData.attributes);
      setMessengerUrl(nextData.settings.messengerUrl.trim());
      hasLoadedBootstrapRef.current = true;
    } catch (loadError) {
      if (hasLoadedBootstrapRef.current) {
        return;
      }
      setError(tRef.current('home.failedShopData'));
    } finally {
      if (shouldShowLoader) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  const freshness = useFocusFreshness({
    tags: [CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL],
    onRefresh: () => loadBootstrapData({ background: true }),
  });
  const isRefreshing = freshness.isRefreshing;

  useEffect(() => {
    if (!canRenderShop || typeof window === 'undefined') {
      return;
    }

    const applyHashView = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#rent') {
        setActiveView('rent');
        setIsDetailedOpen(false);
        return;
      }

      const category: CategoryFilter =
        hash === '#bicycles' ? 'Bicycle' : hash === '#components' ? 'Parts' : 'All';
      const nextFilters: FilterState = { ...INITIAL_FILTERS, category };
      setActiveView('products');
      setDraftFilters(nextFilters);
      setAppliedFilters(nextFilters);
      setIsDetailedOpen(false);
    };

    applyHashView();
    window.addEventListener('hashchange', applyHashView);

    return () => {
      window.removeEventListener('hashchange', applyHashView);
    };
  }, [canRenderShop]);

  const visibleAttributes = useMemo(
    () =>
      attributes.filter(
        (attribute) =>
          attribute.isPublic &&
          (draftFilters.category === 'All' || attribute.category === draftFilters.category)
      ),
    [attributes, draftFilters.category]
  );

  const detailedAttributeOptions = useMemo(() => {
    const scopedProducts = products.filter(
      (product) => draftFilters.category === 'All' || product.category === draftFilters.category
    );
    const options: Record<string, string[]> = {};

    for (const attribute of visibleAttributes) {
      if (attribute.inputMode === 'single_select' && attribute.options.length > 0) {
        options[attribute.id] = attribute.options.map((option) => option.value);
        continue;
      }
      const distinctValues = Array.from(
        new Set(
          scopedProducts
            .map((product) => product.values[attribute.id])
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b));
      options[attribute.id] = distinctValues;
    }

    return options;
  }, [draftFilters.category, products, visibleAttributes]);

  const bikeTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((product) => product.category === 'Bicycle')
            .map((product) => product.type)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const minPrice = parsePrice(appliedFilters.minPrice);
    const maxPrice = parsePrice(appliedFilters.maxPrice);
    const normalizedQuery = appliedFilters.query.trim().toLowerCase();

    return products.filter((product) => {
      if (appliedFilters.category !== 'All' && product.category !== appliedFilters.category) {
        return false;
      }

      if (normalizedQuery) {
        const searchableText = [
          product.name,
          product.description,
          product.serial,
          ...Object.values(product.values),
        ]
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(normalizedQuery)) {
          return false;
        }
      }

      if (appliedFilters.stock === 'In Stock' && !product.inStock) {
        return false;
      }

      if (appliedFilters.stock === 'Out of Stock' && product.inStock) {
        return false;
      }

      if (appliedFilters.bikeType !== 'All') {
        if (product.category !== 'Bicycle' || product.type !== appliedFilters.bikeType) {
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

      for (const [attributeId, selectedValue] of Object.entries(appliedFilters.attributeValues)) {
        if (!selectedValue) {
          continue;
        }
        if (product.values[attributeId] !== selectedValue) {
          return false;
        }
      }

      return true;
    });
  }, [appliedFilters, products]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.query.trim()) {
      count += 1;
    }
    if (appliedFilters.category !== 'All') {
      count += 1;
    }
    if (appliedFilters.stock !== 'All') {
      count += 1;
    }
    if (appliedFilters.bikeType !== 'All') {
      count += 1;
    }
    if (parsePrice(appliedFilters.minPrice) !== null) {
      count += 1;
    }
    if (parsePrice(appliedFilters.maxPrice) !== null) {
      count += 1;
    }
    count += Object.values(appliedFilters.attributeValues).filter(Boolean).length;
    return count;
  }, [appliedFilters]);

  const updateDraftFilters = (updates: Partial<FilterState>) => {
    setDraftFilters((current) => ({ ...current, ...updates }));
  };

  const applyFilters = (collapseDetailed: boolean) => {
    setActiveView('products');
    setAppliedFilters(draftFilters);
    if (collapseDetailed) {
      setIsDetailedOpen(false);
    }
  };

  const handleBasicSearch = (event: FormEvent) => {
    event.preventDefault();
    applyFilters(false);
  };

  const handleDetailedSearch = (event: FormEvent) => {
    event.preventDefault();
    applyFilters(true);
  };

  const handleCategoryChange = (value: CategoryFilter) => {
    setDraftFilters((current) => ({
      ...current,
      category: value,
      bikeType: value === 'Parts' ? 'All' : current.bikeType,
      attributeValues: sanitizeAttributeValues(current.attributeValues, value, attributes),
    }));
  };

  const scrollToHomeSection = (sectionId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const showCatalogCategory = (category: CategoryFilter, hash: string) => {
    const nextFilters: FilterState = { ...INITIAL_FILTERS, category };
    setActiveView('products');
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setIsDetailedOpen(false);
    setRentMessengerError(null);
    setRentMessengerMessage(null);

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', hash);
    }
    scrollToHomeSection('explore');
  };

  const showRentView = () => {
    setActiveView('rent');
    setIsDetailedOpen(false);
    setRentMessengerError(null);
    setRentMessengerMessage(null);

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#rent');
    }
    scrollToHomeSection('rent');
  };

  const openMessengerForRent = async () => {
    setRentMessengerError(null);
    setRentMessengerMessage(null);

    const rentUrl =
      typeof window === 'undefined' ? '/#rent' : `${window.location.origin}/#rent`;
    const message = buildRentMessage(rentUrl, t);
    const targetMessengerUrl = buildMessengerUrl(messengerUrl, message);
    if (!targetMessengerUrl) {
      setRentMessengerError(t('rent.messageLinkMissing'));
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      }
      const opened = window.open(targetMessengerUrl, '_blank', 'noopener,noreferrer');
      setRentMessengerMessage(
        opened
          ? t('rent.messageOpened')
          : t('rent.messageCopied')
      );
    } catch (caughtError) {
      setRentMessengerError(
        caughtError instanceof Error ? caughtError.message : t('rent.messageError')
      );
    }
  };

  const navButtonClass = (isActive: boolean) =>
    `text-slate-700 hover:text-blue-600 transition font-medium ${isActive ? 'text-blue-600' : ''}`;
  const mobileNavButtonClass = (isActive: boolean) =>
    `inline-flex h-10 shrink-0 items-center rounded-lg border px-4 text-sm font-bold transition ${
      isActive
        ? 'border-blue-600 bg-blue-600 text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-600'
    }`;

  const logout = async () => {
    await signOut();
    router.replace('/login');
  };

  if (isBootstrapping && !session) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-black text-slate-900 mb-2">{t('common.loadingRequired')}</h1>
          <p className="text-slate-600">{t('common.checkingCatalogAccess')}</p>
        </div>
      </main>
    );
  }

  if (!canRenderShop) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white font-['Plus Jakarta Sans', sans-serif]">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2 text-base font-bold sm:text-xl">
            <Bike className="h-7 w-7 text-blue-600 sm:h-8 sm:w-8" />
            <span className="text-black">VELO</span>
            <span className="text-blue-600">HUB</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <button
              type="button"
              onClick={() => showCatalogCategory('All', '#explore')}
              className={navButtonClass(activeView === 'products' && appliedFilters.category === 'All')}
              aria-pressed={activeView === 'products' && appliedFilters.category === 'All'}
            >
              {t('nav.explore')}
            </button>
            <button
              type="button"
              onClick={() => showCatalogCategory('Bicycle', '#bicycles')}
              className={navButtonClass(activeView === 'products' && appliedFilters.category === 'Bicycle')}
              aria-pressed={activeView === 'products' && appliedFilters.category === 'Bicycle'}
            >
              {t('nav.bicycles')}
            </button>
            <button
              type="button"
              onClick={() => showCatalogCategory('Parts', '#components')}
              className={navButtonClass(activeView === 'products' && appliedFilters.category === 'Parts')}
              aria-pressed={activeView === 'products' && appliedFilters.category === 'Parts'}
            >
              {t('nav.components')}
            </button>
            <button
              type="button"
              onClick={showRentView}
              className={navButtonClass(activeView === 'rent')}
              aria-pressed={activeView === 'rent'}
            >
              {t('nav.rent')}
            </button>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <LanguageSwitcher compact />
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-900">{user?.email ?? t('common.account')}</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {accountRoleLabel(role, t)}
              </p>
            </div>
            {role === 'admin' && (
              <Link
                href="/admin"
                className="hidden h-10 items-center rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800 sm:inline-flex"
              >
                {t('common.admin')}
              </Link>
            )}
            {role === 'seller' && (
              <Link
                href="/seller"
                className="hidden h-10 items-center rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800 sm:inline-flex"
              >
                {t('common.seller')}
              </Link>
            )}
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

        <div className="border-t border-slate-200/70 md:hidden">
          <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => showCatalogCategory('All', '#explore')}
              className={mobileNavButtonClass(activeView === 'products' && appliedFilters.category === 'All')}
              aria-pressed={activeView === 'products' && appliedFilters.category === 'All'}
            >
              {t('nav.explore')}
            </button>
            <button
              type="button"
              onClick={() => showCatalogCategory('Bicycle', '#bicycles')}
              className={mobileNavButtonClass(activeView === 'products' && appliedFilters.category === 'Bicycle')}
              aria-pressed={activeView === 'products' && appliedFilters.category === 'Bicycle'}
            >
              {t('nav.bicycles')}
            </button>
            <button
              type="button"
              onClick={() => showCatalogCategory('Parts', '#components')}
              className={mobileNavButtonClass(activeView === 'products' && appliedFilters.category === 'Parts')}
              aria-pressed={activeView === 'products' && appliedFilters.category === 'Parts'}
            >
              {t('nav.components')}
            </button>
            <button
              type="button"
              onClick={showRentView}
              className={mobileNavButtonClass(activeView === 'rent')}
              aria-pressed={activeView === 'rent'}
            >
              {t('nav.rent')}
            </button>
          </div>
        </div>

        {activeView === 'products' && (
        <div className="border-t border-slate-200/70">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 sm:py-4">
            <form
              onSubmit={handleBasicSearch}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-[1.7fr,1fr,1fr,auto,auto] lg:items-center"
            >
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={draftFilters.query}
                  onChange={(event) => updateDraftFilters({ query: event.target.value })}
                  placeholder={t('home.searchPlaceholder')}
                  className="w-full h-11 border border-slate-200 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <select
                value={draftFilters.category}
                onChange={(event) => handleCategoryChange(event.target.value as CategoryFilter)}
                className="h-11 border border-slate-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="All">{t('home.allCategories')}</option>
                <option value="Bicycle">{t('common.bicycles')}</option>
                <option value="Parts">{t('common.parts')}</option>
              </select>

              <select
                value={draftFilters.stock}
                onChange={(event) => updateDraftFilters({ stock: event.target.value as StockFilter })}
                className="h-11 border border-slate-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="All">{t('home.allStock')}</option>
                <option value="In Stock">{t('common.inStock')}</option>
                <option value="Out of Stock">{t('common.outOfStock')}</option>
              </select>

              <button
                type="button"
                onClick={() => setIsDetailedOpen((current) => !current)}
                className="h-11 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t('home.detailed')}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isDetailedOpen ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>

              <button
                type="submit"
                className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 sm:col-span-2 lg:col-span-1"
              >
                {t('common.search')}
              </button>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <p>
                {isLoading
                  ? t('home.loadingCatalog')
                  : activeFilterCount > 0
                  ? t('home.productsFoundWithFilters', {
                      count: filteredProducts.length,
                      filters: activeFilterCount,
                    })
                  : t('home.productsFound', { count: filteredProducts.length })}
              </p>
              {(isRefreshing || isAuthRefreshing) && (
                <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('common.refreshingBackground')}
                </span>
              )}
            </div>
            {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
          </div>

          <div
            className={`transition-all duration-300 ${
              isDetailedOpen
                ? 'max-h-[80vh] overflow-y-auto border-t border-slate-200/70'
                : 'max-h-0 overflow-hidden'
            }`}
          >
            <div className="max-w-7xl mx-auto bg-white px-4 py-5 sm:px-6 sm:py-6">
              <form onSubmit={handleDetailedSearch}>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">{t('home.bikeType')}</label>
                    <select
                      value={draftFilters.bikeType}
                      onChange={(event) =>
                        updateDraftFilters({ bikeType: event.target.value as BikeTypeFilter })
                      }
                      disabled={draftFilters.category === 'Parts'}
                      className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="All">{t('home.allTypes')}</option>
                      {bikeTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {driveTypeLabel(option, t)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">{t('home.minPrice')}</label>
                    <input
                      type="number"
                      min="0"
                      value={draftFilters.minPrice}
                      onChange={(event) => updateDraftFilters({ minPrice: event.target.value })}
                      placeholder="0"
                      className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">{t('home.maxPrice')}</label>
                    <input
                      type="number"
                      min="0"
                      value={draftFilters.maxPrice}
                      onChange={(event) => updateDraftFilters({ maxPrice: event.target.value })}
                      placeholder="15000"
                      className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">{t('shop.stock')}</label>
                    <select
                      value={draftFilters.stock}
                      onChange={(event) => updateDraftFilters({ stock: event.target.value as StockFilter })}
                      className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="All">{t('home.allStock')}</option>
                      <option value="In Stock">{t('common.inStock')}</option>
                      <option value="Out of Stock">{t('common.outOfStock')}</option>
                    </select>
                  </div>

                  {visibleAttributes.map((attribute) => (
                    <div key={attribute.id}>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">
                        {fieldNameLabel(attribute, locale)}
                      </label>
                      <select
                        value={draftFilters.attributeValues[attribute.id] ?? ''}
                        onChange={(event) =>
                          setDraftFilters((current) => ({
                            ...current,
                            attributeValues: {
                              ...current.attributeValues,
                              [attribute.id]: event.target.value,
                            },
                          }))
                        }
                        className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="">{t('common.any')}</option>
                        {(detailedAttributeOptions[attribute.id] ?? []).map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
                  <button
                    type="submit"
                    className="h-11 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    {t('common.search')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFilters(INITIAL_FILTERS);
                      setAppliedFilters(INITIAL_FILTERS);
                      setIsDetailedOpen(false);
                    }}
                    className="h-11 rounded-xl border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {t('common.clearAll')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        )}
      </nav>

      {activeView === 'rent' ? (
        <RentView
          onBrowseBicycles={() => showCatalogCategory('Bicycle', '#bicycles')}
          onMessageSeller={() => void openMessengerForRent()}
          messengerError={rentMessengerError}
          messengerMessage={rentMessengerMessage}
        />
      ) : (
      <section id="explore" className="max-w-7xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-8 text-4xl font-black text-black sm:mb-12 sm:text-5xl">{t('home.products')}</h1>

        {isLoading ? (
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-10 text-center">
            <p className="text-lg font-semibold text-slate-800 mb-2">{t('home.loadingProducts')}</p>
            <p className="text-slate-600">{t('home.fetchingCatalog')}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-10 text-center">
            <p className="text-lg font-semibold text-slate-800 mb-2">{t('home.noMatchingProducts')}</p>
            <p className="text-slate-600">{t('home.adjustFilters')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <Link key={product.id} href={`/shop/${product.id}`}>
                <div className="group cursor-pointer h-full flex flex-col">
                  <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl bg-slate-100 sm:mb-6 sm:rounded-[2.5rem]">
                    <ProductCardImage product={product} />
                    <div className="absolute top-4 right-4 bg-black/75 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur">
                      {categoryLabel(product.category, t)}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-black mb-2 group-hover:text-blue-600 transition">
                    {product.name}
                  </h3>

                  <PriceDisplay product={product} size="card" discountLabel={discountLabel(product, t)} />

                  <p className="text-slate-600 text-sm mb-4 line-clamp-2">{product.description}</p>

                  {buildPublicAttributes(product, attributes).length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {buildPublicAttributes(product, attributes)
                        .slice(0, 3)
                        .map((attribute) => (
                          <span
                            key={attribute.id}
                            className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-semibold"
                          >
                            {fieldNameLabel(attribute, locale)}: {attribute.value}
                          </span>
                        ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-semibold">
                      {driveTypeLabel(product.type, t)}
                    </span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        product.inStock ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {stockLabel(product.inStock, t)}
                    </span>
                  </div>

                  <span className="mt-auto w-full rounded-xl bg-slate-900 py-3 text-center font-semibold text-white transition hover:bg-black sm:rounded-[1.5rem]">
                    {t('home.viewDetails')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
