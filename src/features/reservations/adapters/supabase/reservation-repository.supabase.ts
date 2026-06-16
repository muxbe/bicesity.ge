import { AdapterError, ValidationError } from "@/features/shared/domain/errors";
import { getAuthHeaders, getJsonAuthHeaders } from "@/lib/auth/request-headers";
import type {
  ResolveExpiredReservationDTO,
  ReservationCancelReason,
  ReservationDTO,
  ReservationStatus,
  UpsertReservationDTO,
} from "@/features/reservations/dto/reservation-dto";
import type { ReservationRepository } from "@/features/reservations/repositories/reservation-repository";

type ApiResponse<T> = {
  data?: T;
  error?: string;
  details?: unknown;
};

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

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: await getJsonAuthHeaders("seller"),
        body: JSON.stringify(input),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse<ReservationDTO> | null;

      if (!response.ok || !payload?.data) {
        throw new AdapterError(apiErrorMessage(payload, "Failed to save reservation."), payload?.details);
      }
      return payload.data;
    },

    async cancelReservationByProductId(
      productId: string,
      reason: ReservationCancelReason,
      note?: string
    ) {
      const response = await fetch(
        `/api/reservations/product/${encodeURIComponent(productId)}/cancel`,
        {
          method: "POST",
          headers: await getJsonAuthHeaders("seller"),
          body: JSON.stringify({ reason, note }),
        }
      );
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        ok: boolean;
      }> | null;

      if (!response.ok || !payload?.data) {
        throw new AdapterError(apiErrorMessage(payload, "Failed to cancel reservation."), payload?.details);
      }
    },

    async completeReservationByProductId(productId: string) {
      const response = await fetch(
        `/api/reservations/product/${encodeURIComponent(productId)}/complete`,
        {
          method: "POST",
          headers: await getJsonAuthHeaders("seller"),
          body: JSON.stringify({}),
        }
      );
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        ok: boolean;
      }> | null;

      if (!response.ok || !payload?.data) {
        throw new AdapterError(apiErrorMessage(payload, "Failed to complete reservation."), payload?.details);
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

    async resolveExpiredReservation(
      reservationId: string,
      input: ResolveExpiredReservationDTO
    ) {
      const response = await fetch(
        `/api/reservations/${encodeURIComponent(reservationId)}/resolve-expired`,
        {
          method: "POST",
          headers: await getJsonAuthHeaders("seller"),
          body: JSON.stringify(input),
        }
      );
      const payload = (await response.json().catch(() => null)) as ApiResponse<{
        ok: boolean;
      }> | null;

      if (!response.ok || !payload?.data) {
        throw new AdapterError(
          apiErrorMessage(payload, "Failed to resolve expired reservation."),
          payload?.details
        );
      }
    },
  };
}
