import { NextRequest, NextResponse } from "next/server";
import type { SellActiveReservationDTO } from "@/features/reservations";
import { DomainError } from "@/features/shared/domain/errors";
import { getRequestAuth, getRequestStaffRole } from "@/lib/auth/server";
import { sellActiveReservation } from "@/app/api/reservations/reservation-service";

function reservationSaleErrorResponse(error: unknown) {
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

  console.error("Unexpected active reservation sale API error:", error);

  return NextResponse.json(
    {
      error: "Unexpected active reservation sale error.",
      details: error instanceof Error ? { message: error.message } : null,
    },
    { status: 500 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const role = await getRequestStaffRole(request);
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json(
        { error: "Only admins and sellers can sell active reservations." },
        { status: 403 }
      );
    }

    const payload = (await request.json().catch(() => null)) as
      | SellActiveReservationDTO
      | null;
    const auth = await getRequestAuth(request);
    await sellActiveReservation(params.id, payload, auth?.user.id);

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return reservationSaleErrorResponse(error);
  }
}
