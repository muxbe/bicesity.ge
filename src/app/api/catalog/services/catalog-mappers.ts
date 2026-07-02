import type {
  ProductCategory,
  ProductDTO,
  ProductDriveType,
} from "@/features/catalog/dto/catalog-dto";
import type { CatalogItemRow } from "@/app/api/catalog/services/catalog-types";
import {
  extractImageUrls,
  pickPrimaryImage,
} from "@/app/api/catalog/services/catalog-images";
import {
  buildDiscountFromSource,
  parseDiscountInput,
} from "@/features/catalog/domain/catalog-discount";
import { normalizeProductImages as normalizeCatalogProductImages } from "@/features/catalog/repositories/catalog-helpers";
import { ValidationError } from "@/features/shared/domain/errors";

export function mapCategoryFromDb(dbCategory: "bicycle" | "part"): ProductCategory {
  return dbCategory === "bicycle" ? "Bicycle" : "Parts";
}

export function mapCategoryToDb(category: ProductCategory): "bicycle" | "part" {
  return category === "Bicycle" ? "bicycle" : "part";
}

export function mapDriveTypeFromDb(value: string | undefined): ProductDriveType | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "manual") {
    return "Manual";
  }
  if (value === "electrical") {
    return "Electrical";
  }
  return value;
}

export function mapDriveTypeToDb(value: ProductDriveType | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "Manual") {
    return "manual";
  }
  if (trimmed === "Electrical") {
    return "electrical";
  }
  return trimmed;
}

export function rowToProduct(
  row: CatalogItemRow,
  valuesByItemId: Map<string, Record<string, string>>
): ProductDTO {
  const category = mapCategoryFromDb(row.item_type);
  const bicyclesRow = Array.isArray(row.bicycles) ? row.bicycles[0] : row.bicycles;
  const price = row.price_cents / 100;
  const discount = buildDiscountFromSource(price, {
    discountType: row.discount_type,
    discountAmount:
      row.discount_amount_cents === null ? null : row.discount_amount_cents / 100,
    discountPercent:
      row.discount_percent_bps === null ? null : row.discount_percent_bps / 100,
    discountReason: row.discount_reason,
  });

  return {
    id: row.id,
    name: row.name,
    category,
    type: category === "Bicycle" ? mapDriveTypeFromDb(bicyclesRow?.drive_type) : undefined,
    serial: row.serial_number,
    price,
    stockCount: row.stock_count,
    inStock: row.stock_count > 0,
    image: pickPrimaryImage(row.product_images, category),
    images: normalizeCatalogProductImages(extractImageUrls(row.product_images), category),
    description: row.description,
    values: valuesByItemId.get(row.id) ?? {},
    rating: row.rating ?? 0,
    status: row.status,
    ...discount,
  };
}

function parseDiscountOrThrow(input: string | undefined, price: number) {
  const parsed = parseDiscountInput(input, price);
  if (!parsed.ok) {
    throw new ValidationError(parsed.error);
  }
  return parsed;
}

export function discountPatchFromInput(
  input: string | undefined,
  price: number,
  reason: string | null | undefined
): Record<string, unknown> {
  const discount = parseDiscountOrThrow(input, price);
  return {
    discount_type: discount.discountType,
    discount_amount_cents:
      discount.discountAmount === null ? null : Math.round(discount.discountAmount * 100),
    discount_percent_bps:
      discount.discountPercent === null ? null : Math.round(discount.discountPercent * 100),
    discount_reason: reason ?? null,
  };
}