import type { ProductDTO } from "@/features/catalog/dto/catalog-dto";
import { formatGel } from "@/features/catalog/domain/catalog-discount";

type PriceDisplayProps = {
  product: ProductDTO;
  size?: "card" | "detail" | "compact";
  discountLabel?: string | null;
};

const sizeClasses = {
  card: {
    wrapper: "mb-3",
    current: "text-xl font-bold",
    old: "text-sm",
    badge: "text-xs",
  },
  detail: {
    wrapper: "",
    current: "text-5xl font-black",
    old: "text-lg",
    badge: "text-sm",
  },
  compact: {
    wrapper: "",
    current: "text-base font-black",
    old: "text-xs",
    badge: "text-xs",
  },
};

export function PriceDisplay({ product, size = "card", discountLabel }: PriceDisplayProps) {
  const classes = sizeClasses[size];

  if (product.discountedPrice !== null && product.discountLabel) {
    return (
      <div className={classes.wrapper}>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className={`${classes.old} font-semibold text-slate-400 line-through`}>
            {formatGel(product.price)}
          </span>
          <span className={`${classes.current} text-rose-600`}>
            {formatGel(product.discountedPrice)}
          </span>
        </div>
        <span
          className={`${classes.badge} mt-1 inline-flex rounded-full bg-rose-50 px-2.5 py-1 font-bold text-rose-700`}
        >
          {discountLabel ?? product.discountLabel}
        </span>
      </div>
    );
  }

  return (
    <p className={`${classes.wrapper} ${classes.current} text-[var(--brand-cyan-dark)]`}>
      {formatGel(product.price)}
    </p>
  );
}
