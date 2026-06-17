import type { FieldOptionDTO } from "@/features/fields";
import type { CoreFieldKey, CoreFieldOption } from "@/features/fields/field-layout";

const CATEGORY_OPTION_VALUES = ["Bicycle", "Parts"] as const;

export function parseActionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Action failed. Please try again.";
}

export function normalizeOptionLabels(
  labels: string[]
): Array<Pick<FieldOptionDTO, "label" | "value" | "sortOrder">> {
  const seen = new Set<string>();
  return labels
    .map((label) => label.trim())
    .filter((label) => {
      if (!label) {
        return false;
      }
      const key = label.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((label, index) => ({
      label,
      value: label,
      sortOrder: index + 1,
    }));
}

export function normalizeCoreOptionLabels(
  fieldKey: CoreFieldKey,
  labels: string[]
): CoreFieldOption[] {
  if (fieldKey === "category") {
    return CATEGORY_OPTION_VALUES.map((value, index) => ({
      value,
      label: labels[index]?.trim() || value,
    }));
  }

  const seen = new Set<string>();
  return labels
    .map((label) => label.trim())
    .filter((label) => {
      if (!label) {
        return false;
      }
      const key = label.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((label) => ({
      label,
      value: label,
    }));
}

export function canEditCoreOptions(fieldKey: CoreFieldKey) {
  return fieldKey === "category" || fieldKey === "drive_type";
}

export const CATEGORY_OPTION_VALUES_FOR_FIELDS = CATEGORY_OPTION_VALUES;
