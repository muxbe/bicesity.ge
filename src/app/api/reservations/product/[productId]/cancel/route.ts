import { NextRequest, NextResponse } from "next/server";
import type { ReservationCancelReason } from "@/features/reservations/dto/reservation-dto";
import { DomainError, ValidationError } from "@/features/shared/domain/errors";
import { getRequestAuth, getRequestStaffRole } from "@/lib/auth/server";
import { cancelActiveReservationByProductId } from "@/app/api/reservations/reservation-service";

type CancelReservationPayload = {
  reason?: ReservationCancelReason;
  note?: string;
};

const CANCEL_REASONS = new Set<ReservationCancelReason>([
  "customer_cancelled",
  "seller_cancelled",
  "no_show",
  "other",
]);

function parseCancelReason(value: unknown): ReservationCancelReason {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError("Reservation cancellation reason is required.");
  }
  const normalized = value.trim();
  if (CANCEL_REASONS.has(normalized as ReservationCancelReason)) {
    return normalized as ReservationCancelReason;
  }
  throw new ValidationError("Unsupported reservation cancellation reason.");
}

function reservationErrorResponse(error: unknown) {
  if (error instanceof DomainError) {
    const status =
      error.code === "VALIDATION_ERROR" ? 400 : error.code === "NOT_FOUND" ? 404 : 500;

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      },
      { status }
    );
  }

  console.error("Unexpected reservation cancellation API error:", error);

  return NextResponse.json(
    {
      error: "Unexpected reservation cancellation error.",
      details: error instanceof Error ? { message: error.message } : null,
    },
    { status: 500 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const role = await getRequestStaffRole(request);
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json(
        { error: "Only admins and sellers can manage reservations." },
        { status: 403 }
      );
    }

    const payload = (await request.json().catch(() => ({}))) as CancelReservationPayload;
    const auth = await getRequestAuth(request);
    await cancelActiveReservationByProductId(
      params.productId,
      parseCancelReason(payload.reason),
      payload.note,
      auth?.user.id
    );

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return reservationErrorResponse(error);
  }
}
