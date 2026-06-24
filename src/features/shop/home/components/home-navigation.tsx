import Link from "next/link";
import { LogOut } from "lucide-react";
import { BikeCityLogo } from "@/components/bike-city-logo";
import { accountRoleLabel } from "@/features/shop/home/home-helpers";
import type {
  CategoryFilter,
  HomeViewMode,
  Translate,
} from "@/features/shop/home/home-types";
import { LanguageSwitcher } from "@/lib/i18n";

export type HomeNavigationProps = {
  activeView: HomeViewMode;
  activeCategory: CategoryFilter;
  email: string;
  role: string | null;
  t: Translate;
  onExplore: () => void;
  onBicycles: () => void;
  onComponents: () => void;
  onRent: () => void;
  onLogout: () => void;
};

export function HomeNavigation({
  activeView,
  activeCategory,
  email,
  role,
  t,
  onExplore,
  onBicycles,
  onComponents,
  onRent,
  onLogout,
}: HomeNavigationProps) {
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

  return (
    <>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-4">
        <Link href="/" className="flex items-center">
          <BikeCityLogo imageClassName="h-10 w-28 sm:h-14 sm:w-44" priority />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <button
            type="button"
            onClick={onExplore}
            className={navButtonClass(activeView === 'products' && activeCategory === 'All')}
            aria-pressed={activeView === 'products' && activeCategory === 'All'}
          >
            {t('nav.explore')}
          </button>
          <button
            type="button"
            onClick={onBicycles}
            className={navButtonClass(activeView === 'products' && activeCategory === 'Bicycle')}
            aria-pressed={activeView === 'products' && activeCategory === 'Bicycle'}
          >
            {t('nav.bicycles')}
          </button>
          <button
            type="button"
            onClick={onComponents}
            className={navButtonClass(activeView === 'products' && activeCategory === 'Parts')}
            aria-pressed={activeView === 'products' && activeCategory === 'Parts'}
          >
            {t('nav.components')}
          </button>
          <button
            type="button"
            onClick={onRent}
            className={navButtonClass(activeView === 'rent')}
            aria-pressed={activeView === 'rent'}
          >
            {t('nav.rent')}
          </button>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-900">{email}</p>
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
            onClick={onLogout}
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
            onClick={onExplore}
            className={mobileNavButtonClass(activeView === 'products' && activeCategory === 'All')}
            aria-pressed={activeView === 'products' && activeCategory === 'All'}
          >
            {t('nav.explore')}
          </button>
          <button
            type="button"
            onClick={onBicycles}
            className={mobileNavButtonClass(activeView === 'products' && activeCategory === 'Bicycle')}
            aria-pressed={activeView === 'products' && activeCategory === 'Bicycle'}
          >
            {t('nav.bicycles')}
          </button>
          <button
            type="button"
            onClick={onComponents}
            className={mobileNavButtonClass(activeView === 'products' && activeCategory === 'Parts')}
            aria-pressed={activeView === 'products' && activeCategory === 'Parts'}
          >
            {t('nav.components')}
          </button>
          <button
            type="button"
            onClick={onRent}
            className={mobileNavButtonClass(activeView === 'rent')}
            aria-pressed={activeView === 'rent'}
          >
            {t('nav.rent')}
          </button>
        </div>
      </div>
    </>
  );
}
