import { NextRequest, NextResponse } from "next/server";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const fieldsUrl = new URL("/api/fields", request.url);
    const response = await fetch(fieldsUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json();

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
