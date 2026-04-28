import { promises as fs } from "fs";
import path from "path";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_APP_SETTINGS, type AppSettingsDTO } from "@/lib/settings";

export type SettingsPayload = {
  shopName?: unknown;
  currency?: unknown;
  messengerUrl?: unknown;
  publicContactInfo?: unknown;
};

type SettingsRow = {
  id: string;
  shop_name: string | null;
  currency: string | null;
  messenger_url: string | null;
  public_contact_info: string | null;
  updated_at: string | null;
};

export const SETTINGS_ID = "global";
export const SETTINGS_SELECT = "id,shop_name,currency,messenger_url,public_contact_info,updated_at";

const LOCAL_SETTINGS_PATH = path.join(process.cwd(), ".local-app-settings.json");

function envMessengerUrl() {
  return (
    process.env.NEXT_PUBLIC_MESSENGER_TARGET_URL?.trim() ||
    process.env.NEXT_PUBLIC_MESSENGER_URL?.trim() ||
    ""
  );
}

export function fallbackSettings(): AppSettingsDTO {
  return {
    ...DEFAULT_APP_SETTINGS,
    messengerUrl: envMessengerUrl(),
  };
}

function isMissingSettingsTable(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    Boolean(error?.message?.toLowerCase().includes("app_settings"))
  );
}

export function mapSettings(row: SettingsRow | null): AppSettingsDTO {
  const fallback = fallbackSettings();
  if (!row) {
    return fallback;
  }

  return {
    shopName: row.shop_name?.trim() || fallback.shopName,
    currency: row.currency?.trim() || fallback.currency,
    messengerUrl: row.messenger_url?.trim() || fallback.messengerUrl,
    publicContactInfo: row.public_contact_info?.trim() || fallback.publicContactInfo,
    updatedAt: row.updated_at,
  };
}

function mapSettingsObject(rawSettings: Partial<AppSettingsDTO> | null): AppSettingsDTO {
  const fallback = fallbackSettings();
  if (!rawSettings) {
    return fallback;
  }

  return {
    shopName: rawSettings.shopName?.trim() || fallback.shopName,
    currency: rawSettings.currency?.trim() || fallback.currency,
    messengerUrl: rawSettings.messengerUrl?.trim() || fallback.messengerUrl,
    publicContactInfo: rawSettings.publicContactInfo?.trim() || fallback.publicContactInfo,
    updatedAt: rawSettings.updatedAt ?? null,
  };
}

async function readLocalSettings(): Promise<AppSettingsDTO | null> {
  try {
    const rawFile = await fs.readFile(LOCAL_SETTINGS_PATH, "utf8");
    return mapSettingsObject(JSON.parse(rawFile) as Partial<AppSettingsDTO>);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function writeLocalSettings(settings: AppSettingsDTO): Promise<AppSettingsDTO> {
  await fs.writeFile(LOCAL_SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

export function parseText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim().slice(0, maxLength);
}

export function parseCurrency(value: unknown, fallback: string): string {
  const currency = parseText(value, fallback, 8).toUpperCase();
  return currency || fallback;
}

export function parseMessengerUrl(value: unknown, fallback: string): string | null {
  const rawValue = parseText(value, fallback, 300);
  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return rawValue;
  } catch {
    return null;
  }
}

export async function readSettings(): Promise<AppSettingsDTO> {
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select(SETTINGS_SELECT)
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) {
      return (await readLocalSettings()) ?? fallbackSettings();
    }
    throw error;
  }

  return mapSettings((data as SettingsRow | null) ?? null);
}
