import { NextRequest, NextResponse } from "next/server";
import {
  archiveProduct,
  getProductById,
  updateProduct,
} from "@/app/api/catalog/catalog-service";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";
import { getCatalogRole, requireAdmin } from "@/app/api/catalog/role";
import type { UpdateProductDTO } from "@/features/catalog/dto/catalog-dto";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const role = await getCatalogRole(request);
    const product = await getProductById(params.id);
    if (!product || (!role && product.status !== "active")) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ data: product });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    const payload = (await request.json()) as UpdateProductDTO;
    const product = await updateProduct(params.id, payload);
    return NextResponse.json({ data: product });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    await archiveProduct(params.id);
    return NextResponse.json({ data: { archived: true } });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
