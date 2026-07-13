import { AdapterError, ValidationError } from "@/features/shared/domain/errors";
import type {
  CreateFieldDTO,
  FieldDTO,
  UpdateFieldDTO,
} from "@/features/fields/dto/field-dto";
import type { FieldRepository } from "@/features/fields/repositories/field-repository";
import type {
  FieldLayoutConfig,
  FieldLayoutState,
} from "@/features/fields/field-layout";
import { getAuthHeaders, getJsonAuthHeaders } from "@/lib/auth/request-headers";

type ApiResponse<T> = {
  data?: T;
  error?: string;
  details?: unknown;
};

function categoryQuery(category: "Bicycle" | "Parts" | "all") {
  return category === "all" ? "" : `?category=${encodeURIComponent(category)}`;
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.data === undefined) {
    throw new AdapterError(payload?.error ?? fallbackMessage, payload?.details);
  }

  return payload.data;
}

export function createSupabaseFieldRepository(): FieldRepository {
  return {
    async listFields(category = "all") {
      const response = await fetch(`/api/fields${categoryQuery(category)}`, {
        method: "GET",
        headers: await getAuthHeaders("admin"),
        cache: "no-store",
      });
      return parseApiResponse<FieldDTO[]>(response, "Failed to load fields.");
    },

    async createField(input: CreateFieldDTO) {
      if (!input.name.trim()) {
        throw new ValidationError("Field name is required.");
      }

      const response = await fetch("/api/fields", {
        method: "POST",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify(input),
      });

      return parseApiResponse<FieldDTO>(response, "Failed to create field.");
    },

    async updateField(fieldId: string, input: UpdateFieldDTO) {
      const response = await fetch(`/api/fields/${encodeURIComponent(fieldId)}`, {
        method: "PATCH",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify(input),
      });

      return parseApiResponse<FieldDTO>(response, "Failed to update field.");
    },

    async archiveField(fieldId: string) {
      const response = await fetch(`/api/fields/${encodeURIComponent(fieldId)}`, {
        method: "DELETE",
        headers: await getAuthHeaders("admin"),
      });

      await parseApiResponse<{ archived: boolean }>(response, "Failed to archive field.");
    },

    async getFieldLayout() {
      const response = await fetch("/api/fields/layout", {
        method: "GET",
        headers: await getAuthHeaders("admin"),
        cache: "no-store",
      });
      return parseApiResponse<FieldLayoutState>(response, "Failed to load shared field layout.");
    },

    async updateFieldLayout(config: FieldLayoutConfig) {
      const response = await fetch("/api/fields/layout", {
        method: "PATCH",
        headers: await getJsonAuthHeaders("admin"),
        body: JSON.stringify({ config }),
      });
      return parseApiResponse<FieldLayoutState>(response, "Failed to save shared field layout.");
    },
  };
}
