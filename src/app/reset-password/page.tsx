"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { BikeCityLogo } from "@/components/bike-city-logo";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { getBrowserSupabaseClient, hasSupabasePublicEnv } from "@/lib/supabase/client";

function recoveryErrorFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  return (
    hashParams.get("error_description") ||
    hashParams.get("error") ||
    searchParams.get("error_description") ||
    searchParams.get("error")
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabaseReady = hasSupabasePublicEnv();

  useEffect(() => {
    if (!supabaseReady) {
      setError(t("reset.supabaseMissing"));
      setIsCheckingSession(false);
      return;
    }

    const urlError = recoveryErrorFromUrl();
    if (urlError) {
      setError(urlError);
    }

    const supabase = getBrowserSupabaseClient();

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) {
          throw sessionError;
        }
        const hasSession = Boolean(data.session);
        setHasRecoverySession(hasSession);
        if (!hasSession && !urlError) {
          setError(t("reset.missingSession"));
        }
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : t("reset.missingSession"));
      })
      .finally(() => {
        setIsCheckingSession(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setHasRecoverySession(true);
        setError(null);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [supabaseReady, t]);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!hasRecoverySession) {
      setError(t("reset.missingSession"));
      return;
    }

    if (newPassword.length < 6) {
      setError(t("reset.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("reset.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();
      setNewPassword("");
      setConfirmPassword("");
      setHasRecoverySession(false);
      setNotice(t("reset.updated"));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("reset.updateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-4 flex items-center justify-start">
          <Link href="/" className="inline-flex items-center">
            <BikeCityLogo imageClassName="h-12 w-36" priority />
          </Link>
        </div>
        <div className="mb-8 flex justify-start">
          <LanguageSwitcher />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-strong)] text-white">
              <LockKeyhole size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[var(--brand-cyan-dark)]">
                {t("reset.eyebrow")}
              </p>
              <h1 className="mt-1 text-3xl font-black text-zinc-950">{t("reset.title")}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{t("reset.description")}</p>
            </div>
          </div>

          {isCheckingSession && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              <Loader2 size={16} className="animate-spin" />
              {t("reset.checkingLink")}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={submitPassword} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-500">
                {t("reset.newPassword")}
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="brand-control h-12 w-full rounded-lg border px-3 text-zinc-950"
                autoComplete="new-password"
                minLength={6}
                disabled={!hasRecoverySession || isCheckingSession || Boolean(notice)}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-500">
                {t("reset.confirmPassword")}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="brand-control h-12 w-full rounded-lg border px-3 text-zinc-950"
                autoComplete="new-password"
                minLength={6}
                disabled={!hasRecoverySession || isCheckingSession || Boolean(notice)}
                required
              />
            </label>

            <button
              type="submit"
              disabled={!hasRecoverySession || isCheckingSession || isSubmitting || Boolean(notice)}
              className="brand-primary flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black disabled:bg-zinc-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("reset.updating")}
                </>
              ) : (
                t("reset.updatePassword")
              )}
            </button>
          </form>

          <Link
            href="/login"
            className="brand-control mt-4 flex h-11 w-full items-center justify-center rounded-lg border text-sm font-black text-zinc-700 hover:bg-cyan-50"
          >
            {t("reset.backToLogin")}
          </Link>
        </div>
      </section>
    </main>
  );
}
