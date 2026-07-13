import type {
  CoreFieldDefinition,
  FieldLayoutConfig,
} from "@/features/fields/field-layout";

export type Category = "Bicycle" | "Parts";
export type VisibilityFilter = "all" | "public" | "internal";
export type { FieldLayoutConfig };

export type CoreFieldEditor = {
  category: Category;
  field: CoreFieldDefinition;
  isPublic: boolean;
};
