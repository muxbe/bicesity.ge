import { NextResponse } from "next/server";
import { listPublicActiveProducts } from "@/app/api/catalog/catalog-service";
import { listFields } from "@/app/api/fields/field-service";
import { fallbackSettings, readSettings } from "@/app/api/settings/settings-service";
import type { ShopBootstrapDTO } from "@/features/shop/shop-bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const attributes = (await listFields("all")).filter(
      (field) => field.isPublic && !field.archivedAt
    );
    const [products, settings] = await Promise.all([
      listPublicActiveProducts(attributes),
      readSettings(),
    ]);

    const data: ShopBootstrapDTO = {
      products,
      attributes,
      settings,
    };

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing NEXT_PUBLIC_SUPABASE_URL")) {
      const data: ShopBootstrapDTO = {
        products: [],
        attributes: [],
        settings: fallbackSettings(),
      };
      return NextResponse.json({ data });
    }

    return NextResponse.json(
      {
        error: "Failed to load shop data.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
