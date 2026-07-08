import type {
  CreateProductDTO,
  ProductDTO,
  UpdateProductDTO,
} from "@/features/catalog/dto/catalog-dto";
import { syncAttributeValues } from "@/app/api/catalog/services/catalog-attributes";
import {
  normalizeProductImages,
  syncProductImages,
} from "@/app/api/catalog/services/catalog-images";
import {
  discountPatchFromInput,
  mapCategoryToDb,
  mapDriveTypeToDb,
} from "@/app/api/catalog/services/catalog-mappers";
import { getProductById } from "@/app/api/catalog/services/catalog-queries";
import {
  assertRequiredText,
  assertValidPrice,
  assertValidStockCount,
} from "@/features/catalog/domain/catalog-validation";
import { AdapterError, NotFoundError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

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
