'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { DetailedFilterPanel } from '@/features/shop/home/components/detailed-filter-panel';
import { HomeFilterToolbar } from '@/features/shop/home/components/home-filter-toolbar';
import { HomeNavigation } from '@/features/shop/home/components/home-navigation';
import { ProductGrid } from '@/features/shop/home/components/product-grid';
import { RentView } from '@/features/shop/home/components/rent-view';
import { useHomeCatalog } from '@/features/shop/home/hooks/use-home-catalog';
import { useHomeFilters } from '@/features/shop/home/hooks/use-home-filters';
import { useRentMessenger } from '@/features/shop/home/hooks/use-rent-messenger';
import {
  type CategoryFilter,
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
  const catalog = useHomeCatalog(t);
  const {
    products,
    attributes,
    messengerUrl,
    isLoading,
    isRefreshing,
    error,
  } = catalog;
  const filters = useHomeFilters(products, attributes);
  const { closeDetailedFilters, selectCatalogCategory } = filters;
  const rentMessenger = useRentMessenger(messengerUrl, t);

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
        closeDetailedFilters();
        return;
      }

      const category: CategoryFilter =
        hash === '#bicycles' ? 'Bicycle' : hash === '#components' ? 'Parts' : 'All';
      setActiveView('products');
      selectCatalogCategory(category);
    };

    applyHashView();
    window.addEventListener('hashchange', applyHashView);

    return () => {
      window.removeEventListener('hashchange', applyHashView);
    };
  }, [canRenderShop, closeDetailedFilters, selectCatalogCategory]);

  const scrollToHomeSection = (sectionId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const showCatalogCategory = (category: CategoryFilter, hash: string) => {
    setActiveView('products');
    selectCatalogCategory(category);
    rentMessenger.clearRentMessengerNotices();

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', hash);
    }
    scrollToHomeSection('explore');
  };

  const showRentView = () => {
    setActiveView('rent');
    closeDetailedFilters();
    rentMessenger.clearRentMessengerNotices();

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#rent');
    }
    scrollToHomeSection('rent');
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
          activeCategory={filters.appliedFilters.category}
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
            draftFilters={filters.draftFilters}
            isDetailedOpen={filters.isDetailedOpen}
            isLoading={isLoading}
            isRefreshing={isRefreshing || isAuthRefreshing}
            error={error}
            activeFilterCount={filters.activeFilterCount}
            productCount={filters.filteredProducts.length}
            t={t}
            onQueryChange={(query) => filters.updateDraftFilters({ query })}
            onCategoryChange={filters.handleCategoryChange}
            onStockChange={(stock) => filters.updateDraftFilters({ stock })}
            onToggleDetailed={filters.toggleDetailedFilters}
            onSearch={filters.applyFilters}
          />
        )}
      </nav>

      {activeView === "products" && filters.isDetailedOpen && (
        <DetailedFilterPanel
          draftFilters={filters.draftFilters}
          visibleAttributes={filters.visibleAttributes}
          detailedAttributeOptions={filters.detailedAttributeOptions}
          bikeTypeOptions={filters.bikeTypeOptions}
          locale={locale}
          t={t}
          onCategoryChange={filters.handleCategoryChange}
          onStockChange={(stock) => filters.updateDraftFilters({ stock })}
          onBikeTypeChange={(bikeType) => filters.updateDraftFilters({ bikeType })}
          onMinPriceChange={(minPrice) => filters.updateDraftFilters({ minPrice })}
          onMaxPriceChange={(maxPrice) => filters.updateDraftFilters({ maxPrice })}
          onAttributeChange={filters.updateAttributeFilter}
          onApply={filters.applyFilters}
          onReset={filters.resetFilters}
          onClose={filters.closeDetailedFilters}
        />
      )}

      {activeView === 'rent' ? (
        <RentView
          onBrowseBicycles={() => showCatalogCategory('Bicycle', '#bicycles')}
          onMessageSeller={() => void rentMessenger.openMessengerForRent()}
          messengerError={rentMessenger.messengerError}
          messengerMessage={rentMessenger.messengerMessage}
        />
      ) : (
        <ProductGrid
          isLoading={isLoading}
          products={filters.filteredProducts}
          attributes={attributes}
          locale={locale}
          t={t}
        />
      )}
    </div>
  );
}
