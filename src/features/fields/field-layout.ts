import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";
import type { FieldDTO, FieldDataType } from "@/features/fields/dto/field-dto";

export type CoreFieldKey =
  | "category"
  | "name"
  | "drive_type"
  | "serial"
  | "price"
  | "discount"
  | "stock_count"
  | "image"
  | "description";

export type CoreFieldDefinition = {
  key: CoreFieldKey;
  name: string;
  dataType: FieldDataType;
  defaultPublic: boolean;
  categories: ProductCategory[];
};

export type CoreFieldOption = {
  label: string;
  value: string;
};

export type FieldLayoutItem =
  | {
      id: `core:${CoreFieldKey}`;
      kind: "core";
      core: CoreFieldDefinition;
      isPublic: boolean;
    }
  | {
      id: `custom:${string}`;
      kind: "custom";
      field: FieldDTO;
      isPublic: boolean;
    };

type FieldLayoutConfig = {
  order: Partial<Record<ProductCategory, string[]>>;
  coreVisibility: Partial<Record<ProductCategory, Partial<Record<CoreFieldKey, boolean>>>>;
  coreLabels?: Partial<Record<ProductCategory, Partial<Record<CoreFieldKey, string>>>>;
  coreOptions?: Partial<Record<CoreFieldKey, CoreFieldOption[]>>;
};

const STORAGE_KEY = "velohub.fieldLayout.v1";

export const CORE_FIELD_DEFINITIONS: CoreFieldDefinition[] = [
  { key: "category", name: "Category", dataType: "text", defaultPublic: false, categories: ["Bicycle", "Parts"] },
  { key: "name", name: "Name", dataType: "text", defaultPublic: true, categories: ["Bicycle", "Parts"] },
  { key: "drive_type", name: "Drive Type", dataType: "text", defaultPublic: true, categories: ["Bicycle"] },
  { key: "serial", name: "Serial", dataType: "text", defaultPublic: false, categories: ["Bicycle", "Parts"] },
  { key: "price", name: "Price", dataType: "number", defaultPublic: true, categories: ["Bicycle", "Parts"] },
  { key: "discount", name: "Discount", dataType: "text", defaultPublic: true, categories: ["Bicycle", "Parts"] },
  { key: "stock_count", name: "Stock Count", dataType: "number", defaultPublic: false, categories: ["Bicycle", "Parts"] },
  { key: "image", name: "Photo", dataType: "image", defaultPublic: true, categories: ["Bicycle", "Parts"] },
  { key: "description", name: "Description", dataType: "text", defaultPublic: true, categories: ["Bicycle", "Parts"] },
];

const DEFAULT_CORE_OPTIONS: Partial<Record<CoreFieldKey, CoreFieldOption[]>> = {
  category: [
    { label: "Bicycle", value: "Bicycle" },
    { label: "Parts", value: "Parts" },
  ],
  drive_type: [
    { label: "Manual", value: "Manual" },
    { label: "Electrical", value: "Electrical" },
  ],
};

function emptyConfig(): FieldLayoutConfig {
  return {
    order: {},
    coreVisibility: {},
    coreLabels: {},
    coreOptions: {},
  };
}

export function loadFieldLayoutConfig(): FieldLayoutConfig {
  if (typeof window === "undefined") {
    return emptyConfig();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyConfig(), ...(JSON.parse(raw) as FieldLayoutConfig) } : emptyConfig();
  } catch {
    return emptyConfig();
  }
}

export function saveFieldLayoutConfig(config: FieldLayoutConfig) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function coreFieldsForCategory(category: ProductCategory): CoreFieldDefinition[] {
  return CORE_FIELD_DEFINITIONS.filter((field) => field.categories.includes(category));
}

export function coreFieldId(key: CoreFieldKey): `core:${CoreFieldKey}` {
  return `core:${key}`;
}

export function customFieldId(fieldId: string): `custom:${string}` {
  return `custom:${fieldId}`;
}

export function corePublicVisibility(
  config: FieldLayoutConfig,
  category: ProductCategory,
  field: CoreFieldDefinition
): boolean {
  return config.coreVisibility[category]?.[field.key] ?? field.defaultPublic;
}

export function setCorePublicVisibility(
  config: FieldLayoutConfig,
  category: ProductCategory,
  fieldKey: CoreFieldKey,
  isPublic: boolean
): FieldLayoutConfig {
  return {
    ...config,
    coreVisibility: {
      ...config.coreVisibility,
      [category]: {
        ...(config.coreVisibility[category] ?? {}),
        [fieldKey]: isPublic,
      },
    },
  };
}

export function coreFieldLabel(
  config: FieldLayoutConfig,
  category: ProductCategory,
  field: CoreFieldDefinition
): string {
  return config.coreLabels?.[category]?.[field.key]?.trim() || field.name;
}

export function setCoreFieldLabel(
  config: FieldLayoutConfig,
  category: ProductCategory,
  fieldKey: CoreFieldKey,
  name: string
): FieldLayoutConfig {
  return {
    ...config,
    coreLabels: {
      ...(config.coreLabels ?? {}),
      [category]: {
        ...(config.coreLabels?.[category] ?? {}),
        [fieldKey]: name,
      },
    },
  };
}

export function coreFieldOptions(
  config: FieldLayoutConfig,
  fieldKey: CoreFieldKey
): CoreFieldOption[] {
  const configuredOptions = config.coreOptions?.[fieldKey];
  const fallbackOptions = DEFAULT_CORE_OPTIONS[fieldKey] ?? [];
  const options = configuredOptions && configuredOptions.length > 0 ? configuredOptions : fallbackOptions;
  return options
    .map((option) => ({
      label: option.label.trim(),
      value: option.value.trim(),
    }))
    .filter((option) => option.label && option.value);
}

export function setCoreFieldOptions(
  config: FieldLayoutConfig,
  fieldKey: CoreFieldKey,
  options: CoreFieldOption[]
): FieldLayoutConfig {
  return {
    ...config,
    coreOptions: {
      ...(config.coreOptions ?? {}),
      [fieldKey]: options,
    },
  };
}

export function setCategoryFieldOrder(
  config: FieldLayoutConfig,
  category: ProductCategory,
  order: string[]
): FieldLayoutConfig {
  return {
    ...config,
    order: {
      ...config.order,
      [category]: order,
    },
  };
}

export function buildFieldLayoutItems(
  category: ProductCategory,
  customFields: FieldDTO[],
  config: FieldLayoutConfig
): FieldLayoutItem[] {
  const coreItems: FieldLayoutItem[] = coreFieldsForCategory(category).map((core) => ({
    id: coreFieldId(core.key),
    kind: "core",
    core: {
      ...core,
      name: coreFieldLabel(config, category, core),
    },
    isPublic: corePublicVisibility(config, category, core),
  }));

  const customItems: FieldLayoutItem[] = customFields
    .filter((field) => field.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((field) => ({
      id: customFieldId(field.id),
      kind: "custom",
      field,
      isPublic: field.isPublic,
    }));

  const itemById = new Map<string, FieldLayoutItem>(
    [...coreItems, ...customItems].map((item) => [item.id, item])
  );
  const configuredOrder = config.order[category] ?? [];
  const ordered: FieldLayoutItem[] = [];

  for (const itemId of configuredOrder) {
    const item = itemById.get(itemId);
    if (item) {
      ordered.push(item);
      itemById.delete(itemId);
    }
  }

  return [...ordered, ...Array.from(itemById.values())];
}
