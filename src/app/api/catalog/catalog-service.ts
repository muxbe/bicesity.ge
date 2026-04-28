import type {
  AttributeDTO,
  CreateProductDTO,
  MarkSoldDTO,
  ProductCategory,
  ProductDTO,
  ProductDriveType,
  ProductStatusFilter,
  UpdateProductDTO,
} from "@/features/catalog/dto/catalog-dto";
import { listFields } from "@/app/api/fields/field-service";
import {
  assertRequiredText,
  assertValidPrice,
  assertValidStockCount,
} from "@/features/catalog/domain/catalog-validation";
import {
  buildDiscountFromSource,
  parseDiscountInput,
} from "@/features/catalog/domain/catalog-discount";
import {
  getFallbackImage,
  normalizeProductImages as normalizeCatalogProductImages,
} from "@/features/catalog/repositories/catalog-helpers";
import { AdapterError, NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type CatalogItemRow = {
  id: string;
  name: string;
  item_type: "bicycle" | "part";
  serial_number: string;
  price_cents: number;
  stock_count: number;
  status: "active" | "reserved" | "sold" | "archived";
  description: string;
  rating: number | null;
  discount_type: "amount" | "percent" | null;
  discount_amount_cents: number | null;
  discount_percent_bps: number | null;
  discount_reason: string | null;
  bicycles: { drive_type: string } | { drive_type: string }[] | null;
  product_images:
    | {
        bucket_name: string | null;
        object_path: string | null;
        external_url: string | null;
        is_primary: boolean;
        sort_order: number;
      }[]
    | null;
};

type AttributeRow = {
  id: string;
  display_name: string;
  category: "bicycle" | "part";
  is_public: boolean;
  sort_order: number;
  field_key: string;
  data_type: "text" | "number" | "boolean" | "date" | "image" | "url";
};

type AttributeValidationRow = {
  id: string;
  display_name: string;
  input_mode: "free_text" | "single_select" | null;
};

type AttributeOptionValidationRow = {
  attribute_id: string;
  value: string;
};

type ValueRow = {
  catalog_item_id: string;
  attribute_id: string;
  value_text: string | null;
};

type ProductImageStorageRow = {
  bucket_name: string | null;
  object_path: string | null;
  external_url: string | null;
};

type ReserveProductInput = {
  reservedForAt?: string;
  expiresAt?: string;
  note?: string | null;
  sellerComment?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  messengerProfileUrl?: string | null;
  reservationSource?: "manual" | "messenger" | "phone" | "walk_in" | "other";
};

type CancelReservationInput = {
  note?: string | null;
};

type ListProductsOptions = {
  syncReservations?: boolean;
};

const RESERVATION_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

const CATALOG_ITEM_SELECT =
  "id,name,item_type,serial_number,price_cents,stock_count,status,description,rating,discount_type,discount_amount_cents,discount_percent_bps,discount_reason,bicycles(drive_type),product_images(bucket_name,object_path,external_url,is_primary,sort_order)";

function mapCategoryFromDb(dbCategory: "bicycle" | "part"): ProductCategory {
  return dbCategory === "bicycle" ? "Bicycle" : "Parts";
}

function mapCategoryToDb(category: ProductCategory): "bicycle" | "part" {
  return category === "Bicycle" ? "bicycle" : "part";
}

function mapDriveTypeFromDb(value: string | undefined): ProductDriveType | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "manual") {
    return "Manual";
  }
  if (value === "electrical") {
    return "Electrical";
  }
  return value;
}

function mapDriveTypeToDb(value: ProductDriveType | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "Manual") {
    return "manual";
  }
  if (trimmed === "Electrical") {
    return "electrical";
  }
  return trimmed;
}

function resolveReservationExpiryIso(reservedDate: Date, requestedExpiresAt?: string): string {
  const fallbackExpiresAt = new Date(reservedDate.getTime() + RESERVATION_HOLD_MS);
  if (!requestedExpiresAt) {
    return fallbackExpiresAt.toISOString();
  }

  const requestedExpiresDate = new Date(requestedExpiresAt);
  if (Number.isNaN(requestedExpiresDate.getTime())) {
    throw new ValidationError("Reservation expiry date is invalid.");
  }

  if (requestedExpiresDate.getTime() <= reservedDate.getTime()) {
    return fallbackExpiresAt.toISOString();
  }

  return requestedExpiresDate.toISOString();
}

function isMissingReservationContextColumn(error: { code?: string; message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    message.includes("customer_name") ||
    message.includes("customer_phone") ||
    message.includes("messenger_profile_url") ||
    message.includes("reservation_source")
  );
}

function pickPrimaryImage(
  images: CatalogItemRow["product_images"],
  category: ProductCategory
): string {
  return normalizeCatalogProductImages(extractImageUrls(images), category)[0];
}

function extractImageUrls(images: CatalogItemRow["product_images"]): string[] {
  if (!images || images.length === 0) {
    return [];
  }

  const byOrder = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const primary = byOrder.find((image) => image.is_primary && image.external_url);
  const ordered = [
    ...(primary ? [primary] : []),
    ...byOrder.filter((image) => image !== primary),
  ];
  const seen = new Set<string>();
  return ordered
    .map((image) => image.external_url?.trim() || storagePublicUrl(image.bucket_name, image.object_path))
    .filter((url) => {
      if (!url || seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });
}

function storagePublicUrl(bucket: string | null | undefined, objectPath: string | null | undefined): string {
  const trimmedBucket = bucket?.trim();
  const trimmedPath = objectPath?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!trimmedBucket || !trimmedPath || !supabaseUrl) {
    return "";
  }

  const encodedPath = trimmedPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(trimmedBucket)}/${encodedPath}`;
}

function storageObjectFromPublicUrl(url: string): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && parsed.origin !== new URL(supabaseUrl).origin) {
      return null;
    }

    const prefixes = ["/storage/v1/object/public/", "/storage/v1/render/image/public/"];
    const prefix = prefixes.find((candidate) => parsed.pathname.startsWith(candidate));
    if (!prefix) {
      return null;
    }

    const remainder = parsed.pathname.slice(prefix.length);
    const separatorIndex = remainder.indexOf("/");
    if (separatorIndex <= 0 || separatorIndex === remainder.length - 1) {
      return null;
    }

    const bucket = decodeURIComponent(remainder.slice(0, separatorIndex));
    const path = remainder
      .slice(separatorIndex + 1)
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");

    if (!bucket || !path) {
      return null;
    }
    return { bucket, path };
  } catch {
    return null;
  }
}

function storageObjectFromImageRow(
  image: ProductImageStorageRow
): { bucket: string; path: string } | null {
  const bucket = image.bucket_name?.trim();
  const path = image.object_path?.trim();
  if (bucket && path) {
    return { bucket, path };
  }
  const externalUrl = image.external_url?.trim();
  return externalUrl ? storageObjectFromPublicUrl(externalUrl) : null;
}

function storageObjectKey(object: { bucket: string; path: string }) {
  return `${object.bucket}/${object.path}`;
}

function uniqueStorageObjects(rows: ProductImageStorageRow[]) {
  const seen = new Set<string>();
  const objects: Array<{ bucket: string; path: string }> = [];
  for (const row of rows) {
    const object = storageObjectFromImageRow(row);
    if (!object) {
      continue;
    }
    const key = storageObjectKey(object);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    objects.push(object);
  }
  return objects;
}

function imageInsertRow(productId: string, image: string, index: number) {
  const storageObject = storageObjectFromPublicUrl(image);
  return {
    catalog_item_id: productId,
    bucket_name: storageObject?.bucket ?? null,
    object_path: storageObject?.path ?? null,
    external_url: storageObject ? null : image,
    is_primary: index === 0,
    sort_order: index,
  };
}

async function removeUnusedStorageObjects(
  candidateRows: ProductImageStorageRow[],
  readErrorMessage: string,
  removeErrorMessage: string
) {
  const candidateObjects = uniqueStorageObjects(candidateRows);
  if (candidateObjects.length === 0) {
    return;
  }

  const supabase = getServerSupabaseAdminClient();
  const { data: remainingImageRows, error: remainingImageError } = await supabase
    .from("product_images")
    .select("bucket_name,object_path,external_url");

  if (remainingImageError) {
    throw new AdapterError(readErrorMessage, remainingImageError);
  }

  const stillUsedKeys = new Set(
    uniqueStorageObjects(((remainingImageRows ?? []) as ProductImageStorageRow[]).filter(Boolean)).map(
      storageObjectKey
    )
  );
  const unusedObjects = candidateObjects.filter((object) => !stillUsedKeys.has(storageObjectKey(object)));
  const pathsByBucket = new Map<string, string[]>();
  for (const object of unusedObjects) {
    pathsByBucket.set(object.bucket, [...(pathsByBucket.get(object.bucket) ?? []), object.path]);
  }

  for (const [bucket, paths] of Array.from(pathsByBucket.entries())) {
    const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
    if (storageError) {
      throw new AdapterError(removeErrorMessage, storageError);
    }
  }
}

function rowToProduct(
  row: CatalogItemRow,
  valuesByItemId: Map<string, Record<string, string>>
): ProductDTO {
  const category = mapCategoryFromDb(row.item_type);
  const bicyclesRow = Array.isArray(row.bicycles) ? row.bicycles[0] : row.bicycles;
  const price = row.price_cents / 100;
  const discount = buildDiscountFromSource(price, {
    discountType: row.discount_type,
    discountAmount:
      row.discount_amount_cents === null ? null : row.discount_amount_cents / 100,
    discountPercent:
      row.discount_percent_bps === null ? null : row.discount_percent_bps / 100,
    discountReason: row.discount_reason,
  });

  return {
    id: row.id,
    name: row.name,
    category,
    type: category === "Bicycle" ? mapDriveTypeFromDb(bicyclesRow?.drive_type) : undefined,
    serial: row.serial_number,
    price,
    stockCount: row.stock_count,
    inStock: row.stock_count > 0,
    image: pickPrimaryImage(row.product_images, category),
    images: normalizeCatalogProductImages(extractImageUrls(row.product_images), category),
    description: row.description,
    values: valuesByItemId.get(row.id) ?? {},
    rating: row.rating ?? 0,
    status: row.status,
    ...discount,
  };
}

function normalizeProductImages(images: string[] | undefined, fallbackImage?: string): string[] {
  const seen = new Set<string>();
  return [...(images ?? []), fallbackImage ?? ""]
    .map((image) => image.trim())
    .filter((image) => {
      if (!image || seen.has(image)) {
        return false;
      }
      seen.add(image);
      return true;
    })
    .slice(0, 5);
}

async function syncProductImages(productId: string, images: string[]) {
  const supabase = getServerSupabaseAdminClient();
  const { data: previousImageRows, error: readPreviousError } = await supabase
    .from("product_images")
    .select("bucket_name,object_path,external_url")
    .eq("catalog_item_id", productId);

  if (readPreviousError) {
    throw new AdapterError("Failed to read product images before replacing them.", readPreviousError);
  }

  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("catalog_item_id", productId);

  if (deleteError) {
    throw new AdapterError("Failed to replace product images.", deleteError);
  }

  if (images.length === 0) {
    await removeUnusedStorageObjects(
      ((previousImageRows ?? []) as ProductImageStorageRow[]).filter(Boolean),
      "Product images were removed, but image cleanup could not verify remaining usage.",
      "Product images were removed, but one or more image files could not be removed from storage."
    );
    return;
  }

  const { error: insertError } = await supabase.from("product_images").insert(
    images.map((image, index) => imageInsertRow(productId, image, index))
  );

  if (insertError) {
    throw new AdapterError("Failed to attach product images.", insertError);
  }

  await removeUnusedStorageObjects(
    ((previousImageRows ?? []) as ProductImageStorageRow[]).filter(Boolean),
    "Product images were replaced, but image cleanup could not verify remaining usage.",
    "Product images were replaced, but one or more old image files could not be removed from storage."
  );
}

function parseDiscountOrThrow(input: string | undefined, price: number) {
  const parsed = parseDiscountInput(input, price);
  if (!parsed.ok) {
    throw new ValidationError(parsed.error);
  }
  return parsed;
}

function discountPatchFromInput(
  input: string | undefined,
  price: number,
  reason: string | null | undefined
): Record<string, unknown> {
  const discount = parseDiscountOrThrow(input, price);
  return {
    discount_type: discount.discountType,
    discount_amount_cents:
      discount.discountAmount === null ? null : Math.round(discount.discountAmount * 100),
    discount_percent_bps:
      discount.discountPercent === null ? null : Math.round(discount.discountPercent * 100),
    discount_reason: reason ?? null,
  };
}

function appendReservationContextToComment(
  sellerComment: string,
  input: {
    customerName: string | null;
    customerPhone: string | null;
    messengerProfileUrl: string | null;
    reservationSource: ReserveProductInput["reservationSource"];
  }
) {
  const contextLines = [
    input.customerName ? `Customer: ${input.customerName}` : null,
    input.customerPhone ? `Phone: ${input.customerPhone}` : null,
    input.messengerProfileUrl ? `Messenger: ${input.messengerProfileUrl}` : null,
    input.reservationSource && input.reservationSource !== "manual"
      ? `Source: ${input.reservationSource}`
      : null,
  ].filter((line): line is string => Boolean(line));

  if (contextLines.length === 0) {
    return sellerComment;
  }

  return [sellerComment, "Customer details:", ...contextLines].filter(Boolean).join("\n");
}

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

export async function reserveProduct(
  productId: string,
  input: ReserveProductInput = {}
): Promise<ProductDTO> {
  const product = await getProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found.", { productId });
  }
  if (product.status === "reserved") {
    throw new ValidationError("Product is already reserved.");
  }
  if (product.status !== "active") {
    throw new ValidationError("Only active products can be reserved.");
  }
  if (product.stockCount <= 0) {
    throw new ValidationError("Out-of-stock products cannot be reserved.");
  }

  const reservedForAt = input.reservedForAt ?? new Date().toISOString();
  const reservedDate = new Date(reservedForAt);
  if (Number.isNaN(reservedDate.getTime())) {
    throw new ValidationError("Reservation date is invalid.");
  }
  const expiresAt = resolveReservationExpiryIso(reservedDate, input.expiresAt);
  const sellerComment = input.sellerComment?.trim() || input.note?.trim() || "";
  const customerName = input.customerName?.trim() || null;
  const customerPhone = input.customerPhone?.trim() || null;
  const messengerProfileUrl = input.messengerProfileUrl?.trim() || null;
  const reservationSource = input.reservationSource ?? "manual";
  const fallbackSellerComment = appendReservationContextToComment(sellerComment, {
    customerName,
    customerPhone,
    messengerProfileUrl,
    reservationSource,
  });

  const supabase = getServerSupabaseAdminClient();
  const { data: existingReservation, error: existingReservationError } = await supabase
    .from("reservations")
    .select("id")
    .eq("catalog_item_id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (existingReservationError) {
    throw new AdapterError("Failed to check existing reservation.", existingReservationError);
  }

  if (!existingReservation) {
    const baseReservation = {
      catalog_item_id: productId,
      status: "active",
      reserved_for_at: reservedForAt,
      expires_at: expiresAt,
      note: input.note?.trim() || null,
      seller_comment: sellerComment,
    };
    const contextReservation = {
      ...baseReservation,
      customer_name: customerName,
      customer_phone: customerPhone,
      messenger_profile_url: messengerProfileUrl,
      reservation_source: reservationSource,
    };
    const { error } = await supabase.from("reservations").insert(contextReservation);

    if (error && error.code !== "23505") {
      if (isMissingReservationContextColumn(error)) {
        const { error: fallbackError } = await supabase.from("reservations").insert({
          ...baseReservation,
          seller_comment: fallbackSellerComment,
        });
        if (fallbackError && fallbackError.code !== "23505") {
          throw new AdapterError("Failed to reserve product.", fallbackError);
        }
      } else {
        throw new AdapterError("Failed to reserve product.", error);
      }
    }
  } else {
    const baseReservation = {
      reserved_for_at: reservedForAt,
      expires_at: expiresAt,
      note: input.note?.trim() || null,
      seller_comment: sellerComment,
    };
    const contextReservation = {
      ...baseReservation,
      customer_name: customerName,
      customer_phone: customerPhone,
      messenger_profile_url: messengerProfileUrl,
      reservation_source: reservationSource,
    };
    const { error } = await supabase
      .from("reservations")
      .update(contextReservation)
      .eq("id", existingReservation.id);

    if (error) {
      if (isMissingReservationContextColumn(error)) {
        const { error: fallbackError } = await supabase
          .from("reservations")
          .update({
            ...baseReservation,
            seller_comment: fallbackSellerComment,
          })
          .eq("id", existingReservation.id);
        if (fallbackError) {
          throw new AdapterError("Failed to update existing reservation.", fallbackError);
        }
      } else {
        throw new AdapterError("Failed to update existing reservation.", error);
      }
    }
  }

  // Keep the item visible on Reserved Items even if database status triggers were not installed.
  const { error: statusError } = await supabase
    .from("catalog_items")
    .update({ status: "reserved" })
    .eq("id", productId);

  if (statusError) {
    throw new AdapterError("Failed to move product to reserved items.", statusError);
  }

  const updated = await getProductById(productId);
  if (!updated) {
    throw new NotFoundError("Product not found after reservation.", { productId });
  }
  return updated;
}

export async function cancelReservationForProduct(
  productId: string,
  input: CancelReservationInput = {}
): Promise<ProductDTO> {
  const product = await getProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found.", { productId });
  }
  if (product.status !== "reserved") {
    throw new ValidationError("Only reserved products can have reservations cancelled.");
  }

  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reservations")
    .update({
      status: "cancelled",
      cancellation_reason_code: "seller_cancelled",
      cancellation_note: input.note?.trim() || "Cancelled from reserved items page.",
    })
    .eq("catalog_item_id", productId)
    .eq("status", "active")
    .select("id");

  if (error) {
    throw new AdapterError("Failed to cancel reservation.", error);
  }
  if (!data || data.length === 0) {
    throw new ValidationError("No active reservation was found for this product.");
  }

  // Keep the item visible on Active Items even if database status triggers were not installed.
  const { error: statusError } = await supabase
    .from("catalog_items")
    .update({ status: "active" })
    .eq("id", productId);

  if (statusError) {
    throw new AdapterError("Failed to move product back to active items.", statusError);
  }

  const updated = await getProductById(productId);
  if (!updated) {
    throw new NotFoundError("Product not found after cancelling reservation.", { productId });
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
