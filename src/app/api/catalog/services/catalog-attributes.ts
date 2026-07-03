import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";
import type {
  AttributeOptionValidationRow,
  AttributeValidationRow,
  ValueRow,
} from "@/app/api/catalog/services/catalog-types";
import { mapCategoryToDb } from "@/app/api/catalog/services/catalog-mappers";
import { AdapterError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function fetchAttributeValueMap(): Promise<Map<string, Record<string, string>>> {
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("item_attribute_values")
    .select("catalog_item_id,attribute_id,value_text");

  if (error) {
    throw new AdapterError("Failed to fetch item attributes.", error);
  }

  const map = new Map<string, Record<string, string>>();
  for (const row of (data ?? []) as ValueRow[]) {
    if (!row.value_text) {
      continue;
    }
    const current = map.get(row.catalog_item_id) ?? {};
    current[row.attribute_id] = row.value_text;
    map.set(row.catalog_item_id, current);
  }

  return map;
}

export async function syncAttributeValues(
  productId: string,
  category: ProductCategory,
  values: Record<string, string> | undefined
) {
  if (!values) {
    return;
  }

  const supabase = getServerSupabaseAdminClient();
  const { data: attributes, error: attributeError } = await supabase
    .from("attributes")
    .select("id,display_name,input_mode")
    .eq("category", mapCategoryToDb(category))
    .is("archived_at", null);

  if (attributeError) {
    throw new AdapterError("Failed to validate product fields.", attributeError);
  }

  const attributeRows = (attributes ?? []) as AttributeValidationRow[];
  const attributeById = new Map(attributeRows.map((attribute) => [attribute.id, attribute]));
  const validAttributeIds = new Set(attributeById.keys());
  const selectAttributeIds = attributeRows
    .filter((attribute) => attribute.input_mode === "single_select")
    .map((attribute) => attribute.id);
  const optionValuesByAttributeId = new Map<string, Set<string>>();

  if (selectAttributeIds.length > 0) {
    const { data: optionRows, error: optionError } = await supabase
      .from("attribute_options")
      .select("attribute_id,value")
      .in("attribute_id", selectAttributeIds)
      .eq("is_active", true);

    if (optionError) {
      throw new AdapterError("Failed to validate product field options.", optionError);
    }

    for (const row of (optionRows ?? []) as AttributeOptionValidationRow[]) {
      const current = optionValuesByAttributeId.get(row.attribute_id) ?? new Set<string>();
      current.add(row.value);
      optionValuesByAttributeId.set(row.attribute_id, current);
    }
  }

  const upserts: Array<{ catalog_item_id: string; attribute_id: string; value_text: string }> =
    [];
  const deleteIds: string[] = [];

  for (const [attributeId, rawValue] of Object.entries(values)) {
    if (!validAttributeIds.has(attributeId)) {
      continue;
    }

    const value = String(rawValue ?? "").trim();
    if (value) {
      const attribute = attributeById.get(attributeId);
      const optionValues = optionValuesByAttributeId.get(attributeId);
      if (attribute?.input_mode === "single_select" && (!optionValues || !optionValues.has(value))) {
        throw new ValidationError(`${attribute.display_name} must use a configured option.`);
      }
      upserts.push({
        catalog_item_id: productId,
        attribute_id: attributeId,
        value_text: value,
      });
    } else {
      deleteIds.push(attributeId);
    }
  }

  if (deleteIds.length > 0) {
    const { error } = await supabase
      .from("item_attribute_values")
      .delete()
      .eq("catalog_item_id", productId)
      .in("attribute_id", deleteIds);

    if (error) {
      throw new AdapterError("Failed to clear product field values.", error);
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase.from("item_attribute_values").upsert(upserts, {
      onConflict: "catalog_item_id,attribute_id",
    });

    if (error) {
      throw new AdapterError("Failed to save product field values.", error);
    }
  }
}