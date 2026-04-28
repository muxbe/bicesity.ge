export type ProductCategory = "Bicycle" | "Parts";
export type ProductDriveType = string;
export type ProductDiscountType = "amount" | "percent";
export type ProductStatus = "active" | "reserved" | "sold" | "archived";
export type ProductStatusFilter = ProductStatus | "all";
export type AttributeInputMode = "free_text" | "single_select";

export type AttributeOptionDTO = {
  id?: string;
  label: string;
  value: string;
  sortOrder: number;
};

export type AttributeDTO = {
  id: string;
  name: string;
  nameTranslations?: Partial<Record<"en" | "ru" | "ka", string>> | null;
  category: ProductCategory;
  isPublic: boolean;
  sortOrder: number;
  fieldKey: string;
  dataType: "text" | "number" | "boolean" | "date" | "image" | "url";
  inputMode: AttributeInputMode;
  options: AttributeOptionDTO[];
};

export type ProductDTO = {
  id: string;
  name: string;
  category: ProductCategory;
  type?: ProductDriveType;
  serial: string;
  price: number;
  stockCount: number;
  inStock: boolean;
  image: string;
  images: string[];
  description: string;
  values: Record<string, string>;
  rating: number;
  status: ProductStatus;
  discountType: ProductDiscountType | null;
  discountInput: string;
  discountAmount: number | null;
  discountPercent: number | null;
  discountReason: string | null;
  discountedPrice: number | null;
  discountLabel: string | null;
};

export type CreateProductDTO = {
  name: string;
  category: ProductCategory;
  type?: ProductDriveType;
  serial: string;
  price: number;
  stockCount: number;
  description: string;
  image?: string;
  images?: string[];
  rating?: number;
  values?: Record<string, string>;
  discountInput?: string;
  discountReason?: string | null;
};

export type UpdateProductDTO = {
  name?: string;
  serial?: string;
  description?: string;
  type?: ProductDriveType;
  image?: string;
  images?: string[];
  values?: Record<string, string>;
  price?: number;
  stockCount?: number;
  discountInput?: string;
  discountReason?: string | null;
};

export type MarkSoldDTO = {
  saleChannel: "online" | "in_store" | "as_is";
  soldPrice: number;
  soldAt?: string;
  auditNote?: string | null;
};
