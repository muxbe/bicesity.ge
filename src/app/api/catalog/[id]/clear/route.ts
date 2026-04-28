import { NextRequest, NextResponse } from "next/server";
import { clearArchivedProduct } from "@/app/api/catalog/catalog-service";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";
import { requireAdmin } from "@/app/api/catalog/role";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    await clearArchivedProduct(params.id);
    return NextResponse.json({ data: { cleared: true } });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
