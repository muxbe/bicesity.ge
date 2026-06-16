import { NextRequest, NextResponse } from "next/server";
import { countProductsByStatus } from "@/app/api/catalog/catalog-service";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";
import { forbidden, getCatalogRole } from "@/app/api/catalog/role";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const role = await getCatalogRole(request);
    if (!role) {
      return forbidden("Only staff can view catalog counts.");
    }

    const counts = await countProductsByStatus({ syncReservations: true });
    return NextResponse.json({ data: counts });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
