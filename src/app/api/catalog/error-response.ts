import { NextResponse } from "next/server";
import { DomainError } from "@/features/shared/domain/errors";

export function catalogErrorResponse(error: unknown) {
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

  console.error("Unexpected catalog API error:", error);

  const message =
    process.env.NODE_ENV === "production"
      ? "Unexpected server error."
      : error instanceof Error
      ? error.message
      : "Unexpected server error.";

  return NextResponse.json({ error: message }, { status: 500 });
}
