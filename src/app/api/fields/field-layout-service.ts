import { readShopConfiguration, SETTINGS_ID } from "@/app/api/settings/settings-service";
import {
  normalizeFieldLayoutConfig,
  type FieldLayoutConfig,
  type FieldLayoutState,
} from "@/features/fields/field-layout";
import { AdapterError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export class FieldLayoutStorageUnavailableError extends Error {
  constructor() {
    super("Shared field layout storage is not ready.");
    this.name = "FieldLayoutStorageUnavailableError";
  }
}

function isMissingFieldLayoutColumn(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (message.includes("schema cache") && message.includes("field_layout_config"))
  );
}

export async function readFieldLayoutState(): Promise<FieldLayoutState> {
  const configuration = await readShopConfiguration();
  return {
    config: configuration.fieldLayout,
    storageReady: configuration.fieldLayoutStorageReady,
  };
}

export async function writeFieldLayout(
  input: unknown,
  actorUserId: string | null
): Promise<FieldLayoutState> {
  const config = normalizeFieldLayoutConfig({
    ...(input && typeof input === "object" ? input : {}),
    configured: true,
  });
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .upsert(
      {
        id: SETTINGS_ID,
        field_layout_config: config,
        updated_by_actor_id: actorUserId,
      },
      { onConflict: "id" }
    )
    .select("field_layout_config")
    .single();

  if (error) {
    if (isMissingFieldLayoutColumn(error)) {
      throw new FieldLayoutStorageUnavailableError();
    }
    throw new AdapterError("Failed to save shared field layout.", error);
  }

  const row = data as { field_layout_config?: unknown } | null;
  return {
    config: normalizeFieldLayoutConfig(row?.field_layout_config ?? config),
    storageReady: true,
  };
}
