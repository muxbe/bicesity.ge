import type { Product } from '@/lib/mock-data';

export type StoredReservation = {
  productId: string;
  name: string;
  category: Product['category'];
  serial: string;
  image: string;
  price: number;
  date: string;
  time: string;
  createdAt: string;
};

const RESERVATIONS_STORAGE_KEY = 'velohub_admin_reservations';

export function readStoredReservations(): StoredReservation[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(RESERVATIONS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as StoredReservation[];
  } catch {
    return [];
  }
}

export function writeStoredReservations(reservations: StoredReservation[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
}

export function upsertReservation(
  current: StoredReservation[],
  product: Product,
  date: string,
  time: string
): StoredReservation[] {
  const nextItem: StoredReservation = {
    productId: product.id,
    name: product.name,
    category: product.category,
    serial: product.serial,
    image: product.image,
    price: product.price,
    date,
    time,
    createdAt: new Date().toISOString(),
  };

  const withoutSameProduct = current.filter((item) => item.productId !== product.id);
  return [nextItem, ...withoutSameProduct];
}

export function removeReservationByProductId(
  current: StoredReservation[],
  productId: string
): StoredReservation[] {
  return current.filter((item) => item.productId !== productId);
}

