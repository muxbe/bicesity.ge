import type {
  AttributeDTO,
  CatalogStatusCounts,
  CreateProductDTO,
  MarkSoldDTO,
  ProductDTO,
  ProductStatusFilter,
  UpdateProductDTO,
} from "@/features/catalog/dto/catalog-dto";

export interface CatalogRepository {
  listProducts(options?: { status?: ProductStatusFilter }): Promise<ProductDTO[]>;
  listStatusCounts(): Promise<CatalogStatusCounts>;
  getProductById(productId: string): Promise<ProductDTO | null>;
  listAttributes(): Promise<AttributeDTO[]>;
  createProduct(input: CreateProductDTO): Promise<ProductDTO>;
  updateProduct(productId: string, input: UpdateProductDTO): Promise<ProductDTO>;
  updatePrice(productId: string, price: number): Promise<ProductDTO>;
  updateStockCount(productId: string, stockCount: number): Promise<ProductDTO>;
  markAsSold(productId: string, input: MarkSoldDTO): Promise<ProductDTO>;
  archiveProduct(productId: string): Promise<void>;
}
