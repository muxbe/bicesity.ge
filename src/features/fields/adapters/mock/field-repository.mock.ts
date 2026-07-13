import { createRuntimeId, mockRuntimeStore } from "@/features/mock-runtime/store";
import { NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import type {
  CreateFieldDTO,
  FieldDTO,
  UpdateFieldDTO,
} from "@/features/fields/dto/field-dto";
import type { FieldRepository } from "@/features/fields/repositories/field-repository";
import {
  createDefaultFieldLayoutConfig,
  normalizeFieldLayoutConfig,
} from "@/features/fields/field-layout";
import type { FieldLayoutConfig } from "@/features/fields/field-layout";

const archivedFieldIds = new Set<string>();
let mockFieldLayout = createDefaultFieldLayoutConfig(false);

function cloneField(field: FieldDTO): FieldDTO {
  return {
    ...field,
    nameTranslations: field.nameTranslations ? { ...field.nameTranslations } : null,
    options: field.options.map((option) => ({ ...option })),
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cloneFieldLayout(config: FieldLayoutConfig): FieldLayoutConfig {
  return normalizeFieldLayoutConfig(config);
}

export function createMockFieldRepository(): FieldRepository {
  return {
    async listFields(category = "all") {
      return mockRuntimeStore.attributes
        .filter((field) => !archivedFieldIds.has(field.id))
        .filter((field) => category === "all" || field.category === category)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(cloneField);
    },

    async createField(input: CreateFieldDTO) {
      if (!input.name.trim()) {
        throw new ValidationError("Field name is required.");
      }

      const nextSortOrder =
        mockRuntimeStore.attributes
          .filter((field) => field.category === input.category)
          .reduce((max, field) => Math.max(max, field.sortOrder), 0) + 1;

      const next: FieldDTO = {
        id: createRuntimeId("attr"),
        name: input.name.trim(),
        nameTranslations: input.nameTranslations
          ? { ...input.nameTranslations, en: input.nameTranslations.en?.trim() || input.name.trim() }
          : { en: input.name.trim() },
        category: input.category,
        isPublic: input.isPublic,
        sortOrder: nextSortOrder,
        fieldKey: slugify(input.name),
        dataType: input.dataType ?? "text",
        inputMode:
          input.inputMode === "single_select" && input.options && input.options.length > 0
            ? "single_select"
            : "free_text",
        options: (input.options ?? [])
          .map((option, index) => {
            const label = option.label.trim();
            return label
              ? {
                  label,
                  value: option.value?.trim() || label,
                  sortOrder: index + 1,
                }
              : null;
          })
          .filter((option): option is NonNullable<typeof option> => Boolean(option)),
        archivedAt: null,
      };

      mockRuntimeStore.attributes.push(next);
      return cloneField(next);
    },

    async updateField(fieldId: string, input: UpdateFieldDTO) {
      const index = mockRuntimeStore.attributes.findIndex((field) => field.id === fieldId);
      if (index < 0 || archivedFieldIds.has(fieldId)) {
        throw new NotFoundError("Field not found.", { fieldId });
      }

      const current = mockRuntimeStore.attributes[index];
      const nextName = input.name !== undefined ? input.name.trim() : current.name;
      if (!nextName) {
        throw new ValidationError("Field name cannot be empty.");
      }

      const next: FieldDTO = {
        ...current,
        name: nextName,
        nameTranslations:
          input.nameTranslations !== undefined
            ? { ...input.nameTranslations, en: input.nameTranslations.en?.trim() || nextName }
            : current.nameTranslations
            ? { ...current.nameTranslations }
            : { en: nextName },
        fieldKey: input.name !== undefined ? slugify(nextName) : current.fieldKey,
        isPublic: input.isPublic ?? current.isPublic,
        sortOrder: input.sortOrder ?? current.sortOrder,
        dataType: input.dataType ?? current.dataType,
        inputMode:
          input.inputMode !== undefined || input.options !== undefined
            ? input.inputMode === "single_select" && input.options && input.options.length > 0
              ? "single_select"
              : "free_text"
            : current.inputMode,
        options:
          input.options !== undefined
            ? input.options
                .map((option, index) => {
                  const label = option.label.trim();
                  return label
                    ? {
                        label,
                        value: option.value?.trim() || label,
                        sortOrder: index + 1,
                      }
                    : null;
                })
                .filter((option): option is NonNullable<typeof option> => Boolean(option))
            : current.options.map((option) => ({ ...option })),
      };

      mockRuntimeStore.attributes[index] = next;
      return cloneField(next);
    },

    async archiveField(fieldId: string) {
      const existing = mockRuntimeStore.attributes.find((field) => field.id === fieldId);
      if (!existing) {
        throw new NotFoundError("Field not found.", { fieldId });
      }
      archivedFieldIds.add(fieldId);
    },

    async getFieldLayout() {
      return {
        config: cloneFieldLayout(mockFieldLayout),
        storageReady: true,
      };
    },

    async updateFieldLayout(config: FieldLayoutConfig) {
      mockFieldLayout = normalizeFieldLayoutConfig({ ...config, configured: true });
      return {
        config: cloneFieldLayout(mockFieldLayout),
        storageReady: true,
      };
    },
  };
}
