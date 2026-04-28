import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";
import {
  getFallbackImage,
  normalizeProductImage,
} from "@/features/catalog/repositories/catalog-helpers";
import { AdapterError, ValidationError } from "@/features/shared/domain/errors";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { getAuthHeaders, getJsonAuthHeaders } from "@/lib/auth/request-headers";
import type {
  ReservationCancelReason,
  ReservationDTO,
  ReservationStatus,
  UpsertReservationDTO,
} from "@/features/reservations/dto/reservation-dto";
import { parseReservationCommentContext } from "@/features/reservations/dto/reservation-comment-context";
import type { ReservationRepository } from "@/features/reservations/repositories/reservation-repository";

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

type ApiResponse<T> = {
  data?: T;
  error?: string;
  details?: unknown;
};

const RESERVATION_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

function apiErrorMessage(payload: ApiResponse<unknown> | null, fallback: string) {
  if (
    payload?.details &&
    typeof payload.details === "object" &&
    "message" in payload.details &&
    typeof payload.details.message === "string"
  ) {
    return `${payload.error ?? fallback} ${payload.details.message}`;
  }
  return payload?.error ?? fallback;
}

function resolveReservationExpiryIso(reservedForAt: string, requestedExpiresAt?: string): string {
  const reservedDate = new Date(reservedForAt);
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

async function fetchByStatus(status?: ReservationStatus | "all"): Promise<ReservationDTO[]> {
  const searchParams = new URLSearchParams();
  if (status && status !== "all") {
    searchParams.set("status", status);
  }
  const response = await fetch(
    `/api/reservations${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
    {
      method: "GET",
      headers: await getAuthHeaders("seller"),
      cache: "no-store",
    }
  );
  const payload = (await response.json().catch(() => null)) as ApiResponse<ReservationDTO[]> | null;
  if (!response.ok || !payload?.data) {
    throw new AdapterError(apiErrorMessage(payload, "Failed to fetch reservations."), payload?.details);
  }
  return payload.data;
}

export function createSupabaseReservationRepository(): ReservationRepository {
  return {
    async listReservations(status = "all") {
      return fetchByStatus(status);
    },

    async upsertReservation(input: UpsertReservationDTO) {
      if (!input.productId) {
        throw new ValidationError("productId is required.");
      }
      if (!input.reservedForAt) {
        throw new ValidationError("reservedForAt is required.");
      }

      const expiresAt = resolveReservationExpiryIso(input.reservedForAt, input.expiresAt);
      const supabase = getBrowserSupabaseClient();

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
        const { error: updateError } = await supabase
          .from("reservations")
          .update({
            status: "active",
            reserved_for_at: input.reservedForAt,
            expires_at: expiresAt,
            note: input.note?.trim() || null,
            customer_name: input.customerName?.trim() || null,
            customer_phone: input.customerPhone?.trim() || null,
            messenger_profile_url: input.messengerProfileUrl?.trim() || null,
            reservation_source: input.reservationSource ?? "manual",
            seller_comment: input.sellerComment?.trim() || input.note?.trim() || "",
          })
          .eq("id", existing.id);
        if (updateError) {
          throw new AdapterError("Failed to update reservation.", updateError);
        }
      } else {
        const { error: insertError } = await supabase.from("reservations").insert({
          catalog_item_id: input.productId,
          status: "active",
          reserved_for_at: input.reservedForAt,
          expires_at: expiresAt,
          note: input.note?.trim() || null,
          customer_name: input.customerName?.trim() || null,
          customer_phone: input.customerPhone?.trim() || null,
          messenger_profile_url: input.messengerProfileUrl?.trim() || null,
          reservation_source: input.reservationSource ?? "manual",
          seller_comment: input.sellerComment?.trim() || input.note?.trim() || "",
        });
        if (insertError) {
          throw new AdapterError("Failed to create reservation.", insertError);
        }
      }

      const activeReservations = await fetchByStatus("active");
      const result = activeReservations.find((reservation) => reservation.productId === input.productId);
      if (!result) {
        throw new AdapterError("Reservation was not found after upsert.");
      }
      return result;
    },

    async cancelReservationByProductId(
      productId: string,
      reason: ReservationCancelReason,
      note?: string
    ) {
      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          cancellation_reason_code: reason,
          cancellation_note: note?.trim() || null,
        })
        .eq("catalog_item_id", productId)
        .eq("status", "active");

      if (error) {
        throw new AdapterError("Failed to cancel reservation.", error);
      }
    },

    async completeReservationByProductId(productId: string) {
      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "completed",
        })
        .eq("catalog_item_id", productId)
        .eq("status", "active");

      if (error) {
        throw new AdapterError("Failed to complete reservation.", error);
      }
    },

    async updateSellerComment(reservationId: string, sellerComment: string) {
      const response = await fetch(
        `/api/reservations/${encodeURIComponent(reservationId)}/seller-comment`,
        {
          method: "PATCH",
          headers: await getJsonAuthHeaders("seller"),
          body: JSON.stringify({ sellerComment }),
        }
      );
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        id: string;
        sellerComment: string;
        updatedAt: string;
      }> | null;

      if (!response.ok || !payload?.data) {
        throw new AdapterError(apiErrorMessage(payload, "Failed to save seller comment."), payload?.details);
      }
    },

    async expirePastReservations(referenceTimeIso?: string) {
      const response = await fetch("/api/reservations/expire", {
        method: "POST",
        headers: await getJsonAuthHeaders("seller"),
        body: JSON.stringify({ referenceTimeIso }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        expiredCount: number;
      }> | null;

      if (!response.ok || !payload?.data) {
        throw new AdapterError(apiErrorMessage(payload, "Failed to expire old reservations."), payload?.details);
      }

      return payload.data.expiredCount;
    },
  };
}
