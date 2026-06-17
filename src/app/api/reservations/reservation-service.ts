import { getProductById } from "@/app/api/catalog/catalog-service";
import type { ProductCategory, ProductDTO } from "@/features/catalog/dto/catalog-dto";
import {
  getFallbackImage,
  normalizeProductImage,
} from "@/features/catalog/repositories/catalog-helpers";
import {
  ReservationCancelReason,
  ReservationDTO,
  ReservationStatus,
  UpsertReservationDTO,
} from "@/features/reservations/dto/reservation-dto";
import { parseReservationCommentContext } from "@/features/reservations/dto/reservation-comment-context";
import { AdapterError, NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type ReservationRow = {
  id: string;
  catalog_item_id: string;
  status: ReservationStatus;
  reserved_for_at: string;
  expires_at: string;
  cancellation_reason_code: ReservationCancelReason | null;
  cancellation_note: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  messenger_profile_url: string | null;
  reservation_source: ReservationDTO["reservationSource"] | null;
  seller_comment: string | null;
  created_at: string;
  updated_at: string;
  catalog_items:
    | {
        id: string;
        name: string;
        item_type: "bicycle" | "part";
        serial_number: string;
        price_cents: number;
        product_images:
          | {
              external_url: string | null;
              is_primary: boolean;
              sort_order: number;
            }[]
          | null;
      }
    | {
        id: string;
        name: string;
        item_type: "bicycle" | "part";
        serial_number: string;
        price_cents: number;
        product_images:
          | {
              external_url: string | null;
              is_primary: boolean;
              sort_order: number;
            }[]
          | null;
      }[]
    | null;
};

type ProductReservationInput = Omit<UpsertReservationDTO, "productId" | "reservedForAt"> & {
  reservedForAt?: string;
};

const RESERVATION_HOLD_MS = 7 * 24 * 60 * 60 * 1000;
const FULL_SELECT =
  "id,catalog_item_id,status,reserved_for_at,expires_at,cancellation_reason_code,cancellation_note,customer_name,customer_phone,messenger_profile_url,reservation_source,seller_comment,created_at,updated_at,catalog_items(id,name,item_type,serial_number,price_cents,product_images(external_url,is_primary,sort_order))";
const FALLBACK_SELECT =
  "id,catalog_item_id,status,reserved_for_at,expires_at,cancellation_reason_code,cancellation_note,seller_comment,created_at,updated_at,catalog_items(id,name,item_type,serial_number,price_cents,product_images(external_url,is_primary,sort_order))";

export function parseReservationStatus(value: string | null): ReservationStatus | "all" {
  return value === "active" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "expired"
    ? value
    : "all";
}

function mapCategory(itemType: "bicycle" | "part"): ProductCategory {
  return itemType === "bicycle" ? "Bicycle" : "Parts";
}

function pickImage(
  images:
    | {
        external_url: string | null;
        is_primary: boolean;
        sort_order: number;
      }[]
    | null,
  category: ProductCategory
) {
  if (!images || images.length === 0) {
    return getFallbackImage(category);
  }
  const primary = images.find((image) => image.is_primary && image.external_url);
  if (primary?.external_url) {
    return normalizeProductImage(primary.external_url, category);
  }
  const first = [...images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .find((image) => image.external_url);
  return normalizeProductImage(first?.external_url, category);
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

function toDto(row: ReservationRow): ReservationDTO | null {
  const item = Array.isArray(row.catalog_items) ? row.catalog_items[0] : row.catalog_items;
  if (!item) {
    return null;
  }
  const category = mapCategory(item.item_type);
  const commentContext = parseReservationCommentContext(row.seller_comment);
  const dbReservationSource = row.reservation_source ?? "manual";
  return {
    id: row.id,
    productId: row.catalog_item_id,
    productName: item.name,
    category,
    serial: item.serial_number,
    image: pickImage(item.product_images, category),
    price: item.price_cents / 100,
    status: row.status,
    reservedForAt: row.reserved_for_at,
    expiresAt: row.expires_at,
    cancellationReasonCode: row.cancellation_reason_code,
    cancellationNote: row.cancellation_note,
    customerName: row.customer_name?.trim() || commentContext.customerName,
    customerPhone: row.customer_phone?.trim() || commentContext.customerPhone,
    messengerProfileUrl: row.messenger_profile_url?.trim() || commentContext.messengerProfileUrl,
    reservationSource:
      dbReservationSource !== "manual"
        ? dbReservationSource
        : commentContext.reservationSource ?? dbReservationSource,
    sellerComment: commentContext.sellerComment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveReservationExpiryIso(reservedForAt: string, requestedExpiresAt?: string): string {
  const reservedDate = new Date(reservedForAt);
  if (Number.isNaN(reservedDate.getTime())) {
    throw new ValidationError("Reservation date is invalid.");
  }

  const fallbackExpiresAt = new Date(reservedDate.getTime() + RESERVATION_HOLD_MS);
  if (!requestedExpiresAt) {
    return fallbackExpiresAt.toISOString();
  }

  const requestedExpiresDate = new Date(requestedExpiresAt);
  if (
    Number.isNaN(requestedExpiresDate.getTime()) ||
    requestedExpiresDate.getTime() <= reservedDate.getTime()
  ) {
    return fallbackExpiresAt.toISOString();
  }

  return requestedExpiresDate.toISOString();
}

function addActor<T extends Record<string, unknown>>(
  values: T,
  actorUserId: string | undefined,
  mode: "insert" | "update"
) {
  if (!actorUserId) {
    return values;
  }
  return {
    ...values,
    updated_by_actor_id: actorUserId,
    ...(mode === "insert" ? { created_by_actor_id: actorUserId } : {}),
  };
}

async function fetchReservationRows(
  status: ReservationStatus | "all",
  productId?: string
): Promise<ReservationRow[]> {
  const supabase = getServerSupabaseAdminClient();

  let query = supabase
    .from("reservations")
    .select(FULL_SELECT)
    .order("reserved_for_at", { ascending: true });
  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (productId) {
    query = query.eq("catalog_item_id", productId);
  }

  const primaryResult = await query;
  let data = primaryResult.data as unknown;
  let error = primaryResult.error;
  if (error && isMissingReservationContextColumn(error)) {
    let fallbackQuery = supabase
      .from("reservations")
      .select(FALLBACK_SELECT)
      .order("reserved_for_at", { ascending: true });
    if (status !== "all") {
      fallbackQuery = fallbackQuery.eq("status", status);
    }
    if (productId) {
      fallbackQuery = fallbackQuery.eq("catalog_item_id", productId);
    }
    const fallbackResult = await fallbackQuery;
    data = fallbackResult.data as unknown;
    error = fallbackResult.error;
  }

  if (error) {
    throw new AdapterError("Failed to fetch reservations.", error);
  }

  return (data ?? []) as ReservationRow[];
}

async function getActiveReservationByProductId(productId: string): Promise<ReservationDTO | null> {
  const rows = await fetchReservationRows("active", productId);
  return rows.map(toDto).find((reservation): reservation is ReservationDTO => Boolean(reservation)) ?? null;
}

export async function listReservations(
  status: ReservationStatus | "all"
): Promise<ReservationDTO[]> {
  const rows = await fetchReservationRows(status);
  return rows
    .map(toDto)
    .filter((reservation): reservation is ReservationDTO => Boolean(reservation));
}

export async function upsertReservation(
  input: UpsertReservationDTO,
  actorUserId?: string
): Promise<ReservationDTO> {
  if (!input.productId) {
    throw new ValidationError("productId is required.");
  }
  if (!input.reservedForAt) {
    throw new ValidationError("reservedForAt is required.");
  }

  const expiresAt = resolveReservationExpiryIso(input.reservedForAt, input.expiresAt);
  const supabase = getServerSupabaseAdminClient();
  const reservationValues = {
    status: "active",
    reserved_for_at: input.reservedForAt,
    expires_at: expiresAt,
    note: input.note?.trim() || null,
    customer_name: input.customerName?.trim() || null,
    customer_phone: input.customerPhone?.trim() || null,
    messenger_profile_url: input.messengerProfileUrl?.trim() || null,
    reservation_source: input.reservationSource ?? "manual",
    seller_comment: input.sellerComment?.trim() || input.note?.trim() || "",
  };

  const { data: existing, error: existingError } = await supabase
    .from("reservations")
    .select("id")
    .eq("catalog_item_id", input.productId)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    throw new AdapterError("Failed to read existing reservation.", existingError);
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("reservations")
      .update(addActor(reservationValues, actorUserId, "update"))
      .eq("id", existing.id);

    if (error) {
      throw new AdapterError("Failed to update reservation.", error);
    }
  } else {
    const { error } = await supabase.from("reservations").insert(
      addActor(
        {
          ...reservationValues,
          catalog_item_id: input.productId,
        },
        actorUserId,
        "insert"
      )
    );

    if (error) {
      throw new AdapterError("Failed to create reservation.", error);
    }
  }

  const reservation = await getActiveReservationByProductId(input.productId);
  if (!reservation) {
    throw new AdapterError("Reservation was not found after upsert.");
  }

  return reservation;
}

export async function cancelActiveReservationByProductId(
  productId: string,
  reason: ReservationCancelReason,
  note?: string,
  actorUserId?: string
): Promise<void> {
  if (!productId) {
    throw new ValidationError("productId is required.");
  }

  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reservations")
    .update(
      addActor(
        {
          status: "cancelled",
          cancellation_reason_code: reason,
          cancellation_note: note?.trim() || null,
        },
        actorUserId,
        "update"
      )
    )
    .eq("catalog_item_id", productId)
    .eq("status", "active")
    .select("id");

  if (error) {
    throw new AdapterError("Failed to cancel reservation.", error);
  }
  if (!data || data.length === 0) {
    throw new ValidationError("No active reservation was found for this product.");
  }
}

export async function completeActiveReservationByProductId(
  productId: string,
  actorUserId?: string
): Promise<void> {
  if (!productId) {
    throw new ValidationError("productId is required.");
  }

  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reservations")
    .update(addActor({ status: "completed" }, actorUserId, "update"))
    .eq("catalog_item_id", productId)
    .eq("status", "active")
    .select("id");

  if (error) {
    throw new AdapterError("Failed to complete reservation.", error);
  }
  if (!data || data.length === 0) {
    throw new ValidationError("No active reservation was found for this product.");
  }
}

async function setCatalogItemStatus(
  productId: string,
  status: "active" | "reserved"
): Promise<void> {
  const supabase = getServerSupabaseAdminClient();
  const { error } = await supabase
    .from("catalog_items")
    .update({ status })
    .eq("id", productId);

  if (error) {
    throw new AdapterError(
      status === "reserved"
        ? "Failed to move product to reserved items."
        : "Failed to move product back to active items.",
      error
    );
  }
}

export async function reserveProductForReservation(
  productId: string,
  input: ProductReservationInput = {},
  actorUserId?: string
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

  await upsertReservation(
    {
      ...input,
      productId,
      reservedForAt: input.reservedForAt ?? new Date().toISOString(),
    },
    actorUserId
  );
  await setCatalogItemStatus(productId, "reserved");

  const updated = await getProductById(productId);
  if (!updated) {
    throw new NotFoundError("Product not found after reservation.", { productId });
  }
  return updated;
}

export async function cancelProductReservation(
  productId: string,
  note?: string,
  actorUserId?: string
): Promise<ProductDTO> {
  const product = await getProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found.", { productId });
  }
  if (product.status !== "reserved") {
    throw new ValidationError("Only reserved products can have reservations cancelled.");
  }

  await cancelActiveReservationByProductId(
    productId,
    "seller_cancelled",
    note?.trim() || "Cancelled from reserved items page.",
    actorUserId
  );
  await setCatalogItemStatus(productId, "active");

  const updated = await getProductById(productId);
  if (!updated) {
    throw new NotFoundError("Product not found after cancelling reservation.", { productId });
  }
  return updated;
}

export { resolveExpiredReservation } from "@/app/api/reservations/resolve-expired-service";
export { sellActiveReservation } from "@/app/api/reservations/sell-active-service";
