'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { DetailedFilterPanel } from '@/features/shop/home/components/detailed-filter-panel';
import { HomeFilterToolbar } from '@/features/shop/home/components/home-filter-toolbar';
import { HomeNavigation } from '@/features/shop/home/components/home-navigation';
import { ProductGrid } from '@/features/shop/home/components/product-grid';
import { RentView } from '@/features/shop/home/components/rent-view';
import { useHomeCatalog } from '@/features/shop/home/hooks/use-home-catalog';
import {
  buildMessengerUrl,
  buildRentMessage,
  countActiveFilters,
  filterProducts,
  sanitizeAttributeValues,
} from '@/features/shop/home/home-helpers';
import {
  INITIAL_FILTERS,
  type CategoryFilter,
  type FilterState,
  type HomeViewMode,
} from '@/features/shop/home/home-types';
import { useI18n } from '@/lib/i18n';

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
  const catalog = useHomeCatalog(t);
  const {
    products,
    attributes,
    messengerUrl,
    isLoading,
    isRefreshing,
    error,
  } = catalog;
  const [rentMessengerError, setRentMessengerError] = useState<string | null>(null);
  const [rentMessengerMessage, setRentMessengerMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);
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
        <HomeNavigation
          activeView={activeView}
          activeCategory={appliedFilters.category}
          email={user?.email ?? t("common.account")}
          role={role}
          t={t}
          onExplore={() => showCatalogCategory("All", "#explore")}
          onBicycles={() => showCatalogCategory("Bicycle", "#bicycles")}
          onComponents={() => showCatalogCategory("Parts", "#components")}
          onRent={showRentView}
          onLogout={() => void logout()}
        />

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
