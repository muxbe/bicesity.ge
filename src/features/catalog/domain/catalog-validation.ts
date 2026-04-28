import { ValidationError } from "@/features/shared/domain/errors";

export function assertValidPrice(price: number) {
  if (!Number.isFinite(price) || price < 0) {
    throw new ValidationError("Price must be a non-negative number.", { price });
  }
}

export function assertValidStockCount(stockCount: number) {
  if (!Number.isInteger(stockCount) || stockCount < 0) {
    throw new ValidationError("Stock count must be a non-negative integer.", { stockCount });
  }
}

export function assertRequiredText(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new ValidationError(`${fieldName} is required.`);
  }
}

