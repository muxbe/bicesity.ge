import type {
  AttributeDTO,
  CreateProductDTO,
  MarkSoldDTO,
  ProductCategory,
  ProductDTO,
  ProductStatus,
  CatalogStatusCounts,
  ProductStatusFilter,
  UpdateProductDTO,
} from "@/features/catalog/dto/catalog-dto";
import type {
  AttributeOptionValidationRow,
  AttributeValidationRow,
  CatalogItemRow,
  ListProductsOptions,
  ProductImageStorageRow,
  ValueRow,
} from "@/app/api/catalog/services/catalog-types";
import {
  CATALOG_ITEM_SELECT,
  PRODUCT_STATUSES,
} from "@/app/api/catalog/services/catalog-types";
import {
  normalizeProductImages,
  removeUnusedStorageObjects,
  syncProductImages,
} from "@/app/api/catalog/services/catalog-images";
import {
  discountPatchFromInput,
  mapCategoryToDb,
  mapDriveTypeToDb,
  rowToProduct,
} from "@/app/api/catalog/services/catalog-mappers";
import { listFields } from "@/app/api/fields/field-service";
import {
  assertRequiredText,
  assertValidPrice,
  assertValidStockCount,
} from "@/features/catalog/domain/catalog-validation";
import { AdapterError, NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

async function fetchAttributeValueMap(): Promise<Map<string, Record<string, string>>> {
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

async function syncAttributeValues(
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

async function fetchCatalogItems(status: ProductStatusFilter = "all"): Promise<CatalogItemRow[]> {
  const supabase = getServerSupabaseAdminClient();
  let query = supabase
    .from("catalog_items")
    .select(CATALOG_ITEM_SELECT)
    .order("created_at", { ascending: false });

  if (status === "all") {
    query = query.neq("status", "archived");
  } else {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new AdapterError("Failed to fetch catalog items.", error);
  }

  return (data ?? []) as unknown as CatalogItemRow[];
}

async function countCatalogItems(status: ProductStatus): Promise<number> {
  const supabase = getServerSupabaseAdminClient();
  const { count, error } = await supabase
    .from("catalog_items")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (error) {
    throw new AdapterError("Failed to count catalog items.", error);
  }

  return count ?? 0;
}

async function syncCatalogReservationStatuses(): Promise<void> {
  const supabase = getServerSupabaseAdminClient();
  const { data: reservationRows, error: reservationError } = await supabase
    .from("reservations")
    .select("catalog_item_id")
    .eq("status", "active");

  if (reservationError) {
    throw new AdapterError("Failed to read active reservations for catalog sync.", reservationError);
  }

  const activeReservationItemIds = Array.from(
    new Set(
      (reservationRows ?? [])
        .map((row) => row.catalog_item_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (activeReservationItemIds.length > 0) {
    const { error } = await supabase
      .from("catalog_items")
      .update({ status: "reserved" })
      .in("id", activeReservationItemIds)
      .eq("status", "active");

    if (error) {
      throw new AdapterError("Failed to sync active reservations to reserved items.", error);
    }
  }

  const { data: reservedRows, error: reservedError } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("status", "reserved");

  if (reservedError) {
    throw new AdapterError("Failed to read reserved items for catalog sync.", reservedError);
  }

  const activeReservationItemIdSet = new Set(activeReservationItemIds);
  const staleReservedItemIds = (reservedRows ?? [])
    .map((row) => row.id as string | null)
    .filter((id): id is string => {
      if (!id) {
        return false;
      }
      return !activeReservationItemIdSet.has(id);
    });

  if (staleReservedItemIds.length > 0) {
    const { error } = await supabase
      .from("catalog_items")
      .update({ status: "active" })
      .in("id", staleReservedItemIds)
      .eq("status", "reserved");

    if (error) {
      throw new AdapterError("Failed to sync stale reserved items back to active.", error);
    }
  }
}

async function fetchOneCatalogItem(productId: string): Promise<CatalogItemRow | null> {
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select(CATALOG_ITEM_SELECT)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new AdapterError("Failed to fetch catalog item.", error);
  }

  return (data as unknown as CatalogItemRow | null) ?? null;
}

export async function listProducts(
  status: ProductStatusFilter = "all",
  options: ListProductsOptions = {}
): Promise<ProductDTO[]> {
  if (options.syncReservations) {
    await syncCatalogReservationStatuses();
  }
  const [itemRows, valuesByItemId] = await Promise.all([
    fetchCatalogItems(status),
    fetchAttributeValueMap(),
  ]);
  return itemRows.map((row) => rowToProduct(row, valuesByItemId));
}

export async function countProductsByStatus(
  options: ListProductsOptions = {}
): Promise<CatalogStatusCounts> {
  if (options.syncReservations) {
    await syncCatalogReservationStatuses();
  }

  const entries = await Promise.all(
    PRODUCT_STATUSES.map(async (status) => [status, await countCatalogItems(status)] as const)
  );

  return Object.fromEntries(entries) as CatalogStatusCounts;
}

export async function listPublicActiveProducts(publicAttributes: AttributeDTO[]): Promise<ProductDTO[]> {
  const publicAttributeIds = new Set(publicAttributes.map((attribute) => attribute.id));
  const products = await listProducts("active", { syncReservations: false });

  return products.map((product) => ({
    ...product,
    values: Object.fromEntries(
      Object.entries(product.values).filter(([attributeId]) => publicAttributeIds.has(attributeId))
    ),
  }));
}

export async function getProductById(productId: string): Promise<ProductDTO | null> {
  const row = await fetchOneCatalogItem(productId);
  if (!row) {
    return null;
  }
  const valuesByItemId = await fetchAttributeValueMap();
  return rowToProduct(row, valuesByItemId);
}

export async function listAttributes(): Promise<AttributeDTO[]> {
  return listFields("all");
}

export async function createProduct(input: CreateProductDTO): Promise<ProductDTO> {
  assertRequiredText(input.name, "name");
  assertRequiredText(input.serial, "serial");
  assertValidPrice(input.price);
  assertValidStockCount(input.stockCount);

  const supabase = getServerSupabaseAdminClient();
  const images = normalizeProductImages(input.images, input.image);
  const discountPatch = discountPatchFromInput(
    input.discountInput,
    input.price,
    input.discountReason
  );

  const { data: inserted, error: insertError } = await supabase
    .from("catalog_items")
    .insert({
      item_type: mapCategoryToDb(input.category),
      name: input.name.trim(),
      serial_number: input.serial.trim(),
      price_cents: Math.round(input.price * 100),
      stock_count: input.stockCount,
      status: input.stockCount === 0 ? "sold" : "active",
      description: input.description.trim(),
      rating: input.rating ?? 0,
      ...discountPatch,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new AdapterError("Failed to create product.", insertError);
  }

  const createdId = inserted.id as string;
  const driveTypeDb = mapDriveTypeToDb(input.type);

  if (input.category === "Bicycle") {
    const { error } = await supabase
      .from("bicycles")
      .insert({ catalog_item_id: createdId, drive_type: driveTypeDb ?? "manual" });
    if (error) {
      throw new AdapterError("Failed to create bicycle extension row.", error);
    }
  } else {
    const { error } = await supabase
      .from("parts")
      .insert({ catalog_item_id: createdId });
    if (error) {
      throw new AdapterError("Failed to create part extension row.", error);
    }
  }

  await syncProductImages(createdId, images);

  await syncAttributeValues(createdId, input.category, input.values);

  const created = await getProductById(createdId);
  if (!created) {
    throw new NotFoundError("Created product could not be loaded.", { createdId });
  }
  return created;
}

export async function updateProduct(
  productId: string,
  input: UpdateProductDTO
): Promise<ProductDTO> {
  const previous = await getProductById(productId);
  if (!previous) {
    throw new NotFoundError("Product not found.", { productId });
  }

  const patch: Record<string, unknown> = {};
  const nextPrice = input.price ?? previous.price;
  if (input.name !== undefined) {
    assertRequiredText(input.name, "name");
    patch.name = input.name.trim();
  }
  if (input.serial !== undefined) {
    assertRequiredText(input.serial, "serial");
    patch.serial_number = input.serial.trim();
  }
  if (input.description !== undefined) {
    patch.description = input.description.trim();
  }
  if (input.price !== undefined) {
    assertValidPrice(input.price);
    patch.price_cents = Math.round(input.price * 100);
  }
  if (input.discountInput !== undefined) {
    Object.assign(
      patch,
      discountPatchFromInput(input.discountInput, nextPrice, input.discountReason)
    );
  } else if (input.discountReason !== undefined) {
    patch.discount_reason = input.discountReason;
  }
  if (input.stockCount !== undefined) {
    assertValidStockCount(input.stockCount);
    patch.stock_count = input.stockCount;
    patch.status =
      input.stockCount === 0
        ? "sold"
        : previous.status === "sold"
        ? "active"
        : previous.status;
  }

  const supabase = getServerSupabaseAdminClient();
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("catalog_items")
      .update(patch)
      .eq("id", productId);

    if (error) {
      throw new AdapterError("Failed to update catalog item fields.", error);
    }
  }

  if (input.type && previous.category === "Bicycle") {
    const driveTypeDb = mapDriveTypeToDb(input.type);
    const { error } = await supabase
      .from("bicycles")
      .update({ drive_type: driveTypeDb ?? "manual" })
      .eq("catalog_item_id", productId);
    if (error) {
      throw new AdapterError("Failed to update bicycle drive type.", error);
    }
  }

  if (input.images !== undefined || input.image !== undefined) {
    await syncProductImages(productId, normalizeProductImages(input.images, input.image));
  }

  if (input.values !== undefined) {
    await syncAttributeValues(productId, previous.category, input.values);
  }

  const updated = await getProductById(productId);
  if (!updated) {
    throw new NotFoundError("Product not found after update.", { productId });
  }
  return updated;
}

export async function updatePrice(productId: string, price: number): Promise<ProductDTO> {
  assertValidPrice(price);
  return updateProduct(productId, { price });
}

export async function updateStockCount(
  productId: string,
  stockCount: number
): Promise<ProductDTO> {
  assertValidStockCount(stockCount);
  return updateProduct(productId, { stockCount });
}

export async function markAsSold(
  productId: string,
  input: MarkSoldDTO
): Promise<ProductDTO> {
  assertValidPrice(input.soldPrice);
  const product = await getProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found.", { productId });
  }
  if (product.status === "archived") {
    throw new ValidationError("Deleted products cannot be marked as sold.");
  }
  if (product.status === "sold") {
    throw new ValidationError("Product is already sold.");
  }
  if (product.stockCount <= 0) {
    throw new ValidationError("Out-of-stock products cannot be marked as sold.");
  }

  const supabase = getServerSupabaseAdminClient();
  const soldAt = input.soldAt ?? new Date().toISOString();

  const { error: saleError } = await supabase.from("sales").insert({
    catalog_item_id: productId,
    quantity: 1,
    sale_channel: input.saleChannel,
    sale_price_cents: Math.round(input.soldPrice * 100),
    currency_code: "GEL",
    sold_at: soldAt,
    audit_note: input.auditNote ?? null,
  });

  if (saleError) {
    throw new AdapterError("Failed to insert sale record.", saleError);
  }

  const { error: itemError } = await supabase
    .from("catalog_items")
    .update({ status: "sold", stock_count: 0 })
    .eq("id", productId);

  if (itemError) {
    throw new AdapterError("Failed to mark product as sold.", itemError);
  }

  const updated = await getProductById(productId);
  if (!updated) {
    throw new NotFoundError("Product not found after sale.", { productId });
  }
  return updated;
}

export async function archiveProduct(productId: string): Promise<void> {
  const supabase = getServerSupabaseAdminClient();
  const { error: reservationError } = await supabase
    .from("reservations")
    .update({
      status: "cancelled",
      cancellation_reason_code: "other",
      cancellation_note: "Cancelled because product was deleted.",
    })
    .eq("catalog_item_id", productId)
    .eq("status", "active");

  if (reservationError) {
    throw new AdapterError("Failed to cancel active reservation before deleting product.", reservationError);
  }

  const { error } = await supabase
    .from("catalog_items")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (error) {
    throw new AdapterError("Failed to archive product.", error);
  }
}

export async function clearArchivedProduct(productId: string): Promise<void> {
  const product = await getProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found.", { productId });
  }
  if (product.status !== "archived") {
    throw new ValidationError("Only deleted products can be cleared.");
  }

  const supabase = getServerSupabaseAdminClient();
  const { data: imageRows, error: imageReadError } = await supabase
    .from("product_images")
    .select("bucket_name,object_path,external_url")
    .eq("catalog_item_id", productId);

  if (imageReadError) {
    throw new AdapterError("Failed to read product images before clearing product.", imageReadError);
  }

  const candidateRows = ((imageRows ?? []) as ProductImageStorageRow[]).filter(Boolean);

  const { error: clearError } = await supabase.rpc("clear_archived_catalog_item", {
    p_item_id: productId,
  });

  if (clearError) {
    throw new AdapterError("Failed to clear deleted product.", clearError);
  }

  await removeUnusedStorageObjects(
    candidateRows,
    "Product was cleared, but image cleanup could not verify remaining usage.",
    "Product was cleared, but one or more image files could not be removed from storage."
  );
}

export async function restoreProduct(productId: string): Promise<ProductDTO> {
  const product = await getProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found.", { productId });
  }
  if (product.status !== "archived") {
    throw new ValidationError("Only deleted products can be restored.");
  }

  const supabase = getServerSupabaseAdminClient();
  const nextStatus = product.stockCount > 0 ? "active" : "sold";
  const { error } = await supabase
    .from("catalog_items")
    .update({
      status: nextStatus,
      archived_at: null,
      archived_by_actor_id: null,
    })
    .eq("id", productId);

  if (error) {
    throw new AdapterError("Failed to restore product.", error);
  }

  const restored = await getProductById(productId);
  if (!restored) {
    throw new NotFoundError("Product not found after restore.", { productId });
  }
  return restored;
}
