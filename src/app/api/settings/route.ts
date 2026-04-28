import { NextRequest, NextResponse } from "next/server";
import { canUseDevRoleHeader, getRequestAuth, readDevRoleHeader } from "@/lib/auth/server";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings";
import {
  SETTINGS_ID,
  SETTINGS_SELECT,
  fallbackSettings,
  mapSettings,
  parseCurrency,
  parseMessengerUrl,
  parseText,
  readSettings,
  writeLocalSettings,
  type SettingsPayload,
} from "@/app/api/settings/settings-service";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing NEXT_PUBLIC_SUPABASE_URL")) {
      return NextResponse.json({ data: fallbackSettings() });
    }

    return NextResponse.json(
      {
        error: "Failed to load settings.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    const fallbackRole = auth ? null : canUseDevRoleHeader() ? readDevRoleHeader(request) : null;
    const role = auth?.role ?? fallbackRole;
    if (role !== "admin") {
      return NextResponse.json({ error: "Only admins can update settings." }, { status: 403 });
    }

    const current = await readSettings();
    const payload = (await request.json()) as SettingsPayload;
    const messengerUrl = parseMessengerUrl(payload.messengerUrl, current.messengerUrl);

    if (messengerUrl === null) {
      return NextResponse.json(
        { error: "Messenger link must be a valid http or https URL." },
        { status: 400 }
      );
    }

    const nextSettings = {
      id: SETTINGS_ID,
      shop_name: parseText(payload.shopName, current.shopName, 120) || DEFAULT_APP_SETTINGS.shopName,
      currency: parseCurrency(payload.currency, current.currency),
      messenger_url: messengerUrl,
      public_contact_info: parseText(payload.publicContactInfo, current.publicContactInfo, 500),
      updated_by_actor_id: auth?.user.id ?? null,
    };

    const supabase = getServerSupabaseAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(nextSettings, { onConflict: "id" })
      .select(SETTINGS_SELECT)
      .single();

    if (error) {
      if (
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        Boolean(error.message?.toLowerCase().includes("app_settings"))
      ) {
        const localSettings = await writeLocalSettings({
          shopName: nextSettings.shop_name,
          currency: nextSettings.currency,
          messengerUrl: nextSettings.messenger_url,
          publicContactInfo: nextSettings.public_contact_info,
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ data: localSettings });
      }

      return NextResponse.json(
        { error: "Failed to save settings.", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: mapSettings(data) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected settings error.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
