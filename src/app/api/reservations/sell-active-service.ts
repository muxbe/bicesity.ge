import type { ReservationStatus, SellActiveReservationDTO } from "@/features/reservations";
import { AdapterError, NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type ActiveReservationRow = {
  id: string;
  catalog_item_id: string;
  status: ReservationStatus;
  catalog_items:
    | {
        status: "active" | "reserved" | "sold" | "archived";
        stock_count: number;
      }
    | {
        status: "active" | "reserved" | "sold" | "archived";
        stock_count: number;
      }[]
    | null;
};

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

function resolveSaleNote(input: SellActiveReservationDTO) {
  return input.auditNote?.trim() || "Sold from active reservation page.";
}

function resolveSoldAt(input: SellActiveReservationDTO) {
  if (!input.soldAt) {
    return new Date().toISOString();
  }
  const parsed = new Date(input.soldAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("Sold date is invalid.");
  }
  return parsed.toISOString();
}

async function readActiveReservation(reservationId: string) {
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("id,catalog_item_id,status,catalog_items(status,stock_count)")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new AdapterError("Failed to read active reservation.", error);
  }
  if (!data) {
    throw new NotFoundError("Reservation not found.", { reservationId });
  }
  if (data.status !== "active") {
    throw new ValidationError("Only active reservations can be sold.");
  }
  return data as unknown as ActiveReservationRow;
}

export async function sellActiveReservation(
  reservationId: string,
  input: SellActiveReservationDTO | null,
  actorUserId?: string
): Promise<void> {
  if (!reservationId) {
    throw new ValidationError("reservationId is required.");
  }
  if (!input || typeof input !== "object") {
    throw new ValidationError("Active reservation sale payload is required.");
  }
  if (
    typeof input.soldPrice !== "number" ||
    Number.isNaN(input.soldPrice) ||
    input.soldPrice < 0
  ) {
    throw new ValidationError("Sold price must be non-negative.");
  }
  if (!["online", "in_store", "as_is"].includes(input.saleChannel)) {
    throw new ValidationError("Unsupported sale channel.");
  }

  const reservation = await readActiveReservation(reservationId);
  const item = Array.isArray(reservation.catalog_items)
    ? reservation.catalog_items[0]
    : reservation.catalog_items;
  if (!item) {
    throw new NotFoundError("Product for reservation not found.", {
      productId: reservation.catalog_item_id,
    });
  }
  if (item.status === "sold" || item.status === "archived") {
    throw new ValidationError("Sold or deleted products cannot be marked sold again.");
  }
  if (item.stock_count <= 0) {
    throw new ValidationError("Out-of-stock products cannot be marked as sold.");
  }

  const supabase = getServerSupabaseAdminClient();
  const { error: saleError } = await supabase.from("sales").insert(
    addActor(
      {
        catalog_item_id: reservation.catalog_item_id,
        reservation_id: reservation.id,
        quantity: 1,
        sale_channel: input.saleChannel,
        sale_price_cents: Math.round(input.soldPrice * 100),
        currency_code: "GEL",
        sold_at: resolveSoldAt(input),
        audit_note: resolveSaleNote(input),
      },
      actorUserId,
      "insert"
    )
  );
  if (saleError) {
    throw new AdapterError("Failed to insert active reservation sale.", saleError);
  }

  const { error: itemError } = await supabase
    .from("catalog_items")
    .update(addActor({ status: "sold", stock_count: 0 }, actorUserId, "update"))
    .eq("id", reservation.catalog_item_id);
  if (itemError) {
    throw new AdapterError("Failed to mark active reservation product sold.", itemError);
  }
}
