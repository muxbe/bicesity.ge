import type {
  CreateProductDTO,
  MarkSoldDTO,
  ProductDTO,
  UpdateProductDTO,
} from "@/features/catalog/dto/catalog-dto";
import {
  assertRequiredText,
  assertValidPrice,
  assertValidStockCount,
} from "@/features/catalog/domain/catalog-validation";
import {
  buildDiscountFromSource,
  emptyDiscount,
  parseDiscountInput,
} from "@/features/catalog/domain/catalog-discount";
import type { CatalogRepository } from "@/features/catalog/repositories/catalog-repository";
import { getFallbackImage } from "@/features/catalog/repositories/catalog-helpers";
import { NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { createRuntimeId, mockRuntimeStore } from "@/features/mock-runtime/store";

function findProductIndex(productId: string): number {
  return mockRuntimeStore.products.findIndex((product) => product.id === productId);
}

function cloneProduct(product: ProductDTO): ProductDTO {
  return {
    ...product,
    images: [...product.images],
    values: { ...product.values },
  };
}

function getProductOrThrow(productId: string): ProductDTO {
  const found = mockRuntimeStore.products.find((product) => product.id === productId);
  if (!found) {
    throw new NotFoundError("Product not found.", { productId });
  }
  return found;
}

function parseDiscountOrThrow(input: string | undefined, price: number) {
  const parsed = parseDiscountInput(input, price);
  if (!parsed.ok) {
    throw new ValidationError(parsed.error);
  }
  return {
    discountType: parsed.discountType,
    discountInput: parsed.discountInput,
    discountAmount: parsed.discountAmount,
    discountPercent: parsed.discountPercent,
    discountedPrice: parsed.discountedPrice,
    discountLabel: parsed.discountLabel,
  };
}

function normalizeImages(images: string[] | undefined, fallbackImage?: string): string[] {
  const seen = new Set<string>();
  const normalized = [...(images ?? []), fallbackImage ?? ""]
    .map((image) => image.trim())
    .filter((image) => {
      if (!image || seen.has(image)) {
        return false;
      }
      seen.add(image);
      return true;
    })
    .slice(0, 5);
  return normalized;
}

export function createMockCatalogRepository(): CatalogRepository {
  return {
    async listProducts() {
      return mockRuntimeStore.products.map(cloneProduct);
    },

    async getProductById(productId) {
      const found = mockRuntimeStore.products.find((product) => product.id === productId);
      return found ? cloneProduct(found) : null;
    },

    async listAttributes() {
      return mockRuntimeStore.attributes.map((attribute) => ({
        ...attribute,
        options: attribute.options.map((option) => ({ ...option })),
      }));
    },

    async createProduct(input) {
      assertRequiredText(input.name, "name");
      assertRequiredText(input.serial, "serial");
      assertValidPrice(input.price);
      assertValidStockCount(input.stockCount);
      const images = normalizeImages(input.images, input.image);
      const primaryImage = images[0] ?? getFallbackImage(input.category);

      const next: ProductDTO = {
        id: createRuntimeId("prod"),
        name: input.name.trim(),
        category: input.category,
        type: input.type,
        serial: input.serial.trim(),
        price: input.price,
        stockCount: input.stockCount,
        inStock: input.stockCount > 0,
        image: primaryImage,
        images,
        description: input.description.trim(),
        values: input.values ? { ...input.values } : {},
        rating: input.rating ?? 0,
        status: input.stockCount > 0 ? "active" : "sold",
        ...(input.discountInput !== undefined
          ? {
              ...parseDiscountOrThrow(input.discountInput, input.price),
              discountReason: input.discountReason ?? null,
            }
          : emptyDiscount(input.discountReason ?? null)),
      };

      mockRuntimeStore.products.unshift(next);
      return cloneProduct(next);
    },

    async updateProduct(productId: string, input: UpdateProductDTO) {
      const index = findProductIndex(productId);
      if (index < 0) {
        throw new NotFoundError("Product not found.", { productId });
      }

      const previous = mockRuntimeStore.products[index];
      const nextPrice = input.price ?? previous.price;
      const nextStockCount = input.stockCount ?? previous.stockCount;
      assertValidPrice(nextPrice);
      assertValidStockCount(nextStockCount);
      const nextDiscount =
        input.discountInput !== undefined
          ? {
              ...parseDiscountOrThrow(input.discountInput, nextPrice),
              discountReason: input.discountReason ?? null,
            }
          : buildDiscountFromSource(nextPrice, {
              discountType: previous.discountType,
              discountAmount: previous.discountAmount,
              discountPercent: previous.discountPercent,
              discountReason:
                input.discountReason !== undefined
                  ? input.discountReason
                  : previous.discountReason,
            });

      const nextStatus =
        nextStockCount === 0
          ? "sold"
          : previous.status === "archived"
          ? "archived"
          : previous.status === "reserved"
          ? "reserved"
          : "active";
      const images =
        input.images !== undefined || input.image !== undefined
          ? normalizeImages(input.images, input.image)
          : previous.images;
      const primaryImage = images[0] ?? previous.image;

      mockRuntimeStore.products[index] = {
        ...previous,
        name: input.name?.trim() || previous.name,
        serial: input.serial?.trim() || previous.serial,
        description:
          input.description !== undefined ? input.description.trim() : previous.description,
        type: input.type ?? previous.type,
        image: primaryImage,
        images,
        values: input.values ? { ...previous.values, ...input.values } : { ...previous.values },
        price: nextPrice,
        stockCount: nextStockCount,
        inStock: nextStockCount > 0,
        status: nextStatus,
        ...nextDiscount,
      };

      return cloneProduct(mockRuntimeStore.products[index]);
    },

    async updatePrice(productId, price) {
      assertValidPrice(price);
      const index = findProductIndex(productId);
      if (index < 0) {
        throw new NotFoundError("Product not found.", { productId });
      }
      mockRuntimeStore.products[index] = {
        ...mockRuntimeStore.products[index],
        price,
        ...buildDiscountFromSource(price, {
          discountType: mockRuntimeStore.products[index].discountType,
          discountAmount: mockRuntimeStore.products[index].discountAmount,
          discountPercent: mockRuntimeStore.products[index].discountPercent,
          discountReason: mockRuntimeStore.products[index].discountReason,
        }),
      };
      return cloneProduct(mockRuntimeStore.products[index]);
    },

    async updateStockCount(productId, stockCount) {
      assertValidStockCount(stockCount);
      const index = findProductIndex(productId);
      if (index < 0) {
        throw new NotFoundError("Product not found.", { productId });
      }

      const previous = mockRuntimeStore.products[index];
      const nextStatus =
        stockCount === 0 ? "sold" : previous.status === "archived" ? "archived" : "active";

      mockRuntimeStore.products[index] = {
        ...previous,
        stockCount,
        inStock: stockCount > 0,
        status: nextStatus,
      };

      return cloneProduct(mockRuntimeStore.products[index]);
    },

    async markAsSold(productId: string, input: MarkSoldDTO) {
      const index = findProductIndex(productId);
      if (index < 0) {
        throw new NotFoundError("Product not found.", { productId });
      }
      assertValidPrice(input.soldPrice);

      const previous = mockRuntimeStore.products[index];
      mockRuntimeStore.products[index] = {
        ...previous,
        stockCount: 0,
        inStock: false,
        status: "sold",
      };

      const soldAt = input.soldAt ?? new Date().toISOString();
      const nowIso = new Date().toISOString();

      mockRuntimeStore.sales.unshift({
        id: createRuntimeId("sale"),
        productId,
        saleChannel: input.saleChannel,
        salePrice: input.soldPrice,
        soldAt,
        auditNote: input.auditNote ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      for (const reservation of mockRuntimeStore.reservations) {
        if (reservation.productId === productId && reservation.status === "active") {
          reservation.status = "completed";
          reservation.updatedAt = nowIso;
        }
      }

      return cloneProduct(mockRuntimeStore.products[index]);
    },

    async archiveProduct(productId) {
      const index = findProductIndex(productId);
      if (index < 0) {
        throw new NotFoundError("Product not found.", { productId });
      }
      mockRuntimeStore.products[index] = {
        ...mockRuntimeStore.products[index],
        status: "archived",
        inStock: false,
        stockCount: 0,
      };

      for (const reservation of mockRuntimeStore.reservations) {
        if (reservation.productId === productId && reservation.status === "active") {
          reservation.status = "cancelled";
          reservation.cancellationReasonCode = "seller_cancelled";
          reservation.cancellationNote = "Archived from inventory";
          reservation.updatedAt = new Date().toISOString();
        }
      }
    },
  };
}
