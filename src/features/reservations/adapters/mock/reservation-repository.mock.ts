import { NotFoundError, ValidationError } from "@/features/shared/domain/errors";
import { createRuntimeId, mockRuntimeStore, type MockReservationRecord } from "@/features/mock-runtime/store";
import type {
  ResolveExpiredReservationDTO,
  ReservationCancelReason,
  ReservationDTO,
  ReservationStatus,
  SellActiveReservationDTO,
  UpsertReservationDTO,
} from "@/features/reservations/dto/reservation-dto";
import type { ReservationRepository } from "@/features/reservations/repositories/reservation-repository";

function toDto(record: MockReservationRecord): ReservationDTO {
  const product = mockRuntimeStore.products.find((item) => item.id === record.productId);
  if (!product) {
    throw new NotFoundError("Product for reservation not found.", { productId: record.productId });
  }

  return {
    id: record.id,
    productId: record.productId,
    productName: product.name,
    category: product.category,
    serial: product.serial,
    image: product.image,
    price: product.price,
    status: record.status,
    reservedForAt: record.reservedForAt,
    expiresAt: record.expiresAt,
    cancellationReasonCode: record.cancellationReasonCode,
    cancellationNote: record.cancellationNote,
    customerName: record.customerName,
    customerPhone: record.customerPhone,
    messengerProfileUrl: record.messengerProfileUrl,
    reservationSource: record.reservationSource,
    sellerComment: record.sellerComment,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function setProductReservedState(productId: string, status: ReservationStatus) {
  const index = mockRuntimeStore.products.findIndex((item) => item.id === productId);
  if (index < 0) {
    return;
  }

  const current = mockRuntimeStore.products[index];
  if (current.status === "archived" || current.status === "sold") {
    return;
  }

  if (status === "active") {
    mockRuntimeStore.products[index] = {
      ...current,
      status: "reserved",
    };
    return;
  }

  mockRuntimeStore.products[index] = {
    ...current,
    status: current.stockCount > 0 ? "active" : "sold",
  };
}

function ensureProductExists(productId: string) {
  const found = mockRuntimeStore.products.find((item) => item.id === productId);
  if (!found) {
    throw new NotFoundError("Product not found.", { productId });
  }
}

function resolveExpiredNote(input: ResolveExpiredReservationDTO) {
  const fallback =
    input.outcome === "release"
      ? "Product released after reservation expiry."
      : "Product marked sold after reservation expiry.";
  return input.note?.trim() || fallback;
}

function resolveActiveSaleNote(input: SellActiveReservationDTO) {
  return input.auditNote?.trim() || "Sold from active reservation page.";
}

export function createMockReservationRepository(): ReservationRepository {
  return {
    async listReservations(status = "all") {
      const filtered =
        status === "all"
          ? mockRuntimeStore.reservations
          : mockRuntimeStore.reservations.filter((reservation) => reservation.status === status);

      return filtered
        .map(toDto)
        .sort((a, b) => a.reservedForAt.localeCompare(b.reservedForAt));
    },

    async upsertReservation(input: UpsertReservationDTO) {
      ensureProductExists(input.productId);
      if (!input.reservedForAt) {
        throw new ValidationError("reservedForAt is required.");
      }

      const expiresAt = input.expiresAt ?? input.reservedForAt;
      const nowIso = new Date().toISOString();
      const existingActive = mockRuntimeStore.reservations.find(
        (reservation) =>
          reservation.productId === input.productId && reservation.status === "active"
      );

      if (existingActive) {
        existingActive.reservedForAt = input.reservedForAt;
        existingActive.expiresAt = expiresAt;
        existingActive.customerName = input.customerName?.trim() ?? existingActive.customerName;
        existingActive.customerPhone = input.customerPhone?.trim() ?? existingActive.customerPhone;
        existingActive.messengerProfileUrl = input.messengerProfileUrl?.trim() ?? existingActive.messengerProfileUrl;
        existingActive.reservationSource = input.reservationSource ?? existingActive.reservationSource;
        existingActive.sellerComment = input.sellerComment?.trim() || input.note?.trim() || existingActive.sellerComment;
        existingActive.updatedAt = nowIso;
        setProductReservedState(input.productId, "active");
        return toDto(existingActive);
      }

      const nextRecord: MockReservationRecord = {
        id: createRuntimeId("res"),
        productId: input.productId,
        status: "active",
        reservedForAt: input.reservedForAt,
        expiresAt,
        cancellationReasonCode: null,
        cancellationNote: null,
        customerName: input.customerName?.trim() ?? "",
        customerPhone: input.customerPhone?.trim() ?? "",
        messengerProfileUrl: input.messengerProfileUrl?.trim() ?? "",
        reservationSource: input.reservationSource ?? "manual",
        sellerComment: input.sellerComment?.trim() || input.note?.trim() || "",
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      mockRuntimeStore.reservations.unshift(nextRecord);
      setProductReservedState(input.productId, "active");
      return toDto(nextRecord);
    },

    async cancelReservationByProductId(
      productId: string,
      reason: ReservationCancelReason,
      note?: string
    ) {
      const nowIso = new Date().toISOString();
      for (const reservation of mockRuntimeStore.reservations) {
        if (reservation.productId === productId && reservation.status === "active") {
          reservation.status = "cancelled";
          reservation.cancellationReasonCode = reason;
          reservation.cancellationNote = note?.trim() || null;
          reservation.updatedAt = nowIso;
        }
      }
      setProductReservedState(productId, "cancelled");
    },

    async completeReservationByProductId(productId: string) {
      const nowIso = new Date().toISOString();
      for (const reservation of mockRuntimeStore.reservations) {
        if (reservation.productId === productId && reservation.status === "active") {
          reservation.status = "completed";
          reservation.updatedAt = nowIso;
        }
      }
      setProductReservedState(productId, "completed");
    },

    async updateSellerComment(reservationId: string, sellerComment: string) {
      const reservation = mockRuntimeStore.reservations.find((item) => item.id === reservationId);
      if (!reservation) {
        throw new NotFoundError("Reservation not found.", { reservationId });
      }
      reservation.sellerComment = sellerComment.trim();
      reservation.updatedAt = new Date().toISOString();
    },

    async expirePastReservations(referenceTimeIso?: string) {
      const nowIso = referenceTimeIso ?? new Date().toISOString();
      let expiredCount = 0;
      for (const reservation of mockRuntimeStore.reservations) {
        if (reservation.status !== "active") {
          continue;
        }
        if (reservation.expiresAt >= nowIso) {
          continue;
        }
        reservation.status = "expired";
        reservation.cancellationReasonCode = "expired";
        reservation.cancellationNote = "Automatically expired.";
        reservation.updatedAt = nowIso;
        expiredCount += 1;
        setProductReservedState(reservation.productId, "expired");
      }
      return expiredCount;
    },

    async resolveExpiredReservation(
      reservationId: string,
      input: ResolveExpiredReservationDTO
    ) {
      const reservation = mockRuntimeStore.reservations.find((item) => item.id === reservationId);
      if (!reservation) {
        throw new NotFoundError("Reservation not found.", { reservationId });
      }
      if (reservation.status !== "expired") {
        throw new ValidationError("Only expired reservations can be resolved.");
      }

      const productIndex = mockRuntimeStore.products.findIndex(
        (item) => item.id === reservation.productId
      );
      if (productIndex < 0) {
        throw new NotFoundError("Product for reservation not found.", {
          productId: reservation.productId,
        });
      }

      const nowIso = new Date().toISOString();
      const product = mockRuntimeStore.products[productIndex];
      if (input.outcome === "release") {
        if (product.status === "sold" || product.status === "archived") {
          throw new ValidationError("Sold or deleted products cannot be released.");
        }
        mockRuntimeStore.products[productIndex] = {
          ...product,
          status: "active",
          inStock: product.stockCount > 0,
        };
        reservation.cancellationNote = resolveExpiredNote(input);
        reservation.updatedAt = nowIso;
        return;
      }

      if (input.soldPrice < 0) {
        throw new ValidationError("Sold price must be non-negative.");
      }
      if (product.status === "archived") {
        throw new ValidationError("Deleted products cannot be marked as sold.");
      }
      if (product.status === "sold") {
        throw new ValidationError("Product is already sold.");
      }

      mockRuntimeStore.sales.unshift({
        id: createRuntimeId("sale"),
        productId: product.id,
        saleChannel: input.saleChannel,
        salePrice: input.soldPrice,
        soldAt: nowIso,
        auditNote: resolveExpiredNote(input),
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      mockRuntimeStore.products[productIndex] = {
        ...product,
        status: "sold",
        stockCount: 0,
        inStock: false,
      };
      reservation.cancellationNote = resolveExpiredNote(input);
      reservation.updatedAt = nowIso;
    },

    async sellActiveReservation(
      reservationId: string,
      input: SellActiveReservationDTO
    ) {
      const reservation = mockRuntimeStore.reservations.find((item) => item.id === reservationId);
      if (!reservation) {
        throw new NotFoundError("Reservation not found.", { reservationId });
      }
      if (reservation.status !== "active") {
        throw new ValidationError("Only active reservations can be sold.");
      }
      if (input.soldPrice < 0) {
        throw new ValidationError("Sold price must be non-negative.");
      }

      const productIndex = mockRuntimeStore.products.findIndex(
        (item) => item.id === reservation.productId
      );
      if (productIndex < 0) {
        throw new NotFoundError("Product for reservation not found.", {
          productId: reservation.productId,
        });
      }

      const product = mockRuntimeStore.products[productIndex];
      if (product.status === "archived") {
        throw new ValidationError("Deleted products cannot be marked as sold.");
      }
      if (product.status === "sold") {
        throw new ValidationError("Product is already sold.");
      }
      if (product.stockCount <= 0) {
        throw new ValidationError("Out-of-stock products cannot be marked as sold.");
      }

      const nowIso = input.soldAt ?? new Date().toISOString();
      mockRuntimeStore.sales.unshift({
        id: createRuntimeId("sale"),
        productId: product.id,
        saleChannel: input.saleChannel,
        salePrice: input.soldPrice,
        soldAt: nowIso,
        auditNote: resolveActiveSaleNote(input),
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      mockRuntimeStore.products[productIndex] = {
        ...product,
        status: "sold",
        stockCount: 0,
        inStock: false,
      };
      reservation.status = "completed";
      reservation.updatedAt = nowIso;
    },
  };
}
