import type {
  ResolveExpiredReservationDTO,
  ReservationCancelReason,
  ReservationDTO,
  ReservationStatus,
  SellActiveReservationDTO,
  UpsertReservationDTO,
} from "@/features/reservations/dto/reservation-dto";

export interface ReservationRepository {
  listReservations(status?: ReservationStatus | "all"): Promise<ReservationDTO[]>;
  upsertReservation(input: UpsertReservationDTO): Promise<ReservationDTO>;
  cancelReservationByProductId(
    productId: string,
    reason: ReservationCancelReason,
    note?: string
  ): Promise<void>;
  completeReservationByProductId(productId: string): Promise<void>;
  updateSellerComment(reservationId: string, sellerComment: string): Promise<void>;
  expirePastReservations(referenceTimeIso?: string): Promise<number>;
  resolveExpiredReservation(
    reservationId: string,
    input: ResolveExpiredReservationDTO
  ): Promise<void>;
  sellActiveReservation(
    reservationId: string,
    input: SellActiveReservationDTO
  ): Promise<void>;
}
