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
  | "description"
  | "rating";

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

export const FIELD_LAYOUT_VERSION = 1 as const;

export type FieldLayoutConfig = {
  version: typeof FIELD_LAYOUT_VERSION;
  configured: boolean;
  order: Partial<Record<ProductCategory, string[]>>;
  coreVisibility: Partial<Record<ProductCategory, Partial<Record<CoreFieldKey, boolean>>>>;
  coreLabels: Partial<Record<ProductCategory, Partial<Record<CoreFieldKey, string>>>>;
  coreOptions: Partial<Record<CoreFieldKey, CoreFieldOption[]>>;
};

export type FieldLayoutState = {
  config: FieldLayoutConfig;
  storageReady: boolean;
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
  { key: "rating", name: "Rating", dataType: "number", defaultPublic: false, categories: ["Bicycle", "Parts"] },
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

const PRODUCT_CATEGORIES: ProductCategory[] = ["Bicycle", "Parts"];
const MAX_ORDER_ITEMS = 200;
const MAX_LABEL_LENGTH = 120;
const MAX_OPTIONS_PER_FIELD = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coreFieldForKey(key: string): CoreFieldDefinition | undefined {
  return CORE_FIELD_DEFINITIONS.find((field) => field.key === key);
}

function safeText(value: unknown, maxLength = MAX_LABEL_LENGTH): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isAllowedOrderId(value: string, category: ProductCategory): boolean {
  if (value.startsWith("core:")) {
    const field = coreFieldForKey(value.slice("core:".length));
    return Boolean(field?.categories.includes(category));
  }
  return /^custom:[a-zA-Z0-9_-]{1,120}$/.test(value);
}

export function createDefaultFieldLayoutConfig(configured = false): FieldLayoutConfig {
  const coreVisibility: FieldLayoutConfig["coreVisibility"] = {};
  for (const category of PRODUCT_CATEGORIES) {
    coreVisibility[category] = Object.fromEntries(
      CORE_FIELD_DEFINITIONS.filter((field) => field.categories.includes(category)).map((field) => [
        field.key,
        field.defaultPublic,
      ])
    );
  }

  return {
    version: FIELD_LAYOUT_VERSION,
    configured,
    order: {},
    coreVisibility,
    coreLabels: {},
    coreOptions: {},
  };
}

export function normalizeFieldLayoutConfig(value: unknown): FieldLayoutConfig {
  const defaults = createDefaultFieldLayoutConfig(false);
  if (!isRecord(value)) {
    return defaults;
  }

  const orderInput = isRecord(value.order) ? value.order : {};
  const visibilityInput = isRecord(value.coreVisibility) ? value.coreVisibility : {};
  const labelsInput = isRecord(value.coreLabels) ? value.coreLabels : {};
  const optionsInput = isRecord(value.coreOptions) ? value.coreOptions : {};
  const order: FieldLayoutConfig["order"] = {};
  const coreVisibility: FieldLayoutConfig["coreVisibility"] = {
    Bicycle: { ...defaults.coreVisibility.Bicycle },
    Parts: { ...defaults.coreVisibility.Parts },
  };
  const coreLabels: FieldLayoutConfig["coreLabels"] = {};
  const coreOptions: FieldLayoutConfig["coreOptions"] = {};

  for (const category of PRODUCT_CATEGORIES) {
    const rawOrder = Array.isArray(orderInput[category]) ? orderInput[category] : [];
    order[category] = Array.from(
      new Set(
        rawOrder
          .slice(0, MAX_ORDER_ITEMS)
          .map((item) => safeText(item, 130))
          .filter((item) => item && isAllowedOrderId(item, category))
      )
    );

    const rawVisibility = isRecord(visibilityInput[category]) ? visibilityInput[category] : {};
    const rawLabels = isRecord(labelsInput[category]) ? labelsInput[category] : {};
    const categoryLabels: Partial<Record<CoreFieldKey, string>> = {};

    for (const field of CORE_FIELD_DEFINITIONS.filter((item) => item.categories.includes(category))) {
      if (typeof rawVisibility[field.key] === "boolean") {
        coreVisibility[category]![field.key] = rawVisibility[field.key] as boolean;
      }
      const label = safeText(rawLabels[field.key]);
      if (label) {
        categoryLabels[field.key] = label;
      }
    }
    coreLabels[category] = categoryLabels;
  }

  for (const field of CORE_FIELD_DEFINITIONS) {
    const candidateOptions = optionsInput[field.key];
    const rawOptions: unknown[] = Array.isArray(candidateOptions) ? candidateOptions : [];
    const seenValues = new Set<string>();
    const options: CoreFieldOption[] = [];
    for (const rawOption of rawOptions.slice(0, MAX_OPTIONS_PER_FIELD)) {
      if (!isRecord(rawOption)) {
        continue;
      }
      const label = safeText(rawOption.label);
      const optionValue = safeText(rawOption.value);
      const uniqueKey = optionValue.toLowerCase();
      if (!label || !optionValue || seenValues.has(uniqueKey)) {
        continue;
      }
      seenValues.add(uniqueKey);
      options.push({ label, value: optionValue });
    }
    if (options.length > 0) {
      coreOptions[field.key] = options;
    }
  }

  return {
    version: FIELD_LAYOUT_VERSION,
    configured: value.configured === true,
    order,
    coreVisibility,
    coreLabels,
    coreOptions,
  };
}

export function loadLegacyFieldLayoutConfig(): FieldLayoutConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeFieldLayoutConfig({
      ...(JSON.parse(raw) as Record<string, unknown>),
      configured: false,
    });
  } catch {
    return null;
  }
}

export function clearLegacyFieldLayoutConfig() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
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
