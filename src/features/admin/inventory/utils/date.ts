import { RESERVATION_HOLD_MS } from '../constants';

export function formatDatetimeForInput(rawIso: string): string {
  const date = new Date(rawIso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function reservationExpiryIso(reserveDate: Date): string {
  return new Date(reserveDate.getTime() + RESERVATION_HOLD_MS).toISOString();
}
