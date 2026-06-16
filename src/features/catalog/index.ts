export type {
  AttributeDTO,
  CatalogStatusCounts,
  CreateProductDTO,
  ProductCategory,
  ProductDiscountType,
  ProductDTO,
  ProductDriveType,
  ProductStatus,
  ProductStatusFilter,
} from "@/features/catalog/dto/catalog-dto";
export {
  formatGel,
  getCurrentPrice,
  parseDiscountInput,
} from "@/features/catalog/domain/catalog-discount";
export {
  buildPublicAttributes,
  getFallbackImage,
  groupProductsByCategory,
  normalizeProductImage,
  normalizeProductImages,
} from "@/features/catalog/repositories/catalog-helpers";
export { getCatalogRepository } from "@/features/catalog/repositories/catalog-repository.factory";
export type { CatalogRepository } from "@/features/catalog/repositories/catalog-repository";
export { useCatalogData } from "@/features/catalog/repositories/use-catalog-data";
