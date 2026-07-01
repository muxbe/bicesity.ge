'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { DetailedFilterPanel } from '@/features/shop/home/components/detailed-filter-panel';
import { HomeFilterToolbar } from '@/features/shop/home/components/home-filter-toolbar';
import { HomeNavigation } from '@/features/shop/home/components/home-navigation';
import { ProductGrid } from '@/features/shop/home/components/product-grid';
import { RentView } from '@/features/shop/home/components/rent-view';
import { useHomeCatalog } from '@/features/shop/home/hooks/use-home-catalog';
import { useHomeFilters } from '@/features/shop/home/hooks/use-home-filters';
import { useHomeNavigation } from '@/features/shop/home/hooks/use-home-navigation';
import { useRentMessenger } from '@/features/shop/home/hooks/use-rent-messenger';
import { useI18n } from '@/lib/i18n';

export function HomeView() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { status, session, user, role, signOut, isBootstrapping, isRefreshing: isAuthRefreshing } = useAuth();
  const canRenderShop = status === 'authenticated' || Boolean(session);
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
  const rentMessenger = useRentMessenger(messengerUrl, t);
  const navigation = useHomeNavigation({
    canRenderShop,
    onHashCategory: filters.selectCatalogCategory,
    onCloseDetailedFilters: filters.closeDetailedFilters,
    onClearRentNotices: rentMessenger.clearRentMessengerNotices,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);
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
          activeView={navigation.activeView}
          activeCategory={filters.appliedFilters.category}
          email={user?.email ?? t("common.account")}
          role={role}
          t={t}
          onExplore={() => navigation.showCatalogCategory("All", "#explore")}
          onBicycles={() => navigation.showCatalogCategory("Bicycle", "#bicycles")}
          onComponents={() => navigation.showCatalogCategory("Parts", "#components")}
          onRent={navigation.showRentView}
          onLogout={() => void logout()}
        />

        {navigation.activeView === "products" && (
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

      {navigation.activeView === "products" && filters.isDetailedOpen && (
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

      {navigation.activeView === 'rent' ? (
        <RentView
          onBrowseBicycles={() => navigation.showCatalogCategory('Bicycle', '#bicycles')}
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
