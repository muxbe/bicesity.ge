"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, LogOut, Package, ShoppingCart, User } from "lucide-react";
import { BikeCityLogo } from "@/components/bike-city-logo";
import { useAuth } from "@/features/auth";
import type { AppRole } from "@/lib/auth/app-role";
import { hasSupabasePublicEnv } from "@/lib/supabase/client";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

type FormMode = "signin" | "signup";

const SHOP_IMAGE =
  "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1600&q=80";

function roleLabel(role: AppRole | null | undefined, t: (key: string) => string) {
  if (role === "admin") {
    return t("role.admin");
  }
  if (role === "seller") {
    return t("role.seller");
  }
  return t("role.customer");
}

function defaultRouteForRole(role: AppRole) {
  return role === "admin" ? "/admin" : role === "seller" ? "/seller" : "/";
}

function safeNextRoute(rawNext: string | null, role: AppRole) {
  const fallback = defaultRouteForRole(role);
  if (!rawNext || !rawNext.startsWith("/")) {
    return fallback;
  }
  if (role === "admin" && (rawNext.startsWith("/admin") || rawNext.startsWith("/seller"))) {
    return rawNext;
  }
  if (role === "seller" && rawNext.startsWith("/seller")) {
    return rawNext;
  }
  if (role === "user" && (rawNext === "/" || rawNext.startsWith("/shop"))) {
    return rawNext;
  }
  return fallback;
}

function authHref(mode: FormMode, nextRoute: string | null) {
  const base = mode === "signup" ? "/register" : "/login";
  return nextRoute ? `${base}?next=${encodeURIComponent(nextRoute)}` : base;
}

function accessCopy(role: AppRole | null | undefined, t: (key: string) => string) {
  if (role === "admin") {
    return t("login.adminAccessCopy");
  }
  if (role === "seller") {
    return t("login.sellerAccessCopy");
  }
  return t("login.customerAccessCopy");
}

export function LoginForm({ initialMode = "signin" }: { initialMode?: FormMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const {
    signIn,
    signUp,
    signInWithGoogle,
    resetPasswordForEmail,
    signOut,
    status,
    role,
    user,
    fullName,
  } = useAuth();
  const [mode, setMode] = useState<FormMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOauthSubmitting, setIsOauthSubmitting] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const nextRoute = useMemo(() => searchParams.get("next"), [searchParams]);
  const nextRouteIsStaffPage = Boolean(
    nextRoute?.startsWith("/admin") || nextRoute?.startsWith("/seller")
  );
  const supabaseReady = hasSupabasePublicEnv();
  const isBusy = isSubmitting || isOauthSubmitting || isResetSubmitting || status === "loading";

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (status === "authenticated" && role) {
      if (role === "user" && (!nextRoute || nextRouteIsStaffPage)) {
        return;
      }
      router.replace(safeNextRoute(nextRoute, role));
    }
  }, [nextRoute, nextRouteIsStaffPage, role, router, status]);

  const logout = async () => {
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await signOut();
      setEmail("");
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const result =
        mode === "signin" ? await signIn(email, password) : await signUp(email, password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (mode === "signup" && result.needsEmailConfirmation) {
        setPassword("");
        setNotice(result.message ?? t("login.confirmEmail"));
        return;
      }
      if (nextRouteIsStaffPage && result.role === "user") {
        setError(t("login.customerAccountStaffError"));
        return;
      }
      router.replace(safeNextRoute(nextRoute, result.role));
    } finally {
      setIsSubmitting(false);
    }
  };

  const googleLogin = async () => {
    setError(null);
    setNotice(null);

    if (nextRouteIsStaffPage) {
      setError(t("login.googleCustomerOnly"));
      return;
    }

    setIsOauthSubmitting(true);
    const next = nextRoute ?? "/";
    const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
    const result = await signInWithGoogle(redirectTo);
    if (!result.ok) {
      setError(result.message);
      setIsOauthSubmitting(false);
    }
  };

  const requestPasswordReset = async () => {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError(t("login.enterEmailForReset"));
      return;
    }

    setIsResetSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const result = await resetPasswordForEmail(email, redirectTo);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(t("login.resetEmailSent"));
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const signedIn = status === "authenticated" && role;
  const signedInRoute = role ? defaultRouteForRole(role) : "/";
  const signedInRouteLabel =
    role === "admin" ? t("login.openAdmin") : role === "seller" ? t("login.openSeller") : t("login.openShop");

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1fr),minmax(400px,520px)]">
        <div className="relative hidden overflow-hidden lg:block">
          <Image
            src={SHOP_IMAGE}
            alt={t("login.shopImageAlt")}
            fill
            sizes="60vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-10 bottom-10 max-w-xl text-white">
            <div className="mb-5 inline-flex rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
              <BikeCityLogo imageClassName="h-12 w-36" priority />
            </div>
            <h1 className="text-5xl font-black leading-tight">{t("login.heroTitle")}</h1>
            <p className="mt-4 max-w-md text-base text-zinc-100">
              {t("login.heroCopy")}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between gap-3">
              <Link href="/" className="inline-flex items-center">
                <BikeCityLogo imageClassName="h-12 w-36" priority />
              </Link>
              <LanguageSwitcher compact />
            </div>

            <div className="mb-8">
              <p className="text-sm font-black uppercase tracking-widest text-[var(--brand-cyan-dark)]">
                {mode === "signin" ? t("login.welcomeBack") : t("login.customerAccess")}
              </p>
              <h2 className="mt-2 text-3xl font-black text-zinc-950">
                {mode === "signin" ? t("login.signIn") : t("login.createAccount")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {nextRouteIsStaffPage
                  ? t("login.staffRequired")
                  : t("login.customerOrStaff")}
              </p>
            </div>

            {signedIn && (
              <div className="mb-6 rounded-lg border border-cyan-100 bg-cyan-50 p-4 text-sm text-slate-950">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-blue-strong)] text-white">
                    <User size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">
                      {nextRouteIsStaffPage && role === "user"
                        ? t("login.customerAccountSignedIn")
                        : t("login.accountSignedIn", { role: roleLabel(role, t) })}
                    </p>
                    <p className="mt-1 break-words text-xs text-cyan-800">
                      {fullName || user?.email || t("login.savedBrowser")}
                    </p>
                    <p className="mt-2 text-xs text-cyan-800">{accessCopy(role, t)}</p>
                    {nextRouteIsStaffPage && role === "user" && (
                      <p className="mt-2 text-xs font-bold text-amber-800">
                        {t("login.askAdmin")}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!(nextRouteIsStaffPage && role === "user") && (
                        <Link
                          href={signedInRoute}
                          className="brand-primary inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold"
                        >
                          {signedInRouteLabel}
                        </Link>
                      )}
                      {role === "admin" && (
                        <Link
                          href="/seller"
                          className="brand-control inline-flex h-9 items-center rounded-lg border px-3 text-xs font-bold text-slate-800 hover:bg-cyan-50"
                        >
                          {t("login.sellerView")}
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => void logout()}
                        disabled={isSubmitting}
                        className="brand-control inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold text-slate-900 hover:bg-cyan-50 disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                        {t("common.signOut")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!supabaseReady && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {t("login.supabaseMissing")}
              </div>
            )}

            {!nextRouteIsStaffPage && (
              <button
                type="button"
                onClick={() => void googleLogin()}
                disabled={isBusy || !supabaseReady}
                className="mb-4 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-800 hover:bg-zinc-100 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                {isOauthSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-base font-black text-zinc-950">
                    G
                  </span>
                )}
                {t("login.continueGoogle")}
              </button>
            )}

            <div className="mb-5 grid grid-cols-2 gap-2">
              <Link
                href={authHref("signin", nextRoute)}
                onClick={() => setMode("signin")}
                className={`flex h-10 items-center justify-center rounded-lg border text-sm font-black ${
                  mode === "signin"
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {t("login.signIn")}
              </Link>
              <Link
                href={authHref("signup", nextRoute)}
                onClick={() => setMode("signup")}
                className={`flex h-10 items-center justify-center rounded-lg border text-sm font-black ${
                  mode === "signup"
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {t("login.register")}
              </Link>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}

            {notice && (
              <div className="mb-4 rounded-lg border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
                {notice}
              </div>
            )}

            <form onSubmit={submitPassword} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-500">
                  {t("login.email")}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="brand-control h-12 w-full rounded-lg border px-3 text-zinc-950"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-zinc-500">
                  <span>{t("login.password")}</span>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => void requestPasswordReset()}
                      disabled={isBusy || !supabaseReady}
                      className="text-[11px] font-black normal-case tracking-normal text-[var(--brand-cyan-dark)] hover:text-[var(--brand-blue-dark)] disabled:text-zinc-400"
                    >
                      {isResetSubmitting ? t("login.sendingReset") : t("login.forgotPassword")}
                    </button>
                  )}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="brand-control h-12 w-full rounded-lg border px-3 text-zinc-950"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                />
              </label>

              <button
                type="submit"
                disabled={isBusy || !supabaseReady}
                className="brand-primary flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black disabled:bg-zinc-300"
              >
                {isSubmitting || status === "loading" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t("login.checkingAccess")}
                  </>
                ) : mode === "signin" ? (
                  t("login.signInEmail")
                ) : (
                  t("login.createCustomerAccount")
                )}
              </button>
            </form>

            <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
              <div className="flex gap-3 py-4">
                <ShoppingCart className="mt-0.5 h-5 w-5 text-[var(--brand-cyan-dark)]" />
                <div>
                  <p className="text-sm font-black text-zinc-950">{t("login.customer")}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    {t("login.customerCopy")}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 py-4">
                <Package className="mt-0.5 h-5 w-5 text-amber-700" />
                <div>
                  <p className="text-sm font-black text-zinc-950">{t("role.seller")}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    {t("login.sellerCopy")}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 py-4">
                <Lock className="mt-0.5 h-5 w-5 text-zinc-800" />
                <div>
                  <p className="text-sm font-black text-zinc-950">{t("role.admin")}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    {t("login.adminCopy")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
