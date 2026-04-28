import { NextRequest, NextResponse } from "next/server";
import { markAsSold } from "@/app/api/catalog/catalog-service";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";
import { requireAdmin } from "@/app/api/catalog/role";
import type { MarkSoldDTO } from "@/features/catalog/dto/catalog-dto";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    const payload = (await request.json()) as MarkSoldDTO;
    const product = await markAsSold(params.id, payload);
    return NextResponse.json({ data: product });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
