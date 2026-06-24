'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BikeCityLogo } from '@/components/bike-city-logo';
import { LogOut } from 'lucide-react';
import { type AttributeDTO, type ProductDTO } from '@/features/catalog';
import { useAuth } from '@/features/auth';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { useFocusFreshness } from '@/features/shared/freshness/use-focus-freshness';
import type { ShopBootstrapDTO } from '@/features/shop/shop-bootstrap';
import { DetailedFilterPanel } from '@/features/shop/home/components/detailed-filter-panel';
import { HomeFilterToolbar } from '@/features/shop/home/components/home-filter-toolbar';
import { ProductGrid } from '@/features/shop/home/components/product-grid';
import { RentView } from '@/features/shop/home/components/rent-view';
import {
  accountRoleLabel,
  buildMessengerUrl,
  buildRentMessage,
  countActiveFilters,
  fallbackMessengerTargetUrl,
  filterProducts,
  sanitizeAttributeValues,
} from '@/features/shop/home/home-helpers';
import {
  INITIAL_FILTERS,
  type CategoryFilter,
  type FilterState,
  type HomeViewMode,
  type ShopBootstrapApiResponse,
} from '@/features/shop/home/home-types';
import { LanguageSwitcher, useI18n } from '@/lib/i18n';

async function loadShopBootstrap(): Promise<ShopBootstrapDTO> {
  const response = await fetch('/api/shop/bootstrap', { cache: 'no-store' });
  const payload = (await response.json().catch(() => null)) as ShopBootstrapApiResponse | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error ?? 'Failed to load shop data.');
  }
  return payload.data;
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { status, session, user, role, signOut, isBootstrapping, isRefreshing: isAuthRefreshing } = useAuth();
  const canRenderShop = status === 'authenticated' || Boolean(session);
  const [activeView, setActiveView] = useState<HomeViewMode>('products');
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

  const filteredProducts = useMemo(() => filterProducts(products, appliedFilters), [appliedFilters, products]);

  const activeFilterCount = useMemo(() => countActiveFilters(appliedFilters), [appliedFilters]);

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
    `text-slate-700 transition hover:text-[var(--brand-cyan-dark)] font-medium ${
      isActive ? 'text-[var(--brand-cyan-dark)]' : ''
    }`;
  const mobileNavButtonClass = (isActive: boolean) =>
    `inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-xs font-bold transition sm:h-10 sm:px-4 sm:text-sm ${
      isActive
        ? 'border-[var(--brand-blue-strong)] bg-[var(--brand-blue-strong)] text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-blue)] hover:text-[var(--brand-cyan-dark)]'
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
    <div className="min-h-screen bg-white font-sans">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/75 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center">
            <BikeCityLogo imageClassName="h-10 w-28 sm:h-14 sm:w-44" priority />
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
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-900">{user?.email ?? t('common.account')}</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {accountRoleLabel(role, t)}
              </p>
            </div>
            <LanguageSwitcher compact className="sm:hidden" />
            <LanguageSwitcher compact className="hidden sm:inline-block" />
            {role === 'admin' && (
              <Link
                href="/admin"
                className="brand-primary hidden h-10 items-center rounded-lg px-3 text-sm font-bold sm:inline-flex"
              >
                {t('common.admin')}
              </Link>
            )}
            {role === 'seller' && (
              <Link
                href="/seller"
                className="brand-primary hidden h-10 items-center rounded-lg px-3 text-sm font-bold sm:inline-flex"
              >
                {t('common.seller')}
              </Link>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              aria-label={t('common.logout')}
              className="brand-control inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold text-slate-700 hover:bg-cyan-50 sm:h-10 sm:text-sm"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">{t('common.logout')}</span>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200/70 md:hidden">
          <div className="max-w-7xl mx-auto flex gap-1.5 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {activeView === "products" && (
          <HomeFilterToolbar
            draftFilters={draftFilters}
            isDetailedOpen={isDetailedOpen}
            isLoading={isLoading}
            isRefreshing={isRefreshing || isAuthRefreshing}
            error={error}
            activeFilterCount={activeFilterCount}
            productCount={filteredProducts.length}
            t={t}
            onQueryChange={(query) => updateDraftFilters({ query })}
            onCategoryChange={handleCategoryChange}
            onStockChange={(stock) => updateDraftFilters({ stock })}
            onToggleDetailed={() => setIsDetailedOpen((current) => !current)}
            onSearch={() => applyFilters(true)}
          />
        )}
      </nav>

      {activeView === "products" && isDetailedOpen && (
        <DetailedFilterPanel
          draftFilters={draftFilters}
          visibleAttributes={visibleAttributes}
          detailedAttributeOptions={detailedAttributeOptions}
          bikeTypeOptions={bikeTypeOptions}
          locale={locale}
          t={t}
          onCategoryChange={handleCategoryChange}
          onStockChange={(stock) => updateDraftFilters({ stock })}
          onBikeTypeChange={(bikeType) => updateDraftFilters({ bikeType })}
          onMinPriceChange={(minPrice) => updateDraftFilters({ minPrice })}
          onMaxPriceChange={(maxPrice) => updateDraftFilters({ maxPrice })}
          onAttributeChange={(attributeId, value) =>
            setDraftFilters((current) => ({
              ...current,
              attributeValues: {
                ...current.attributeValues,
                [attributeId]: value,
              },
            }))
          }
          onApply={() => applyFilters(true)}
          onReset={() => {
            setDraftFilters(INITIAL_FILTERS);
            setAppliedFilters(INITIAL_FILTERS);
            setIsDetailedOpen(false);
          }}
          onClose={() => setIsDetailedOpen(false)}
        />
      )}

      {activeView === 'rent' ? (
        <RentView
          onBrowseBicycles={() => showCatalogCategory('Bicycle', '#bicycles')}
          onMessageSeller={() => void openMessengerForRent()}
          messengerError={rentMessengerError}
          messengerMessage={rentMessengerMessage}
        />
      ) : (
        <ProductGrid
          isLoading={isLoading}
          products={filteredProducts}
          attributes={attributes}
          locale={locale}
          t={t}
        />
      )}
    </div>
  );
}
