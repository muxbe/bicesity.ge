import { NextRequest, NextResponse } from "next/server";
import type { ResolveExpiredReservationDTO } from "@/features/reservations";
import { DomainError } from "@/features/shared/domain/errors";
import { getRequestAuth, getRequestStaffRole } from "@/lib/auth/server";
import { resolveExpiredReservation } from "@/app/api/reservations/reservation-service";

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

  console.error("Unexpected expired reservation resolution API error:", error);

  return NextResponse.json(
    {
      error: "Unexpected expired reservation resolution error.",
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
        { error: "Only admins and sellers can resolve expired reservations." },
        { status: 403 }
      );
    }

    const payload = (await request.json().catch(() => null)) as
      | ResolveExpiredReservationDTO
      | null;
    const auth = await getRequestAuth(request);
    await resolveExpiredReservation(params.id, payload, auth?.user.id);

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return reservationErrorResponse(error);
  }
}
