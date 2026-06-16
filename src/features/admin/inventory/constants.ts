import type { ReservationSource } from '@/features/reservations';
import type { ProductFormDraft, ReservationContextDraft } from './types';

export const EMPTY_DRAFT: ProductFormDraft = {
  name: '',
  category: 'Bicycle',
  type: 'Manual',
  serial: '',
  price: '',
  discountInput: '',
  stockCount: '1',
  description: '',
  image: '',
  images: [],
  values: {},
};

export const RESERVATION_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

export const EMPTY_RESERVATION_CONTEXT: ReservationContextDraft = {
  customerName: '',
  customerPhone: '',
  messengerProfileUrl: '',
  reservationSource: 'manual',
};

export const RESERVATION_SOURCE_OPTIONS: ReservationSource[] = [
  'manual',
  'messenger',
  'phone',
  'walk_in',
  'other',
];
