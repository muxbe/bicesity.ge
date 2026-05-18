import { NextRequest, NextResponse } from "next/server";
import { DomainError } from "@/features/shared/domain/errors";
import { getRequestAuth, getRequestStaffRole } from "@/lib/auth/server";
import { completeActiveReservationByProductId } from "@/app/api/reservations/reservation-service";

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

  console.error("Unexpected reservation completion API error:", error);

  return NextResponse.json(
    {
      error: "Unexpected reservation completion error.",
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

    const auth = await getRequestAuth(request);
    await completeActiveReservationByProductId(params.productId, auth?.user.id);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return reservationErrorResponse(error);
  }
}
