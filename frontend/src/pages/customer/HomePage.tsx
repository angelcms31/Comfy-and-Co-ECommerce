import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import ProductGrid from '@/components/ui/ProductGrid';
import { ErrorState } from '@/components/ui/States';
import { COLLECTIONS } from '@/lib/constants';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { firstImage } from '@/lib/images';
import { displayVariant, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { Collection, ProductWithVariants } from '@/types/models';

type ProductsState = { data: ProductWithVariants[] | null; loading: boolean };

function Hero({ products }: { products: ProductsState }) {
  const { data, loading } = products;
  const tiles = (data ?? []).slice(0, 9);

  return (
    <section className="container-page grid items-center gap-6 py-8 md:grid-cols-2 md:gap-10 md:py-14">
      <div className="flex flex-col items-center justify-center rounded-3xl bg-mint-light px-6 py-14 text-center md:py-24">
        <h1 className="text-5xl font-semibold text-forest sm:text-6xl">comfy&amp;co</h1>
        <p className="mt-4 max-w-xs text-base text-ink sm:text-lg">Bring warmth and soft texture straight into your living space</p>
        <Button
          size="lg"
          className="mt-7 px-10"
          onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
        >
          View categories <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-hidden={loading}>
        {loading || tiles.length === 0
          ? Array.from({ length: 9 }, (_, i) => <div key={i} className={cn('aspect-square rounded-2xl opacity-60', tileColor(i))} />)
          : tiles.map((p, i) => (
              <Link
                key={p.product_id}
                to={`/products/${p.product_id}`}
                className={cn('aspect-square overflow-hidden rounded-2xl p-2 transition-transform hover:-translate-y-0.5', tileColor(i + (Math.floor(i / 3) % 2)))}
                title={p.product_name}
              >
                <img src={firstImage(displayVariant(p)?.images)} alt={p.product_name} className="size-full object-contain" />
              </Link>
            ))}
      </div>
    </section>
  );
}

function Categories({ products }: { products: ProductsState }) {
  const categories = useAsync(() => categoryService.getAll(), []);

  // use a product photo from each category as its picture
  const imageFor = (categId: number) => {
    const p = products.data?.find((x) => x.item_categ_id === categId);
    return p ? firstImage(displayVariant(p)?.images) : '/images/placeholder.svg';
  };

  return (
    <section id="categories" className="checker-butter scroll-mt-28 py-14 sm:py-20">
      <div className="container-page">
        <h2 className="mb-10 text-center text-4xl font-semibold text-forest sm:text-5xl">our categories</h2>
        {categories.error ? (
          <ErrorState message={categories.error} onRetry={categories.reload} />
        ) : (
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-8 sm:gap-x-12">
            {(categories.data ?? Array.from({ length: 7 }, () => null)).map((c, i) =>
              c ? (
                <Link
                  key={c.item_categ_id}
                  to={`/products?category=${c.item_categ_id}`}
                  className="group flex w-28 flex-col items-center gap-2 sm:w-36"
                >
                  <img src={imageFor(c.item_categ_id)} alt="" className="h-24 w-full object-contain transition-transform group-hover:-translate-y-1 sm:h-32" />
                  <span className="font-display text-lg text-forest group-hover:underline sm:text-xl">{c.item_category.toLowerCase()}</span>
                </Link>
              ) : (
                <div key={i} className="flex w-28 flex-col items-center gap-2 sm:w-36">
                  <div className="h-24 w-full animate-pulse rounded-xl bg-butter sm:h-32" />
                  <div className="h-5 w-20 animate-pulse rounded bg-butter" />
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Collections() {
  const [tab, setTab] = useState<Collection>('all');
  const { data, loading, error, reload } = useAsync(() => productService.getAll({ collection: tab }), [tab]);

  return (
    <section className="container-page py-14 sm:py-20">
      <h2 className="text-center text-4xl font-semibold text-forest sm:text-5xl">our collections</h2>
      <div className="my-6 flex flex-wrap justify-center gap-2" role="tablist">
        {COLLECTIONS.map((c) => (
          <button
            key={c.value}
            role="tab"
            aria-selected={tab === c.value}
            onClick={() => setTab(c.value)}
            className={cn(
              'rounded-full px-5 py-1.5 text-sm font-medium transition-colors',
              tab === c.value ? 'bg-mint text-forest' : 'bg-forest text-white hover:bg-forest-light',
            )}
          >
            {c.label.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="mx-auto max-w-4xl">
        <ProductGrid products={data?.slice(0, 6) ?? null} loading={loading} error={error} onRetry={reload} />
        {data && data.length > 0 && (
          <div className="mt-8 flex justify-center">
            <ButtonLink to={`/products?collection=${tab}`} variant="outline" className="min-w-40">
              see more
            </ButtonLink>
          </div>
        )}
      </div>
    </section>
  );
}

function Philosophy() {
  return (
    <section className="grid md:grid-cols-2">
      <img src="/images/living-room.svg" alt="A cozy living room with a brown leather sofa" className="h-72 w-full object-cover md:h-full" />
      <div className="checker-mint flex flex-col justify-center px-6 py-14 sm:px-12">
        <h2 className="text-4xl font-semibold leading-tight text-forest sm:text-5xl">
          designed for
          <br />
          comfort
        </h2>
        <h3 className="mt-5 font-sans text-base font-medium text-ink">Our Philosophy</h3>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-ink sm:text-base">
          At Comfy&amp;Co., we believe home furnishings should feel soft and easy to live with. We select durable wood finishes and
          practical space-saving pieces built to fit apartments and family rooms alike.
        </p>
        <ButtonLink to="/about" className="mt-6 w-fit px-10">
          About Us <ArrowRight className="size-4" />
        </ButtonLink>
      </div>
    </section>
  );
}

export default function HomePage() {
  const products = useAsync(() => productService.getAll({ sort: 'newest' }), []);
  return (
    <>
      <Hero products={products} />
      <Categories products={products} />
      <Collections />
      <Philosophy />
    </>
  );
}
