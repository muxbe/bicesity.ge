import type { ProductCategory, ProductDTO, ProductStatus } from "@/features/catalog";
import type { ReservationSource } from "@/features/reservations";
import type { Locale } from "@/lib/i18n/dictionaries";

type TranslatableFieldName = {
  name: string;
  nameTranslations?: Partial<Record<Locale, string>> | null;
};

export function categoryLabel(category: ProductCategory, t: (key: string) => string) {
  return category === "Bicycle" ? t("common.bicycle") : t("common.parts");
}

export function fieldNameLabel(field: TranslatableFieldName, locale: Locale) {
  const translated = field.nameTranslations?.[locale]?.trim();
  if (translated) {
    return translated;
  }
  return field.nameTranslations?.en?.trim() || field.name;
}

export function stockLabel(inStock: boolean, t: (key: string) => string) {
  return inStock ? t("common.inStock") : t("common.outOfStock");
}

export function statusLabel(status: ProductStatus, t: (key: string) => string) {
  if (status === "active") {
    return t("common.active");
  }
  if (status === "reserved") {
    return t("common.reserved");
  }
  if (status === "sold") {
    return t("common.sold");
  }
  if (status === "archived") {
    return t("common.deleted");
  }
  return status;
}

export function driveTypeLabel(value: string | undefined, t: (key: string) => string) {
  if (!value) {
    return t("common.parts");
  }
  if (value === "Manual") {
    return t("common.manual");
  }
  if (value === "Electrical") {
    return t("common.electrical");
  }
  return value;
}

export function reservationSourceLabel(source: ReservationSource, t: (key: string) => string) {
  if (source === "manual") {
    return t("reservation.sourceManual");
  }
  if (source === "messenger") {
    return t("reservation.sourceMessenger");
  }
  if (source === "phone") {
    return t("reservation.sourcePhone");
  }
  if (source === "walk_in") {
    return t("reservation.sourceWalkIn");
  }
  if (source === "other") {
    return t("reservation.sourceOther");
  }
  return source;
}

export function discountLabel(product: ProductDTO, t: (key: string, params?: Record<string, string | number>) => string) {
  if (product.discountType === "percent" && product.discountPercent !== null) {
    return t("discount.percent", { value: product.discountPercent });
  }
  if (product.discountType === "amount" && product.discountAmount !== null) {
    return t("discount.amount", { value: `${product.discountAmount} GEL` });
  }
  return product.discountLabel;
}
