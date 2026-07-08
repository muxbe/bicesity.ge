import type { MarkSoldDTO, ProductDTO } from "@/features/catalog/dto/catalog-dto";
import type { ProductImageStorageRow } from "@/app/api/catalog/services/catalog-types";
import { removeUnusedStorageObjects } from "@/app/api/catalog/services/catalog-images";
import { getProductById } from "@/app/api/catalog/services/catalog-queries";
import { assertValidPrice } from "@/features/catalog/domain/catalog-validation";
import { AdapterError, NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export {
  createProduct,
  updatePrice,
  updateProduct,
  updateStockCount,
} from "@/app/api/catalog/services/catalog-commands";
export {
  countProductsByStatus,
  getProductById,
  listAttributes,
  listProducts,
  listPublicActiveProducts,
} from "@/app/api/catalog/services/catalog-queries";

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
