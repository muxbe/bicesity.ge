import { AdapterError } from "@/features/shared/domain/errors";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

export async function syncCatalogReservationStatuses(): Promise<void> {
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
