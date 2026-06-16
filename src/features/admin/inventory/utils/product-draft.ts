import { getFallbackImage, type AttributeDTO, type ProductDTO } from '@/features/catalog';
import type { ProductFormDraft } from '../types';

export function imagesFromDraft(draft: ProductFormDraft): string[] {
  return draft.images.length > 0 ? draft.images : draft.image ? [draft.image] : [];
}

export function draftFromProduct(product: ProductDTO): ProductFormDraft {
  const fallbackImage = getFallbackImage(product.category);
  const images = product.images.filter((image) => image !== fallbackImage);

  return {
    name: product.name,
    category: product.category,
    type: product.type ?? 'Manual',
    serial: product.serial,
    price: String(product.price),
    discountInput: product.discountInput,
    stockCount: String(product.stockCount),
    description: product.description,
    image: images[0] ?? '',
    images,
    values: { ...product.values },
  };
}

export function valuesForCategory(
  values: Record<string, string>,
  category: ProductFormDraft['category'],
  attributes: AttributeDTO[]
) {
  const allowedIds = new Set(
    attributes
      .filter((attribute) => attribute.category === category)
      .map((attribute) => attribute.id)
  );
  return Object.fromEntries(
    Object.entries(values)
      .filter(([attributeId]) => allowedIds.has(attributeId))
      .map(([attributeId, value]) => [attributeId, value.trim()])
  );
}
