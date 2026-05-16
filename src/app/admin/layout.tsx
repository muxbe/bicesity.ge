'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Package, SlidersHorizontal, BarChart3, CalendarClock, User, ShoppingCart, Trash2, LogOut, Loader2, Users, Settings } from 'lucide-react';
import { BikeCityLogo } from '@/components/bike-city-logo';
import { useAuth } from '@/features/auth';
import { LanguageSwitcher, useI18n } from '@/lib/i18n';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { status, user, role, signOut, isBootstrapping } = useAuth();

  const isActive = (path: string) => pathname === path;
  const navItems = [
    { href: '/admin', label: t('admin.nav.inventory'), icon: Package },
    { href: '/admin/fields', label: t('admin.nav.fieldSettings'), icon: SlidersHorizontal },
    { href: '/admin/reserved', label: t('admin.nav.reservedItems'), icon: CalendarClock },
    { href: '/admin/sold', label: t('admin.nav.soldItems'), icon: ShoppingCart },
    { href: '/admin/deleted', label: t('admin.nav.deletedItems'), icon: Trash2 },
    { href: '/admin/reports', label: t('admin.nav.salesReports'), icon: BarChart3 },
    { href: '/admin/staff', label: t('admin.nav.staffUsers'), icon: Users },
    { href: '/admin/settings', label: t('admin.nav.settings'), icon: Settings },
    { href: '/admin/reservations', label: t('admin.nav.reservationHistory'), icon: CalendarClock },
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (status === 'authenticated' && role !== 'admin') {
      router.replace(role === 'seller' ? '/seller' : '/login');
    }
  }, [pathname, role, router, status]);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 size={18} className="animate-spin" />
          {t('admin.checkingAccess')}
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || role !== 'admin') {
    return null;
  }

  const logout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-white font-['Plus Jakarta Sans'] md:flex">
      {/* Sidebar */}
      <aside className="brand-sidebar fixed left-0 top-0 hidden h-screen w-72 flex-col xl:flex">
        {/* Top Section - Branding */}
        <div className="shrink-0 border-b border-white/10 p-6">
          <div className="flex items-center gap-4">
            <BikeCityLogo imageClassName="h-16 w-28" priority />
            <div>
              <h1 className="text-lg font-black tracking-tight">{t('common.admin').toUpperCase()}</h1>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-200">Bike City</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="min-h-0 flex-1 overflow-y-auto p-6 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive(item.href)
                    ? 'brand-sidebar-active'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={20} />
                <span className="font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section - Admin Avatar */}
        <div className="shrink-0 border-t border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-blue)] text-[var(--brand-navy)]">
              <User size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user?.email ?? t('admin.user')}</p>
              <p className="text-xs text-slate-400">{t('admin.account')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/15 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
            {t('common.signOut')}
          </button>
        </div>
      </aside>

      <aside className="brand-sidebar fixed left-0 top-0 hidden h-screen w-24 flex-col items-center md:flex xl:hidden">
        <div className="flex h-20 w-full items-center justify-center border-b border-white/10">
          <BikeCityLogo imageClassName="h-12 w-16" priority />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200 ${
                  isActive(item.href)
                    ? 'brand-sidebar-active'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
              </Link>
            );
          })}
        </nav>

        <div className="flex w-full shrink-0 flex-col items-center gap-3 border-t border-white/10 px-2 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-blue)] text-[var(--brand-navy)]" title={user?.email ?? t('admin.user')}>
            <User size={20} />
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            title={t('common.signOut')}
            aria-label={t('common.signOut')}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <header className="brand-sidebar sticky top-0 z-40 border-b border-white/10 md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BikeCityLogo imageClassName="h-11 w-16" priority />
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight">{t('common.admin').toUpperCase()} HUB</h1>
              <p className="truncate text-[11px] text-slate-400">{user?.email ?? t('admin.user')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void logout()}
              aria-label={t('common.signOut')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition ${
                  isActive(item.href)
                    ? 'border-transparent brand-sidebar-active'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <div className="min-h-screen flex-1 md:ml-24 xl:ml-72 xl:h-screen xl:overflow-y-auto">
        <div className="p-4 sm:p-6 xl:p-10">
          <div className="relative z-[90] mb-5 flex justify-end">
            <LanguageSwitcher compact />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
