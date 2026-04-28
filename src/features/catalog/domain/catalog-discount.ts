import type { ProductDiscountType, ProductDTO } from "@/features/catalog/dto/catalog-dto";

export type ParsedDiscount =
  | {
      ok: true;
      discountType: ProductDiscountType | null;
      discountInput: string;
      discountAmount: number | null;
      discountPercent: number | null;
      discountedPrice: number | null;
      discountLabel: string | null;
    }
  | {
      ok: false;
      error: string;
    };

type DiscountSource = {
  discountType: ProductDiscountType | null;
  discountAmount: number | null;
  discountPercent: number | null;
  discountReason?: string | null;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatGel(value: number): string {
  return `${formatNumber(value)} GEL`;
}

export function emptyDiscount(discountReason: string | null = null) {
  return {
    discountType: null,
    discountInput: "",
    discountAmount: null,
    discountPercent: null,
    discountReason,
    discountedPrice: null,
    discountLabel: null,
  };
}

export function parseDiscountInput(input: string | null | undefined, price: number): ParsedDiscount {
  const raw = (input ?? "").trim();
  if (!raw) {
    return {
      ok: true,
      discountType: null,
      discountInput: "",
      discountAmount: null,
      discountPercent: null,
      discountedPrice: null,
      discountLabel: null,
    };
  }

  if (!Number.isFinite(price) || price <= 0) {
    return {
      ok: false,
      error: "Price must be greater than 0 before adding a discount.",
    };
  }

  const normalized = raw.replace(",", ".");
  if (normalized.endsWith("%")) {
    const percent = Number(normalized.slice(0, -1).trim());
    if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
      return {
        ok: false,
        error: "Percent discount must be greater than 0% and less than 100%.",
      };
    }

    const discountedPrice = roundMoney(price - price * (percent / 100));
    return {
      ok: true,
      discountType: "percent",
      discountInput: `${formatNumber(percent)}%`,
      discountAmount: null,
      discountPercent: percent,
      discountedPrice,
      discountLabel: `${formatNumber(percent)}% discount`,
    };
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount >= price) {
    return {
      ok: false,
      error: "Fixed discount must be greater than 0 and less than the product price.",
    };
  }

  const roundedAmount = roundMoney(amount);
  return {
    ok: true,
    discountType: "amount",
    discountInput: formatNumber(roundedAmount),
    discountAmount: roundedAmount,
    discountPercent: null,
    discountedPrice: roundMoney(price - roundedAmount),
    discountLabel: `${formatGel(roundedAmount)} discount`,
  };
}

export function buildDiscountFromSource(
  price: number,
  source: DiscountSource
): Pick<
  ProductDTO,
  | "discountType"
  | "discountInput"
  | "discountAmount"
  | "discountPercent"
  | "discountReason"
  | "discountedPrice"
  | "discountLabel"
> {
  if (source.discountType === "amount" && source.discountAmount !== null) {
    const parsed = parseDiscountInput(String(source.discountAmount), price);
    if (parsed.ok) {
      return {
        discountType: parsed.discountType,
        discountInput: parsed.discountInput,
        discountAmount: parsed.discountAmount,
        discountPercent: parsed.discountPercent,
        discountReason: source.discountReason ?? null,
        discountedPrice: parsed.discountedPrice,
        discountLabel: parsed.discountLabel,
      };
    }
  }

  if (source.discountType === "percent" && source.discountPercent !== null) {
    const parsed = parseDiscountInput(`${source.discountPercent}%`, price);
    if (parsed.ok) {
      return {
        discountType: parsed.discountType,
        discountInput: parsed.discountInput,
        discountAmount: parsed.discountAmount,
        discountPercent: parsed.discountPercent,
        discountReason: source.discountReason ?? null,
        discountedPrice: parsed.discountedPrice,
        discountLabel: parsed.discountLabel,
      };
    }
  }

  return emptyDiscount(source.discountReason ?? null);
}

export function getCurrentPrice(product: ProductDTO): number {
  return product.discountedPrice ?? product.price;
}
