import type {
  AttributeDTO,
  CatalogStatusCounts,
  ProductDTO,
  ProductStatus,
  ProductStatusFilter,
} from "@/features/catalog/dto/catalog-dto";
import type {
  CatalogItemRow,
  ListProductsOptions,
} from "@/app/api/catalog/services/catalog-types";
import {
  CATALOG_ITEM_SELECT,
  PRODUCT_STATUSES,
} from "@/app/api/catalog/services/catalog-types";
import { fetchAttributeValueMap } from "@/app/api/catalog/services/catalog-attributes";
import { rowToProduct } from "@/app/api/catalog/services/catalog-mappers";
import { syncCatalogReservationStatuses } from "@/app/api/catalog/services/catalog-reservation-sync";
import { listFields } from "@/app/api/fields/field-service";
import { AdapterError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function fetchCatalogItems(status: ProductStatusFilter = "all"): Promise<CatalogItemRow[]> {
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

export async function countCatalogItems(status: ProductStatus): Promise<number> {
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

export async function fetchOneCatalogItem(productId: string): Promise<CatalogItemRow | null> {
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
