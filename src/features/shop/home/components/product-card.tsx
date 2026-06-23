import Link from "next/link";
import {
  buildPublicAttributes,
  type AttributeDTO,
  type ProductDTO,
} from "@/features/catalog";
import { PriceDisplay } from "@/features/catalog/components/price-display";
import { ProductCardImage } from "@/features/shop/home/components/product-card-image";
import type { Translate } from "@/features/shop/home/home-types";
import {
  categoryLabel,
  discountLabel,
  driveTypeLabel,
  fieldNameLabel,
  stockLabel,
  type Locale,
} from "@/lib/i18n";

export type ProductCardProps = {
  product: ProductDTO;
  attributes: AttributeDTO[];
  locale: string;
  t: Translate;
};

export function ProductCard({ product, attributes, locale, t }: ProductCardProps) {
  const publicAttributes = buildPublicAttributes(product, attributes);

  return (
    <Link key={product.id} href={`/shop/${product.id}`}>
      <div className="group cursor-pointer h-full flex flex-col">
        <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl bg-slate-100 sm:mb-6 sm:rounded-[2.5rem]">
          <ProductCardImage product={product} />
          <div className="absolute top-4 right-4 bg-black/75 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur">
            {categoryLabel(product.category, t)}
          </div>
        </div>

        <h3 className="text-lg font-bold text-black mb-2 group-hover:text-[var(--brand-cyan-dark)] transition">
          {product.name}
        </h3>

        <PriceDisplay product={product} size="card" discountLabel={discountLabel(product, t)} />

        <p className="text-slate-600 text-sm mb-4 line-clamp-2">{product.description}</p>

        {publicAttributes.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {publicAttributes.slice(0, 3).map((attribute) => (
              <span
                key={attribute.id}
                className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-semibold"
              >
                {fieldNameLabel(attribute, locale as Locale)}: {attribute.value}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-semibold">
            {driveTypeLabel(product.type, t)}
          </span>
          <span
            className={`text-xs px-3 py-1 rounded-full font-semibold ${
              product.inStock ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {stockLabel(product.inStock, t)}
          </span>
        </div>

        <span className="brand-primary mt-auto w-full rounded-xl py-3 text-center font-semibold transition sm:rounded-[1.5rem]">
          {t('home.viewDetails')}
        </span>
      </div>
    </Link>
  );
}
