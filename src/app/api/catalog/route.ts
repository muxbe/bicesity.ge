import { NextRequest, NextResponse } from "next/server";
import { createProduct, listProducts } from "@/app/api/catalog/catalog-service";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";
import { getCatalogRole, requireAdmin } from "@/app/api/catalog/role";
import type {
  CreateProductDTO,
  ProductStatusFilter,
} from "@/features/catalog/dto/catalog-dto";

function parseStatus(value: string | null): ProductStatusFilter {
  return value === "active" ||
    value === "reserved" ||
    value === "sold" ||
    value === "archived" ||
    value === "all"
    ? value
    : "all";
}

export async function GET(request: NextRequest) {
  try {
    const role = await getCatalogRole(request);
    const requestedStatus = parseStatus(request.nextUrl.searchParams.get("status"));
    const status = role ? requestedStatus : "active";
    const products = await listProducts(status, { syncReservations: Boolean(role) });
    return NextResponse.json({ data: products });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    const payload = (await request.json()) as CreateProductDTO;
    const product = await createProduct(payload);
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
