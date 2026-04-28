import { NextRequest, NextResponse } from "next/server";
import { restoreProduct } from "@/app/api/catalog/catalog-service";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";
import { requireAdmin } from "@/app/api/catalog/role";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    const product = await restoreProduct(params.id);
    return NextResponse.json({ data: product });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
