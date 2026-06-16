import type { ResolveExpiredReservationDTO, ReservationStatus } from "@/features/reservations";
import { AdapterError, NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type ExpiredReservationRow = {
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

function resolveNote(input: ResolveExpiredReservationDTO) {
  return (
    input.note?.trim() ||
    (input.outcome === "release"
      ? "Product released after reservation expiry."
      : "Product marked sold after reservation expiry.")
  );
}

async function updateExpiredReservationNote(
  reservationId: string,
  note: string,
  actorUserId?: string
) {
  const supabase = getServerSupabaseAdminClient();
  const { error } = await supabase
    .from("reservations")
    .update(addActor({ cancellation_note: note }, actorUserId, "update"))
    .eq("id", reservationId)
    .eq("status", "expired");

  if (error) {
    throw new AdapterError("Failed to update expired reservation note.", error);
  }
}

async function readExpiredReservation(reservationId: string) {
  const supabase = getServerSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("id,catalog_item_id,status,catalog_items(status,stock_count)")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new AdapterError("Failed to read expired reservation.", error);
  }
  if (!data) {
    throw new NotFoundError("Reservation not found.", { reservationId });
  }
  if (data.status !== "expired") {
    throw new ValidationError("Only expired reservations can be resolved.");
  }
  return data as unknown as ExpiredReservationRow;
}

export async function resolveExpiredReservation(
  reservationId: string,
  input: ResolveExpiredReservationDTO | null,
  actorUserId?: string
): Promise<void> {
  if (!reservationId) {
    throw new ValidationError("reservationId is required.");
  }
  if (!input || typeof input !== "object") {
    throw new ValidationError("Expired reservation outcome is required.");
  }

  const supabase = getServerSupabaseAdminClient();
  const reservation = await readExpiredReservation(reservationId);
  const item = Array.isArray(reservation.catalog_items)
    ? reservation.catalog_items[0]
    : reservation.catalog_items;
  if (!item) {
    throw new NotFoundError("Product for reservation not found.", {
      productId: reservation.catalog_item_id,
    });
  }

  const note = resolveNote(input);
  if (input.outcome === "release") {
    if (item.status === "sold" || item.status === "archived") {
      throw new ValidationError("Sold or deleted products cannot be released.");
    }
    if (item.status === "reserved") {
      const { error } = await supabase
        .from("catalog_items")
        .update(addActor({ status: "active" }, actorUserId, "update"))
        .eq("id", reservation.catalog_item_id)
        .eq("status", "reserved");
      if (error) {
        throw new AdapterError("Failed to release expired reservation product.", error);
      }
    }
    await updateExpiredReservationNote(reservationId, note, actorUserId);
    return;
  }

  if (input.outcome !== "sold") {
    throw new ValidationError("Unsupported expired reservation outcome.");
  }
  if (typeof input.soldPrice !== "number" || Number.isNaN(input.soldPrice) || input.soldPrice < 0) {
    throw new ValidationError("Sold price must be non-negative.");
  }
  if (!["online", "in_store", "as_is"].includes(input.saleChannel)) {
    throw new ValidationError("Unsupported sale channel.");
  }
  if (item.status === "sold" || item.status === "archived") {
    throw new ValidationError("Sold or deleted products cannot be marked sold again.");
  }
  if (item.stock_count <= 0) {
    throw new ValidationError("Out-of-stock products cannot be marked as sold.");
  }

  const { error: saleError } = await supabase.from("sales").insert(
    addActor(
      {
        catalog_item_id: reservation.catalog_item_id,
        reservation_id: reservation.id,
        quantity: 1,
        sale_channel: input.saleChannel,
        sale_price_cents: Math.round(input.soldPrice * 100),
        currency_code: "GEL",
        sold_at: new Date().toISOString(),
        audit_note: note,
      },
      actorUserId,
      "insert"
    )
  );
  if (saleError) {
    throw new AdapterError("Failed to insert expired reservation sale.", saleError);
  }

  const { error: itemError } = await supabase
    .from("catalog_items")
    .update(addActor({ status: "sold", stock_count: 0 }, actorUserId, "update"))
    .eq("id", reservation.catalog_item_id);
  if (itemError) {
    throw new AdapterError("Failed to mark expired reservation product sold.", itemError);
  }
  await updateExpiredReservationNote(reservationId, note, actorUserId);
}
