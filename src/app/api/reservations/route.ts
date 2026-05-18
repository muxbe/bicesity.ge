import { NextRequest, NextResponse } from "next/server";
import type { UpsertReservationDTO } from "@/features/reservations/dto/reservation-dto";
import { DomainError } from "@/features/shared/domain/errors";
import { getRequestAuth, getRequestStaffRole } from "@/lib/auth/server";
import {
  listReservations,
  parseReservationStatus,
  upsertReservation,
} from "@/app/api/reservations/reservation-service";

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

  console.error("Unexpected reservation API error:", error);

  return NextResponse.json(
    {
      error: "Unexpected reservation error.",
      details: error instanceof Error ? { message: error.message } : null,
    },
    { status: 500 }
  );
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

    const status = parseReservationStatus(request.nextUrl.searchParams.get("status"));
    return NextResponse.json({ data: await listReservations(status) });
  } catch (error) {
    return reservationErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = await getRequestStaffRole(request);
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json(
        { error: "Only admins and sellers can manage reservations." },
        { status: 403 }
      );
    }

    const payload = (await request.json()) as UpsertReservationDTO;
    const auth = await getRequestAuth(request);
    const reservation = await upsertReservation(payload, auth?.user.id);
    return NextResponse.json({ data: reservation }, { status: 201 });
  } catch (error) {
    return reservationErrorResponse(error);
  }
}
