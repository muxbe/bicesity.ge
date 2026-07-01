import { getCurrentPrice, type ProductDTO } from "@/features/catalog";
import type {
  CategoryFilter,
  FilterState,
  Translate,
} from "@/features/shop/home/home-types";

export function accountRoleLabel(
  role: string | null | undefined,
  t: Translate
) {
  if (role === "admin") {
    return t("role.admin");
  }
  if (role === "seller") {
    return t("role.seller");
  }
  return t("role.customer");
}

export function parsePrice(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function fallbackMessengerTargetUrl() {
  return (
    process.env.NEXT_PUBLIC_MESSENGER_TARGET_URL?.trim() ||
    process.env.NEXT_PUBLIC_MESSENGER_URL?.trim() ||
    ""
  );
}

export function buildMessengerUrl(targetUrl: string, message: string) {
  if (!targetUrl) {
    return null;
  }

  try {
    const url = new URL(targetUrl);
    url.searchParams.set("text", message);
    return url.toString();
  } catch {
    return null;
  }
}

export function buildRentMessage(rentUrl: string, t: Translate) {
  return [
    t("rent.requestLine1"),
    `Link: ${rentUrl}`,
    t("rent.requestLine3"),
  ].join("\n");
}

export function sanitizeAttributeValues(
  attributeValues: Record<string, string>,
  category: CategoryFilter,
  attributes: Array<{
    id: string;
    category: "Bicycle" | "Parts";
    isPublic: boolean;
  }>
) {
  const sanitized: Record<string, string> = {};
  for (const attribute of attributes) {
    if (!attribute.isPublic) {
      continue;
    }
    if (category !== "All" && attribute.category !== category) {
      continue;
    }
    const value = attributeValues[attribute.id];
    if (value) {
      sanitized[attribute.id] = value;
    }
  }
  return sanitized;
}

export function filterProducts(
  products: ProductDTO[],
  filters: FilterState
) {
  const minPrice = parsePrice(filters.minPrice);
  const maxPrice = parsePrice(filters.maxPrice);
  const normalizedQuery = filters.query.trim().toLowerCase();

  return products.filter((product) => {
    if (filters.category !== "All" && product.category !== filters.category) {
      return false;
    }

    if (normalizedQuery) {
      const searchableText = [
        product.name,
        product.description,
        product.serial,
        ...Object.values(product.values),
      ]
        .join(" ")
        .toLowerCase();
      if (!searchableText.includes(normalizedQuery)) {
        return false;
      }
    }

    if (filters.stock === "In Stock" && !product.inStock) {
      return false;
    }
    if (filters.stock === "Out of Stock" && product.inStock) {
      return false;
    }
    if (
      filters.bikeType !== "All" &&
      (product.category !== "Bicycle" || product.type !== filters.bikeType)
    ) {
      return false;
    }

    const currentPrice = getCurrentPrice(product);
    if (minPrice !== null && currentPrice < minPrice) {
      return false;
    }
    if (maxPrice !== null && currentPrice > maxPrice) {
      return false;
    }

    for (const [attributeId, selectedValue] of Object.entries(
      filters.attributeValues
    )) {
      if (selectedValue && product.values[attributeId] !== selectedValue) {
        return false;
      }
    }

    return true;
  });
}

export function countActiveFilters(filters: FilterState) {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.category !== "All") count += 1;
  if (filters.stock !== "All") count += 1;
  if (filters.bikeType !== "All") count += 1;
  if (parsePrice(filters.minPrice) !== null) count += 1;
  if (parsePrice(filters.maxPrice) !== null) count += 1;
  count += Object.values(filters.attributeValues).filter(Boolean).length;
  return count;
}
