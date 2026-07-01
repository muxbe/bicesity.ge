import type { AttributeDTO, ProductDTO } from "@/features/catalog";
import { ProductCard } from "@/features/shop/home/components/product-card";
import type { Translate } from "@/features/shop/home/home-types";

export type ProductGridProps = {
  isLoading: boolean;
  products: ProductDTO[];
  attributes: AttributeDTO[];
  locale: string;
  t: Translate;
};

export function ProductGrid({ isLoading, products, attributes, locale, t }: ProductGridProps) {
  return (
    <section id="explore" className="max-w-7xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-8 text-4xl font-black text-black sm:mb-12 sm:text-5xl">{t('home.products')}</h1>

      {isLoading ? (
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-lg font-semibold text-slate-800 mb-2">{t('home.loadingProducts')}</p>
          <p className="text-slate-600">{t('home.fetchingCatalog')}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-lg font-semibold text-slate-800 mb-2">{t('home.noMatchingProducts')}</p>
          <p className="text-slate-600">{t('home.adjustFilters')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              attributes={attributes}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  );
}
