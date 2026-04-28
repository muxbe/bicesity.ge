import { createMockReservationRepository } from "@/features/reservations/adapters/mock/reservation-repository.mock";
import { createSupabaseReservationRepository } from "@/features/reservations/adapters/supabase/reservation-repository.supabase";
import type { ReservationRepository } from "@/features/reservations/repositories/reservation-repository";
import { getReservationDataSource, type CatalogDataSource } from "@/lib/feature-flags";
import { hasSupabasePublicEnv } from "@/lib/supabase/client";

let cachedRepository: ReservationRepository | null = null;
let cachedSource: CatalogDataSource | null = null;

export function getReservationRepository(): ReservationRepository {
  const source = getReservationDataSource();
  if (cachedRepository && cachedSource === source) {
    return cachedRepository;
  }

  if (source === "supabase" && hasSupabasePublicEnv()) {
    cachedRepository = createSupabaseReservationRepository();
    cachedSource = source;
    return cachedRepository;
  }

  if (source === "supabase" && !hasSupabasePublicEnv() && typeof window !== "undefined") {
    console.warn(
      "Supabase reservation adapter selected but NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Falling back to mock adapter."
    );
  }

  cachedRepository = createMockReservationRepository();
  cachedSource = source;
  return cachedRepository;
}
