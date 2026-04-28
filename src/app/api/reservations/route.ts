import { NextRequest, NextResponse } from "next/server";
import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";
import type {
  ReservationCancelReason,
  ReservationDTO,
  ReservationStatus,
} from "@/features/reservations/dto/reservation-dto";
import { getFallbackImage, normalizeProductImage } from "@/features/catalog";
import { parseReservationCommentContext } from "@/features/reservations/dto/reservation-comment-context";
import { getRequestStaffRole } from "@/lib/auth/server";
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

function parseStatus(value: string | null): ReservationStatus | "all" {
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

export async function GET(request: NextRequest) {
  try {
    const role = await getRequestStaffRole(request);
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json(
        { error: "Only admins and sellers can view reservations." },
        { status: 403 }
      );
    }

    const status = parseStatus(request.nextUrl.searchParams.get("status"));
    const supabase = getServerSupabaseAdminClient();
    const fullSelect =
      "id,catalog_item_id,status,reserved_for_at,expires_at,cancellation_reason_code,cancellation_note,customer_name,customer_phone,messenger_profile_url,reservation_source,seller_comment,created_at,updated_at,catalog_items(id,name,item_type,serial_number,price_cents,product_images(external_url,is_primary,sort_order))";
    const fallbackSelect =
      "id,catalog_item_id,status,reserved_for_at,expires_at,cancellation_reason_code,cancellation_note,seller_comment,created_at,updated_at,catalog_items(id,name,item_type,serial_number,price_cents,product_images(external_url,is_primary,sort_order))";

    let query = supabase
      .from("reservations")
      .select(fullSelect)
      .order("reserved_for_at", { ascending: true });
    if (status !== "all") {
      query = query.eq("status", status);
    }

    const primaryResult = await query;
    let data = primaryResult.data as unknown;
    let error = primaryResult.error;
    if (error && isMissingReservationContextColumn(error)) {
      let fallbackQuery = supabase
        .from("reservations")
        .select(fallbackSelect)
        .order("reserved_for_at", { ascending: true });
      if (status !== "all") {
        fallbackQuery = fallbackQuery.eq("status", status);
      }
      const fallbackResult = await fallbackQuery;
      data = fallbackResult.data as unknown;
      error = fallbackResult.error;
    }
    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch reservations.", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: ((data ?? []) as ReservationRow[])
        .map(toDto)
        .filter((reservation): reservation is ReservationDTO => Boolean(reservation)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected reservation error.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
