import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdapterError, NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import type {
  CreateFieldDTO,
  FieldDTO,
  FieldDataType,
  FieldInputMode,
  FieldOptionDTO,
  UpdateFieldDTO,
} from "@/features/fields/dto/field-dto";

type DbCategory = "bicycle" | "part";

type AttributeRow = {
  id: string;
  display_name: string;
  display_name_translations?: Record<string, unknown> | null;
  category: DbCategory;
  is_public: boolean;
  sort_order?: number | null;
  field_key: string;
  data_type: FieldDataType;
  input_mode?: FieldInputMode | null;
  archived_at: string | null;
};

type AttributeOptionRow = {
  id: string;
  attribute_id: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
};

const FIELD_SELECT =
  "id,display_name,display_name_translations,category,is_public,sort_order,field_key,data_type,input_mode,archived_at";
const FIELD_SELECT_WITHOUT_SORT =
  "id,display_name,display_name_translations,category,is_public,field_key,data_type,input_mode,archived_at";
const FIELD_SELECT_WITHOUT_TRANSLATIONS =
  "id,display_name,category,is_public,sort_order,field_key,data_type,input_mode,archived_at";
const FIELD_SELECT_LEGACY =
  "id,display_name,category,is_public,field_key,data_type,input_mode,archived_at";

function mapCategory(category: DbCategory): "Bicycle" | "Parts" {
  return category === "bicycle" ? "Bicycle" : "Parts";
}

function mapCategoryToDb(category: "Bicycle" | "Parts"): DbCategory {
  return category === "Bicycle" ? "bicycle" : "part";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeInputMode(inputMode: FieldInputMode | null | undefined): FieldInputMode {
  return inputMode === "single_select" ? "single_select" : "free_text";
}

function normalizeNameTranslations(
  translations: CreateFieldDTO["nameTranslations"] | UpdateFieldDTO["nameTranslations"] | null | undefined,
  fallbackName: string
) {
  const normalized: Partial<Record<"en" | "ru" | "ka", string>> = {};
  const en = translations?.en?.trim() || fallbackName.trim();
  const ru = translations?.ru?.trim();
  const ka = translations?.ka?.trim();

  if (en) {
    normalized.en = en;
  }
  if (ru) {
    normalized.ru = ru;
  }
  if (ka) {
    normalized.ka = ka;
  }
  return normalized;
}

function readNameTranslations(row: AttributeRow) {
  const raw = row.display_name_translations;
  if (!raw || typeof raw !== "object") {
    return { en: row.display_name };
  }

  return normalizeNameTranslations(
    {
      en: typeof raw.en === "string" ? raw.en : undefined,
      ru: typeof raw.ru === "string" ? raw.ru : undefined,
      ka: typeof raw.ka === "string" ? raw.ka : undefined,
    },
    row.display_name
  );
}

function mapOptionRow(row: AttributeOptionRow): FieldOptionDTO {
  return {
    id: row.id,
    label: row.label,
    value: row.value,
    sortOrder: row.sort_order,
  };
}

function mapRow(
  row: AttributeRow,
  index = 0,
  optionsByAttributeId: Map<string, FieldOptionDTO[]> = new Map()
): FieldDTO {
  return {
    id: row.id,
    name: row.display_name,
    nameTranslations: readNameTranslations(row),
    category: mapCategory(row.category),
    isPublic: row.is_public,
    sortOrder: row.sort_order ?? index + 1,
    fieldKey: row.field_key,
    dataType: row.data_type,
    inputMode: normalizeInputMode(row.input_mode),
    options: optionsByAttributeId.get(row.id) ?? [],
    archivedAt: row.archived_at,
  };
}

function isMissingSortOrderError(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    (error.code === "42703" || error.code === "PGRST204" || message.includes("schema cache")) &&
    message.includes("sort_order")
  );
}

function isMissingInputModeError(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    (error.code === "42703" || error.code === "PGRST204" || message.includes("schema cache")) &&
    message.includes("input_mode")
  );
}

function isMissingTranslationsError(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    (error.code === "42703" || error.code === "PGRST204" || message.includes("schema cache")) &&
    message.includes("display_name_translations")
  );
}

async function fetchOptionsForAttributes(attributeIds: string[]): Promise<Map<string, FieldOptionDTO[]>> {
  if (attributeIds.length === 0) {
    return new Map();
  }

  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attribute_options")
    .select("id,attribute_id,label,value,sort_order,is_active")
    .in("attribute_id", attributeIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new AdapterError("Failed to load field options.", error);
  }

  const optionsByAttributeId = new Map<string, FieldOptionDTO[]>();
  for (const option of (data ?? []) as AttributeOptionRow[]) {
    const current = optionsByAttributeId.get(option.attribute_id) ?? [];
    current.push(mapOptionRow(option));
    optionsByAttributeId.set(option.attribute_id, current);
  }

  return optionsByAttributeId;
}

function normalizeOptions(
  options: UpdateFieldDTO["options"] | CreateFieldDTO["options"] | undefined
): Array<{ label: string; value: string; sort_order: number }> {
  if (!options) {
    return [];
  }

  const seenValues = new Set<string>();
  const normalized: Array<{ label: string; value: string; sort_order: number }> = [];
  for (const option of options) {
    const label = option.label.trim();
    if (!label) {
      continue;
    }
    const value = option.value?.trim() || label;
    const uniqueKey = value.toLowerCase();
    if (seenValues.has(uniqueKey)) {
      continue;
    }
    seenValues.add(uniqueKey);
    normalized.push({
      label,
      value,
      sort_order: option.sortOrder ?? normalized.length + 1,
    });
  }

  return normalized.map((option, index) => ({
    ...option,
    sort_order: index + 1,
  }));
}

async function syncFieldOptions(
  attributeId: string,
  options: UpdateFieldDTO["options"] | CreateFieldDTO["options"] | undefined
) {
  if (options === undefined) {
    return;
  }

  const normalized = normalizeOptions(options);
  const supabase = getServerSupabaseAdminClient();

  const { error: deactivateError } = await supabase
    .from("attribute_options")
    .update({ is_active: false })
    .eq("attribute_id", attributeId);

  if (deactivateError) {
    throw new AdapterError("Failed to clear field options.", deactivateError);
  }

  if (normalized.length === 0) {
    return;
  }

  const { error: upsertError } = await supabase.from("attribute_options").upsert(
    normalized.map((option) => ({
      attribute_id: attributeId,
      label: option.label,
      value: option.value,
      sort_order: option.sort_order,
      is_active: true,
    })),
    { onConflict: "attribute_id,value" }
  );

  if (upsertError) {
    throw new AdapterError("Failed to save field options.", upsertError);
  }
}

async function listRowsWithoutSortOrder(category: "Bicycle" | "Parts" | "all") {
  const supabase = getServerSupabaseAdminClient();
  let query = supabase
    .from("attributes")
    .select(FIELD_SELECT_WITHOUT_SORT)
    .is("archived_at", null);

  if (category !== "all") {
    query = query.eq("category", mapCategoryToDb(category));
  }

  const { data, error } = await query;
  if (isMissingTranslationsError(error)) {
    return listRowsLegacy(category);
  }
  if (error) {
    throw new AdapterError("Failed to load fields.", error);
  }

  const rows = (data ?? []) as AttributeRow[];
  const optionsByAttributeId = await fetchOptionsForAttributes(rows.map((row) => row.id));
  return rows.map((row, index) => mapRow(row, index, optionsByAttributeId));
}

async function listRowsWithoutTranslations(category: "Bicycle" | "Parts" | "all") {
  const supabase = getServerSupabaseAdminClient();
  let query = supabase
    .from("attributes")
    .select(FIELD_SELECT_WITHOUT_TRANSLATIONS)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });

  if (category !== "all") {
    query = query.eq("category", mapCategoryToDb(category));
  }

  const { data, error } = await query;
  if (isMissingSortOrderError(error)) {
    return listRowsLegacy(category);
  }
  if (error) {
    throw new AdapterError("Failed to load fields.", error);
  }

  const rows = (data ?? []) as AttributeRow[];
  const optionsByAttributeId = await fetchOptionsForAttributes(rows.map((row) => row.id));
  return rows.map((row, index) => mapRow(row, index, optionsByAttributeId));
}

async function listRowsLegacy(category: "Bicycle" | "Parts" | "all") {
  const supabase = getServerSupabaseAdminClient();
  let query = supabase
    .from("attributes")
    .select(FIELD_SELECT_LEGACY)
    .is("archived_at", null);

  if (category !== "all") {
    query = query.eq("category", mapCategoryToDb(category));
  }

  const { data, error } = await query;
  if (error) {
    throw new AdapterError("Failed to load fields.", error);
  }

  const rows = (data ?? []) as AttributeRow[];
  const optionsByAttributeId = await fetchOptionsForAttributes(rows.map((row) => row.id));
  return rows.map((row, index) => mapRow(row, index, optionsByAttributeId));
}

async function nextSortOrder(category: "Bicycle" | "Parts") {
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attributes")
    .select("sort_order")
    .eq("category", mapCategoryToDb(category))
    .is("archived_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (isMissingSortOrderError(error)) {
    return null;
  }
  if (error) {
    throw new AdapterError("Failed to compute field sort order.", error);
  }

  return ((data?.[0]?.sort_order as number | undefined) ?? 0) + 1;
}

async function uniqueFieldKey(category: "Bicycle" | "Parts", name: string): Promise<string> {
  const baseKey = slugify(name) || `field_${Date.now()}`;
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attributes")
    .select("field_key")
    .eq("category", mapCategoryToDb(category));

  if (error) {
    throw new AdapterError("Failed to check field key uniqueness.", error);
  }

  const existingKeys = new Set(
    ((data ?? []) as { field_key: string }[]).map((row) => row.field_key)
  );
  if (!existingKeys.has(baseKey)) {
    return baseKey;
  }

  let suffix = 2;
  let candidate = `${baseKey}_${suffix}`;
  while (existingKeys.has(candidate)) {
    suffix += 1;
    candidate = `${baseKey}_${suffix}`;
  }

  return candidate;
}

export async function listFields(category: "Bicycle" | "Parts" | "all" = "all") {
  const supabase = getServerSupabaseAdminClient();
  let query = supabase
    .from("attributes")
    .select(FIELD_SELECT)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });

  if (category !== "all") {
    query = query.eq("category", mapCategoryToDb(category));
  }

  const { data, error } = await query;
  if (isMissingSortOrderError(error)) {
    return listRowsWithoutSortOrder(category);
  }
  if (isMissingTranslationsError(error)) {
    return listRowsWithoutTranslations(category);
  }
  if (error) {
    throw new AdapterError("Failed to load fields.", error);
  }

  const rows = (data ?? []) as AttributeRow[];
  const optionsByAttributeId = await fetchOptionsForAttributes(rows.map((row) => row.id));
  return rows.map((row, index) => mapRow(row, index, optionsByAttributeId));
}

export async function createField(input: CreateFieldDTO) {
  if (input.category !== "Bicycle" && input.category !== "Parts") {
    throw new ValidationError("Field category must be Bicycle or Parts.");
  }

  const name = input.name.trim();
  if (!name) {
    throw new ValidationError("Field name is required.");
  }

  const sortOrder = await nextSortOrder(input.category);
  const nameTranslations = normalizeNameTranslations(input.nameTranslations, name);
  const insertPayload: Record<string, unknown> = {
    category: mapCategoryToDb(input.category),
    field_key: await uniqueFieldKey(input.category, name),
    display_name: name,
    display_name_translations: nameTranslations,
    data_type: input.dataType ?? "text",
    input_mode:
      input.inputMode === "single_select" && normalizeOptions(input.options).length > 0
        ? "single_select"
        : "free_text",
    is_public: input.isPublic ?? true,
  };

  if (sortOrder !== null) {
    insertPayload.sort_order = sortOrder;
  }

  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attributes")
    .insert(insertPayload)
    .select(sortOrder === null ? FIELD_SELECT_WITHOUT_SORT : FIELD_SELECT)
    .single();

  if (isMissingTranslationsError(error)) {
    const retryPayload = { ...insertPayload };
    delete retryPayload.display_name_translations;
    const retry = await supabase
      .from("attributes")
      .insert(retryPayload)
      .select(sortOrder === null ? FIELD_SELECT_LEGACY : FIELD_SELECT_WITHOUT_TRANSLATIONS)
      .single();

    if (retry.error) {
      throw new AdapterError("Failed to create field.", retry.error);
    }

    const created = mapRow(retry.data as unknown as AttributeRow);
    await syncFieldOptions(created.id, input.options);
    const optionsByAttributeId = await fetchOptionsForAttributes([created.id]);
    return mapRow(retry.data as unknown as AttributeRow, 0, optionsByAttributeId);
  }

  if (error) {
    throw new AdapterError("Failed to create field.", error);
  }

  const created = mapRow(data as unknown as AttributeRow);
  await syncFieldOptions(created.id, input.options);
  const optionsByAttributeId = await fetchOptionsForAttributes([created.id]);
  return mapRow(data as unknown as AttributeRow, 0, optionsByAttributeId);
}

export async function updateField(fieldId: string, input: UpdateFieldDTO) {
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const nextName = input.name.trim();
    if (!nextName) {
      throw new ValidationError("Field name cannot be empty.");
    }
    patch.display_name = nextName;
    patch.field_key = slugify(nextName);
  }
  if (input.nameTranslations !== undefined) {
    patch.display_name_translations = normalizeNameTranslations(
      input.nameTranslations,
      input.name ?? input.nameTranslations.en ?? ""
    );
  }
  if (input.isPublic !== undefined) {
    patch.is_public = input.isPublic;
  }
  if (input.sortOrder !== undefined) {
    patch.sort_order = input.sortOrder;
  }
  if (input.dataType !== undefined) {
    patch.data_type = input.dataType;
  }
  if (input.inputMode !== undefined || input.options !== undefined) {
    const nextOptions = normalizeOptions(input.options);
    patch.input_mode =
      input.inputMode === "single_select" && nextOptions.length > 0
        ? "single_select"
        : "free_text";
  }

  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attributes")
    .update(patch)
    .eq("id", fieldId)
    .is("archived_at", null)
    .select(FIELD_SELECT)
    .maybeSingle();

  if (isMissingSortOrderError(error)) {
    const retryPatch = { ...patch };
    delete retryPatch.sort_order;
    const retry = await supabase
      .from("attributes")
      .update(retryPatch)
      .eq("id", fieldId)
      .is("archived_at", null)
      .select(FIELD_SELECT_WITHOUT_SORT)
      .maybeSingle();

    if (isMissingTranslationsError(retry.error)) {
      const translationRetryPatch = { ...retryPatch };
      delete translationRetryPatch.display_name_translations;
      const translationRetry = await supabase
        .from("attributes")
        .update(translationRetryPatch)
        .eq("id", fieldId)
        .is("archived_at", null)
        .select(FIELD_SELECT_LEGACY)
        .maybeSingle();

      if (translationRetry.error) {
        throw new AdapterError("Failed to update field.", translationRetry.error);
      }
      if (!translationRetry.data) {
        throw new NotFoundError("Field not found.", { fieldId });
      }
      await syncFieldOptions(fieldId, input.options);
      const optionsByAttributeId = await fetchOptionsForAttributes([fieldId]);
      return mapRow(translationRetry.data as unknown as AttributeRow, 0, optionsByAttributeId);
    }

    if (retry.error) {
      throw new AdapterError("Failed to update field.", retry.error);
    }
    if (!retry.data) {
      throw new NotFoundError("Field not found.", { fieldId });
    }
    await syncFieldOptions(fieldId, input.options);
    const optionsByAttributeId = await fetchOptionsForAttributes([fieldId]);
    return mapRow(retry.data as unknown as AttributeRow, 0, optionsByAttributeId);
  }

  if (isMissingTranslationsError(error)) {
    const retryPatch = { ...patch };
    delete retryPatch.display_name_translations;
    const retry = await supabase
      .from("attributes")
      .update(retryPatch)
      .eq("id", fieldId)
      .is("archived_at", null)
      .select(FIELD_SELECT_WITHOUT_TRANSLATIONS)
      .maybeSingle();

    if (isMissingSortOrderError(retry.error)) {
      const legacyPatch = { ...retryPatch };
      delete legacyPatch.sort_order;
      const legacyRetry = await supabase
        .from("attributes")
        .update(legacyPatch)
        .eq("id", fieldId)
        .is("archived_at", null)
        .select(FIELD_SELECT_LEGACY)
        .maybeSingle();

      if (legacyRetry.error) {
        throw new AdapterError("Failed to update field.", legacyRetry.error);
      }
      if (!legacyRetry.data) {
        throw new NotFoundError("Field not found.", { fieldId });
      }
      await syncFieldOptions(fieldId, input.options);
      const optionsByAttributeId = await fetchOptionsForAttributes([fieldId]);
      return mapRow(legacyRetry.data as unknown as AttributeRow, 0, optionsByAttributeId);
    }

    if (retry.error) {
      throw new AdapterError("Failed to update field.", retry.error);
    }
    if (!retry.data) {
      throw new NotFoundError("Field not found.", { fieldId });
    }

    await syncFieldOptions(fieldId, input.options);
    const optionsByAttributeId = await fetchOptionsForAttributes([fieldId]);
    return mapRow(retry.data as unknown as AttributeRow, 0, optionsByAttributeId);
  }

  if (error) {
    throw new AdapterError("Failed to update field.", error);
  }
  if (!data) {
    throw new NotFoundError("Field not found.", { fieldId });
  }

  await syncFieldOptions(fieldId, input.options);
  const optionsByAttributeId = await fetchOptionsForAttributes([fieldId]);
  return mapRow(data as unknown as AttributeRow, 0, optionsByAttributeId);
}

export async function archiveField(fieldId: string) {
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attributes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", fieldId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new AdapterError("Failed to archive field.", error);
  }
  if (!data) {
    throw new NotFoundError("Field not found.", { fieldId });
  }
}
