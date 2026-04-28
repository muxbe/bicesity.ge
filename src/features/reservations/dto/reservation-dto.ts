import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";

export type ReservationStatus = "active" | "completed" | "cancelled" | "expired";

export type ReservationCancelReason =
  | "customer_cancelled"
  | "seller_cancelled"
  | "no_show"
  | "expired"
  | "other";

export type ReservationSource =
  | "manual"
  | "messenger"
  | "phone"
  | "walk_in"
  | "other";

export type ReservationDTO = {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  serial: string;
  image: string;
  price: number;
  status: ReservationStatus;
  reservedForAt: string;
  expiresAt: string;
  cancellationReasonCode: ReservationCancelReason | null;
  cancellationNote: string | null;
  customerName: string;
  customerPhone: string;
  messengerProfileUrl: string;
  reservationSource: ReservationSource;
  sellerComment: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertReservationDTO = {
  productId: string;
  reservedForAt: string;
  expiresAt?: string;
  note?: string;
  customerName?: string;
  customerPhone?: string;
  messengerProfileUrl?: string;
  reservationSource?: ReservationSource;
  sellerComment?: string;
};
