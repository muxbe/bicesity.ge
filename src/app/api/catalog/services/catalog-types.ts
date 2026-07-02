import type {
  ProductStatus,
  ProductStatusFilter,
} from "@/features/catalog/dto/catalog-dto";

export type CatalogItemRow = {
  id: string;
  name: string;
  item_type: "bicycle" | "part";
  serial_number: string;
  price_cents: number;
  stock_count: number;
  status: "active" | "reserved" | "sold" | "archived";
  description: string;
  rating: number | null;
  discount_type: "amount" | "percent" | null;
  discount_amount_cents: number | null;
  discount_percent_bps: number | null;
  discount_reason: string | null;
  bicycles: { drive_type: string } | { drive_type: string }[] | null;
  product_images:
    | {
        bucket_name: string | null;
        object_path: string | null;
        external_url: string | null;
        is_primary: boolean;
        sort_order: number;
      }[]
    | null;
};

export type AttributeRow = {
  id: string;
  display_name: string;
  category: "bicycle" | "part";
  is_public: boolean;
  sort_order: number;
  field_key: string;
  data_type: "text" | "number" | "boolean" | "date" | "image" | "url";
};

export type AttributeValidationRow = {
  id: string;
  display_name: string;
  input_mode: "free_text" | "single_select" | null;
};

export type AttributeOptionValidationRow = {
  attribute_id: string;
  value: string;
};

export type ValueRow = {
  catalog_item_id: string;
  attribute_id: string;
  value_text: string | null;
};

export type ProductImageStorageRow = {
  bucket_name: string | null;
  object_path: string | null;
  external_url: string | null;
};

export type ListProductsOptions = {
  syncReservations?: boolean;
};

export const CATALOG_ITEM_SELECT =
  "id,name,item_type,serial_number,price_cents,stock_count,status,description,rating,discount_type,discount_amount_cents,discount_percent_bps,discount_reason,bicycles(drive_type),product_images(bucket_name,object_path,external_url,is_primary,sort_order)";

export const PRODUCT_STATUSES: ProductStatus[] = [
  "active",
  "reserved",
  "sold",
  "archived",
];

export type CatalogStatusFilter = ProductStatusFilter;
