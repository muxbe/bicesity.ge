import { NextRequest, NextResponse } from "next/server";
import {
  getProductById,
  updatePrice,
  updateStockCount,
} from "@/app/api/catalog/catalog-service";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";
import { requireAdmin } from "@/app/api/catalog/role";

type CriticalPatchPayload = {
  price?: number;
  stockCount?: number;
};

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  return value;
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

    const payload = (await request.json()) as CriticalPatchPayload;
    const productId = params.id;
    const price = toNumberOrUndefined(payload.price);
    const stockCount = toNumberOrUndefined(payload.stockCount);

    if (price === undefined && stockCount === undefined) {
      return NextResponse.json(
        { error: "At least one of price or stockCount is required." },
        { status: 400 }
      );
    }

    let product = await getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    if (price !== undefined) {
      product = await updatePrice(productId, price);
    }

    if (stockCount !== undefined) {
      product = await updateStockCount(productId, stockCount);
    }

    console.info(
      JSON.stringify({
        event: "catalog.critical.updated",
        productId,
        priceChanged: price !== undefined,
        stockChanged: stockCount !== undefined,
        at: new Date().toISOString(),
      })
    );

    return NextResponse.json({ data: product });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
