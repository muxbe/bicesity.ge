import type { CoreFieldDefinition } from "@/features/fields/field-layout";

export type Category = "Bicycle" | "Parts";
export type VisibilityFilter = "all" | "public" | "internal";
export type FieldLayoutConfig = ReturnType<
  typeof import("@/features/fields/field-layout").loadFieldLayoutConfig
>;

export type CoreFieldEditor = {
  category: Category;
  field: CoreFieldDefinition;
  isPublic: boolean;
};
