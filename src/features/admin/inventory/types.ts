import type { ProductCategory, ProductStatus } from '@/features/catalog';
import type { ReservationSource } from '@/features/reservations';

export type CategoryTab = 'All' | 'Bicycle' | 'Parts';
export type SellChannel = 'online' | 'in_store' | 'as_is';
export type StockFilter = 'All' | 'In Stock' | 'Out of Stock';
export type BikeTypeFilter = 'All' | string;
export type InventoryRole = 'admin' | 'seller';
export type BulkMode = 'discount' | 'remove-discount' | 'reserve' | 'cancel-reservation' | 'sell' | 'delete';

export type AdminInventoryPageProps = {
  role?: InventoryRole;
  statusView?: ProductStatus;
  title?: string;
  description?: string;
};

export type BulkActionResult = {
  success: Array<{ id: string; name: string }>;
  skipped: Array<{ id: string; name?: string; reason: string }>;
};

export type ReservationContextDraft = {
  customerName: string;
  customerPhone: string;
  messengerProfileUrl: string;
  reservationSource: ReservationSource;
};

export type ProductFormDraft = {
  name: string;
  category: ProductCategory;
  type: string;
  serial: string;
  price: string;
  discountInput: string;
  stockCount: string;
  description: string;
  image: string;
  images: string[];
  values: Record<string, string>;
};
