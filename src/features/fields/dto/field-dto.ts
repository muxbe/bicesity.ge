import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";

export type FieldDataType = "text" | "number" | "boolean" | "date" | "image" | "url";
export type FieldInputMode = "free_text" | "single_select";
export type FieldNameTranslations = Partial<Record<"en" | "ru" | "ka", string>>;

export type FieldOptionDTO = {
  id?: string;
  label: string;
  value: string;
  sortOrder: number;
};

export type FieldDTO = {
  id: string;
  name: string;
  nameTranslations?: FieldNameTranslations | null;
  category: ProductCategory;
  isPublic: boolean;
  sortOrder: number;
  fieldKey: string;
  dataType: FieldDataType;
  inputMode: FieldInputMode;
  options: FieldOptionDTO[];
  archivedAt?: string | null;
};

export type CreateFieldDTO = {
  name: string;
  nameTranslations?: FieldNameTranslations;
  category: ProductCategory;
  isPublic: boolean;
  dataType?: FieldDataType;
  inputMode?: FieldInputMode;
  options?: Array<Pick<FieldOptionDTO, "label"> & Partial<Pick<FieldOptionDTO, "value" | "sortOrder">>>;
};

export type UpdateFieldDTO = {
  name?: string;
  nameTranslations?: FieldNameTranslations;
  isPublic?: boolean;
  sortOrder?: number;
  dataType?: FieldDataType;
  inputMode?: FieldInputMode;
  options?: Array<Pick<FieldOptionDTO, "label"> & Partial<Pick<FieldOptionDTO, "value" | "sortOrder">>>;
};
