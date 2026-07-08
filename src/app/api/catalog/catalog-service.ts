export {
  countProductsByStatus,
  getProductById,
  listAttributes,
  listProducts,
  listPublicActiveProducts,
} from "@/app/api/catalog/services/catalog-queries";

export {
  createProduct,
  updatePrice,
  updateProduct,
  updateStockCount,
} from "@/app/api/catalog/services/catalog-commands";

export {
  archiveProduct,
  clearArchivedProduct,
  markAsSold,
  restoreProduct,
} from "@/app/api/catalog/services/catalog-lifecycle";
