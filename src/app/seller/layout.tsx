'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Package, CalendarClock, Lock, User, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { LanguageSwitcher, useI18n } from '@/lib/i18n';

export default function SellerLayout({
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
    { href: '/seller', label: t('admin.nav.inventory'), icon: Package },
    { href: '/seller/reserved', label: t('admin.nav.reservedItems'), icon: CalendarClock },
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (status === 'authenticated' && role !== 'seller' && role !== 'admin') {
      router.replace('/login');
    }
  }, [pathname, role, router, status]);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 size={18} className="animate-spin" />
          {t('seller.checkingAccess')}
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (role !== 'seller' && role !== 'admin')) {
    return null;
  }

  const logout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-white font-['Plus Jakarta Sans'] md:flex">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 flex-col bg-slate-900 text-white xl:flex">
        <div className="p-8 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Lock size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">{t('common.seller').toUpperCase()}</h1>
              <p className="text-xs text-slate-400">HUB</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/seller/reserved'
              ? isActive('/seller/reserved') || isActive('/seller/reservations')
              : isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={20} />
                <span className="font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user?.email ?? t('seller.user')}</p>
              <p className="text-xs text-slate-400">
                {role === 'admin' ? t('seller.adminUsingSellerView') : t('seller.account')}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <LanguageSwitcher compact />
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut size={16} />
            {t('common.signOut')}
          </button>
        </div>
      </aside>

      <aside className="fixed left-0 top-0 hidden h-screen w-24 flex-col items-center bg-slate-900 text-white md:flex xl:hidden">
        <div className="flex h-20 w-full items-center justify-center border-b border-slate-800">
          <div className="rounded-xl bg-blue-600 p-2" title={`${t('common.seller')} HUB`}>
            <Lock size={20} />
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/seller/reserved'
              ? isActive('/seller/reserved') || isActive('/seller/reservations')
              : isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
              </Link>
            );
          })}
        </nav>

        <div className="flex w-full shrink-0 flex-col items-center gap-3 border-t border-slate-800 px-2 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600" title={user?.email ?? t('seller.user')}>
            <User size={20} />
          </div>
          <LanguageSwitcher compact />
          <button
            type="button"
            onClick={() => void logout()}
            title={t('common.signOut')}
            aria-label={t('common.signOut')}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-white md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-blue-600 p-2">
              <Lock size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight">{t('common.seller').toUpperCase()} HUB</h1>
              <p className="truncate text-[11px] text-slate-400">{user?.email ?? t('seller.user')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={() => void logout()}
              aria-label={t('common.signOut')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/seller/reserved'
              ? isActive('/seller/reserved') || isActive('/seller/reservations')
              : isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="min-h-screen flex-1 md:ml-24 xl:ml-72 xl:h-screen xl:overflow-y-auto">
        <div className="p-4 sm:p-6 xl:p-10">{children}</div>
      </div>
    </div>
  );
}
