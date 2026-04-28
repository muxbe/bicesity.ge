import type { AttributeDTO, ProductCategory, ProductDTO } from "@/features/catalog/dto/catalog-dto";

export function getFallbackImage(category: ProductCategory): string {
  if (category === "Bicycle") {
    return "/product-bicycle.svg";
  }
  return "/product-part.svg";
}

function isLegacyDemoImage(url: string): boolean {
  try {
    return new URL(url).hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

export function normalizeProductImage(
  image: string | null | undefined,
  category: ProductCategory
): string {
  const trimmed = image?.trim() ?? "";
  if (!trimmed || isLegacyDemoImage(trimmed)) {
    return getFallbackImage(category);
  }
  return trimmed;
}

export function normalizeProductImages(
  images: Array<string | null | undefined>,
  category: ProductCategory
): string[] {
  const seen = new Set<string>();
  const normalized = images
    .map((image) => normalizeProductImage(image, category))
    .filter((image) => {
      if (seen.has(image)) {
        return false;
      }
      seen.add(image);
      return true;
    });

  return normalized.length > 0 ? normalized : [getFallbackImage(category)];
}

export function buildPublicAttributes(product: ProductDTO, attributes: AttributeDTO[]) {
  return attributes
    .filter(
      (attribute) =>
        attribute.category === product.category &&
        attribute.isPublic &&
        Boolean(product.values[attribute.id])
    )
    .map((attribute) => ({
      ...attribute,
      value: product.values[attribute.id],
    }));
}

export function groupProductsByCategory(products: ProductDTO[]) {
  return {
    Bicycle: products.filter((product) => product.category === "Bicycle"),
    Parts: products.filter((product) => product.category === "Parts"),
  };
}
