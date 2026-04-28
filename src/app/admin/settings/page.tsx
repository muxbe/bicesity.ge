"use client";

import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Save } from "lucide-react";
import { getAuthHeaders, getJsonAuthHeaders } from "@/lib/auth/request-headers";
import { DEFAULT_APP_SETTINGS, type AppSettingsDTO } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";

type ApiResponse<T> = {
  data?: T;
  error?: string;
  details?: unknown;
};

function parseApiError(payload: ApiResponse<unknown> | null, fallback: string) {
  if (!payload) {
    return fallback;
  }
  if (
    payload.details &&
    typeof payload.details === "object" &&
    "message" in payload.details &&
    typeof payload.details.message === "string"
  ) {
    return `${payload.error ?? fallback} ${payload.details.message}`;
  }
  return payload.error ?? fallback;
}

export default function AdminSettingsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AppSettingsDTO>(DEFAULT_APP_SETTINGS);
  const [draft, setDraft] = useState<AppSettingsDTO>(DEFAULT_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        headers: await getAuthHeaders("admin"),
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse<AppSettingsDTO> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(parseApiError(payload, t("settings.loadFailed")));
      }
      setSettings(payload.data);
      setDraft(payload.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("settings.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify({
          shopName: draft.shopName,
          currency: draft.currency,
          messengerUrl: draft.messengerUrl,
          publicContactInfo: draft.publicContactInfo,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse<AppSettingsDTO> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(parseApiError(payload, t("settings.saveFailed")));
      }
      setSettings(payload.data);
      setDraft(payload.data);
      setSuccess(t("settings.savedNotice"));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("settings.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const hasMessengerLink = Boolean(settings.messengerUrl.trim());

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6 flex flex-col items-stretch gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            {t("settings.eyebrow")}
          </p>
          <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("settings.title")}</h1>
          <p className="mt-2 text-slate-600">
            {t("settings.description")}
          </p>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          {success && <p className="mt-2 text-sm text-emerald-700">{success}</p>}
        </div>
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          {t("common.reload")}
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 size={16} className="animate-spin" />
            {t("settings.loading")}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="shop-name" className="mb-2 block text-sm font-bold text-slate-700">
                {t("settings.shopName")}
              </label>
              <input
                id="shop-name"
                value={draft.shopName}
                onChange={(event) => setDraft((current) => ({ ...current, shopName: event.target.value }))}
                className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900"
                placeholder={t("settings.shopNamePlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="currency" className="mb-2 block text-sm font-bold text-slate-700">
                  {t("settings.currency")}
                </label>
                <input
                  id="currency"
                  value={draft.currency}
                  onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm uppercase text-slate-900"
                  placeholder="GEL"
                />
              </div>

              <div>
                <label htmlFor="messenger-link" className="mb-2 block text-sm font-bold text-slate-700">
                  {t("settings.messengerLink")}
                </label>
                <input
                  id="messenger-link"
                  type="url"
                  value={draft.messengerUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, messengerUrl: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900"
                  placeholder="https://m.me/your-page"
                />
              </div>
            </div>

            <div>
              <label htmlFor="public-contact" className="mb-2 block text-sm font-bold text-slate-700">
                {t("settings.publicContactInfo")}
              </label>
              <textarea
                id="public-contact"
                rows={4}
                value={draft.publicContactInfo}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, publicContactInfo: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder={t("settings.publicContactPlaceholder")}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div className="text-sm text-slate-500">
                {t("settings.detailUse")}
                {settings.updatedAt && (
                  <span>{t("settings.lastSaved", { value: new Date(settings.updatedAt).toLocaleString() })}</span>
                )}
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:flex sm:flex-wrap">
                {hasMessengerLink && (
                  <a
                    href={settings.messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink size={16} />
                    {t("settings.openLink")}
                  </a>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {t("settings.saveSettings")}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
