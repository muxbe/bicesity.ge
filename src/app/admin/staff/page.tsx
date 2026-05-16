"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { useAuth } from "@/features/auth";
import { getAuthHeaders, getJsonAuthHeaders } from "@/lib/auth/request-headers";
import type { StaffRole } from "@/lib/auth/app-role";
import { useI18n } from "@/lib/i18n";

type StaffProfile = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

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

export default function StaffPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("seller");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workingProfileId, setWorkingProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStaff = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/staff", {
        headers: await getAuthHeaders("admin"),
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse<StaffProfile[]> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(parseApiError(payload, t("staff.loadFailed")));
      }
      setStaff(payload.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("staff.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStaff();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse<StaffProfile> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(parseApiError(payload, t("staff.createFailed")));
      }

      setStaff((current) => {
        const next = payload.data as StaffProfile;
        const withoutDuplicate = current.filter((item) => item.id !== next.id);
        return [next, ...withoutDuplicate];
      });
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("seller");
      setSuccess(t("staff.savedMessage", { email: payload.data.email }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("staff.createFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const updateStaff = async (
    profile: StaffProfile,
    patch: Partial<Pick<StaffProfile, "role" | "isActive" | "fullName">> & { password?: string }
  ) => {
    setError(null);
    setSuccess(null);
    setWorkingProfileId(profile.id);
    try {
      const response = await fetch(`/api/staff/${encodeURIComponent(profile.id)}`, {
        method: "PATCH",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify(patch),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse<StaffProfile> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(parseApiError(payload, t("staff.updateFailed")));
      }

      setStaff((current) =>
        current.map((item) => (item.id === payload.data?.id ? (payload.data as StaffProfile) : item))
      );
      setSuccess(t("staff.updatedMessage", { email: payload.data.email }));
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("staff.updateFailed"));
      return false;
    } finally {
      setWorkingProfileId(null);
    }
  };

  const resetStaffPassword = async (profile: StaffProfile) => {
    const nextPassword = (resetPasswords[profile.id] ?? "").trim();
    if (profile.userId === user?.id) {
      setError(t("staff.selfPasswordResetBlocked"));
      setSuccess(null);
      return;
    }
    if (nextPassword.length < 6) {
      setError(t("staff.passwordTooShort"));
      setSuccess(null);
      return;
    }

    const wasUpdated = await updateStaff(profile, { password: nextPassword });
    if (wasUpdated) {
      setResetPasswords((current) => ({ ...current, [profile.id]: "" }));
    }
  };

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-6 flex flex-col items-stretch gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            {t("staff.eyebrow")}
          </p>
          <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("staff.title")}</h1>
          <p className="mt-2 text-slate-600">
            {t("staff.description")}
          </p>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          {success && <p className="mt-2 text-sm text-emerald-700">{success}</p>}
        </div>
        <button
          type="button"
          onClick={() => void loadStaff()}
          className="brand-control flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold text-slate-700 hover:bg-cyan-50"
        >
          <RefreshCw size={16} />
          {t("common.reload")}
        </button>
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-black text-slate-900">{t("staff.createTitle")}</h2>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,1fr,1fr,160px,auto]">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("staff.emailPlaceholder")}
            className="brand-control h-11 rounded-lg border px-3 text-sm"
            required
          />
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={t("staff.fullName")}
            className="brand-control h-11 rounded-lg border px-3 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("staff.passwordOptional")}
            className="brand-control h-11 rounded-lg border px-3 text-sm"
            minLength={6}
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            className="brand-control h-11 rounded-lg border px-3 text-sm"
          >
            <option value="seller">{t("role.seller")}</option>
            <option value="admin">{t("role.admin")}</option>
          </select>
          <button
            type="submit"
            disabled={isSaving}
            className="brand-primary flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold disabled:bg-slate-300"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {t("staff.createOrPromote")}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-black text-slate-900">{t("staff.currentTitle")}</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 p-5 text-sm text-slate-600">
            <Loader2 size={16} className="animate-spin" />
            {t("staff.loading")}
          </div>
        ) : staff.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">{t("staff.noProfiles")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t("staff.user")}</th>
                  <th className="px-5 py-3">{t("staff.role")}</th>
                  <th className="px-5 py-3">{t("staff.status")}</th>
                  <th className="px-5 py-3">{t("staff.created")}</th>
                  <th className="px-5 py-3">{t("staff.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((profile) => {
                  const isWorking = workingProfileId === profile.id;
                  const isSelf = profile.userId === user?.id;
                  const resetPassword = resetPasswords[profile.id] ?? "";
                  return (
                    <tr key={profile.id} className="border-t border-slate-100">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{profile.email}</p>
                        <p className="text-xs text-slate-500">{profile.fullName || t("staff.noName")}</p>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={profile.role}
                          disabled={isWorking}
                          onChange={(event) =>
                            void updateStaff(profile, { role: event.target.value as StaffRole })
                          }
                          className="brand-control h-9 rounded-lg border px-3 text-sm font-semibold capitalize text-slate-700 disabled:opacity-50"
                        >
                          <option value="seller">{t("role.seller")}</option>
                          <option value="admin">{t("role.admin")}</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            profile.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {profile.isActive ? t("common.active") : t("staff.inactive")}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {new Date(profile.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex min-w-[280px] flex-col gap-2">
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => void updateStaff(profile, { isActive: !profile.isActive })}
                            className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 ${
                              profile.isActive
                                ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {isWorking && <Loader2 size={14} className="animate-spin" />}
                            {profile.isActive ? t("staff.deactivate") : t("staff.reactivate")}
                          </button>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={resetPassword}
                              onChange={(event) =>
                                setResetPasswords((current) => ({
                                  ...current,
                                  [profile.id]: event.target.value,
                                }))
                              }
                              placeholder={t("staff.newPassword")}
                              minLength={6}
                              disabled={isWorking || isSelf}
                              title={isSelf ? t("staff.selfPasswordResetBlocked") : undefined}
                              className="brand-control h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm disabled:bg-slate-100"
                            />
                            <button
                              type="button"
                              disabled={isWorking || isSelf || resetPassword.trim().length < 6}
                              title={isSelf ? t("staff.selfPasswordResetBlocked") : undefined}
                              onClick={() => void resetStaffPassword(profile)}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-200 px-3 text-sm font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
                            >
                              {isWorking ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <KeyRound size={14} />
                              )}
                              {t("staff.resetPassword")}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
