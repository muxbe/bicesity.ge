import type { AttributeDTO, ProductDTO } from "@/features/catalog";
import type { ShopBootstrapDTO } from "@/features/shop/shop-bootstrap";

export type Translate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export type CategoryFilter = "All" | "Bicycle" | "Parts";
export type StockFilter = "All" | "In Stock" | "Out of Stock";
export type BikeTypeFilter = "All" | string;
export type HomeViewMode = "products" | "rent";

export type FilterState = {
  query: string;
  category: CategoryFilter;
  stock: StockFilter;
  bikeType: BikeTypeFilter;
  minPrice: string;
  maxPrice: string;
  attributeValues: Record<string, string>;
};

export const INITIAL_FILTERS: FilterState = {
  query: "",
  category: "All",
  stock: "All",
  bikeType: "All",
  minPrice: "",
  maxPrice: "",
  attributeValues: {},
};

export type ShopBootstrapApiResponse = {
  data?: ShopBootstrapDTO;
  error?: string;
};

export type HomeCatalogResult = {
  products: ProductDTO[];
  attributes: AttributeDTO[];
  messengerUrl: string;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
};

export type HomeFiltersResult = {
  draftFilters: FilterState;
  appliedFilters: FilterState;
  isDetailedOpen: boolean;
  visibleAttributes: AttributeDTO[];
  detailedAttributeOptions: Record<string, string[]>;
  bikeTypeOptions: string[];
  filteredProducts: ProductDTO[];
  activeFilterCount: number;
  updateDraftFilters: (updates: Partial<FilterState>) => void;
  updateAttributeFilter: (attributeId: string, value: string) => void;
  handleCategoryChange: (value: CategoryFilter) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  selectCatalogCategory: (category: CategoryFilter) => void;
  toggleDetailedFilters: () => void;
  closeDetailedFilters: () => void;
};

export type HomeNavigationResult = {
  activeView: HomeViewMode;
  showCatalogCategory: (category: CategoryFilter, hash: string) => void;
  showRentView: () => void;
};

export type UseHomeNavigationOptions = {
  canRenderShop: boolean;
  onHashCategory: (category: CategoryFilter) => void;
  onCloseDetailedFilters: () => void;
  onClearRentNotices: () => void;
};

export type RentMessengerResult = {
  messengerError: string | null;
  messengerMessage: string | null;
  openMessengerForRent: () => Promise<void>;
  clearRentMessengerNotices: () => void;
};
