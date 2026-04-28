import type { AttributeDTO, ProductDTO, ProductDriveType } from "@/features/catalog/dto/catalog-dto";
import { emptyDiscount } from "@/features/catalog/domain/catalog-discount";
import { attributes as mockAttributes, products as mockProducts } from "@/lib/mock-data";

export type MockReservationRecord = {
  id: string;
  productId: string;
  status: "active" | "completed" | "cancelled" | "expired";
  reservedForAt: string;
  expiresAt: string;
  cancellationReasonCode: "customer_cancelled" | "seller_cancelled" | "no_show" | "expired" | "other" | null;
  cancellationNote: string | null;
  customerName: string;
  customerPhone: string;
  messengerProfileUrl: string;
  reservationSource: "manual" | "messenger" | "phone" | "walk_in" | "other";
  sellerComment: string;
  createdAt: string;
  updatedAt: string;
};

export type MockSaleRecord = {
  id: string;
  productId: string;
  saleChannel: "online" | "in_store" | "as_is";
  salePrice: number;
  soldAt: string;
  auditNote: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapDriveType(type: string | undefined): ProductDriveType | undefined {
  if (type === "Manual" || type === "Electrical") {
    return type;
  }
  return undefined;
}

function buildInitialProducts(): ProductDTO[] {
  return mockProducts.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    type: mapDriveType(product.type),
    serial: product.serial,
    price: product.price,
    stockCount: product.inStock ? 1 : 0,
    inStock: product.inStock,
    image: product.image,
    images: [product.image],
    description: product.description,
    values: { ...product.values },
    rating: product.rating,
    status: product.inStock ? "active" : "sold",
    ...emptyDiscount(),
  }));
}

function buildInitialAttributes(): AttributeDTO[] {
  return mockAttributes.map((attribute, index) => ({
    id: attribute.id,
    name: attribute.name,
    nameTranslations: { en: attribute.name },
    category: attribute.category,
    isPublic: attribute.isPublic,
    sortOrder: index + 1,
    fieldKey: attribute.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    dataType: "text",
    inputMode: "free_text",
    options: [],
  }));
}

export const mockRuntimeStore: {
  products: ProductDTO[];
  attributes: AttributeDTO[];
  reservations: MockReservationRecord[];
  sales: MockSaleRecord[];
} = {
  products: buildInitialProducts(),
  attributes: buildInitialAttributes(),
  reservations: [],
  sales: [],
};

export function createRuntimeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
