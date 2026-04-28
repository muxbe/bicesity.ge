import type {
  AttributeDTO,
  CreateProductDTO,
  MarkSoldDTO,
  ProductDTO,
  UpdateProductDTO,
} from "@/features/catalog/dto/catalog-dto";
import { assertValidPrice, assertValidStockCount } from "@/features/catalog/domain/catalog-validation";
import type { CatalogRepository } from "@/features/catalog/repositories/catalog-repository";
import { AdapterError } from "@/features/shared/domain/errors";
import { getAuthHeaders, getJsonAuthHeaders } from "@/lib/auth/request-headers";

type ApiResponse<T> = {
  data?: T;
  error?: string;
  details?: unknown;
};

function detailMessage(details: unknown): string | null {
  if (
    details &&
    typeof details === "object" &&
    "message" in details &&
    typeof details.message === "string"
  ) {
    return details.message;
  }
  return null;
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.data === undefined) {
    const message = payload?.error ?? fallbackMessage;
    const details = detailMessage(payload?.details);
    throw new AdapterError(details ? `${message} ${details}` : message, payload?.details);
  }

  return payload.data;
}

export function createSupabaseCatalogRepository(): CatalogRepository {
  return {
    async listProducts(options) {
      const searchParams = new URLSearchParams();
      if (options?.status) {
        searchParams.set("status", options.status);
      }
      const query = searchParams.toString();
      const response = await fetch(`/api/catalog${query ? `?${query}` : ""}`, {
        method: "GET",
        headers: await getAuthHeaders(),
        cache: "no-store",
      });
      return parseApiResponse<ProductDTO[]>(response, "Failed to fetch catalog items.");
    },

    async getProductById(productId) {
      const response = await fetch(`/api/catalog/${encodeURIComponent(productId)}`, {
        method: "GET",
        headers: await getAuthHeaders(),
        cache: "no-store",
      });

      if (response.status === 404) {
        return null;
      }

      return parseApiResponse<ProductDTO>(response, "Failed to fetch catalog item.");
    },

    async listAttributes() {
      const response = await fetch("/api/fields", {
        method: "GET",
        headers: await getAuthHeaders(),
        cache: "no-store",
      });
      return parseApiResponse<AttributeDTO[]>(response, "Failed to fetch attributes.");
    },

    async createProduct(input: CreateProductDTO) {
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify(input),
      });
      return parseApiResponse<ProductDTO>(response, "Failed to create product.");
    },

    async updateProduct(productId: string, input: UpdateProductDTO) {
      const response = await fetch(`/api/catalog/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify(input),
      });
      return parseApiResponse<ProductDTO>(response, "Failed to update product.");
    },

    async updatePrice(productId, price) {
      assertValidPrice(price);
      const response = await fetch(`/api/catalog/${encodeURIComponent(productId)}/critical`, {
        method: "PATCH",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify({ price }),
      });
      return parseApiResponse<ProductDTO>(response, "Failed to update price.");
    },

    async updateStockCount(productId, stockCount) {
      assertValidStockCount(stockCount);
      const response = await fetch(`/api/catalog/${encodeURIComponent(productId)}/critical`, {
        method: "PATCH",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify({ stockCount }),
      });
      return parseApiResponse<ProductDTO>(response, "Failed to update stock count.");
    },

    async markAsSold(productId: string, input: MarkSoldDTO) {
      const response = await fetch(`/api/catalog/${encodeURIComponent(productId)}/sold`, {
        method: "POST",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify(input),
      });
      return parseApiResponse<ProductDTO>(response, "Failed to mark product as sold.");
    },

    async archiveProduct(productId) {
      const response = await fetch(`/api/catalog/${encodeURIComponent(productId)}`, {
        method: "DELETE",
        headers: await getAuthHeaders("admin"),
      });
      await parseApiResponse<{ archived: boolean }>(response, "Failed to archive product.");
    },
  };
}
