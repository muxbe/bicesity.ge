import type { AttributeDTO, ProductDTO } from "@/features/catalog";
import type { AppSettingsDTO } from "@/lib/settings";

export type ShopBootstrapDTO = {
  products: ProductDTO[];
  attributes: AttributeDTO[];
  settings: AppSettingsDTO;
};
