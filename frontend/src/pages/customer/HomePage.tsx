import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button, { ButtonLink } from '@/components/ui/Button';
import ProductGrid from '@/components/ui/ProductGrid';
import { ErrorState } from '@/components/ui/States';
import { COLLECTIONS } from '@/lib/constants';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { firstImage, parseImages } from '@/lib/images';
import { displayVariant, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { Collection, ProductWithVariants } from '@/types/models';

type ProductsState = { data: ProductWithVariants[] | null; loading: boolean };

const TILE = 'aspect-square w-36 shrink-0 rounded-2xl border border-ink/25 sm:w-44';

function Carousel({ products }: { products: ProductsState }) {
  // only products that have a real photo
  const tiles = (products.data ?? []).filter((p) => parseImages(displayVariant(p)?.images).length > 0).slice(0, 12);

  if (products.loading || tiles.length === 0) {
    return (
      <div className="flex justify-center gap-3 overflow-hidden" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={cn(TILE, 'opacity-50', tileColor(i))} />
        ))}
      </div>
    );
  }

  // the list is drawn twice so the loop has no gap, the copy is hidden from screen readers
  const row = (copy: boolean) => (
    <div className="flex gap-3 pr-3" aria-hidden={copy}>
      {tiles.map((p, i) => (
        <Link
          key={p.product_id}
          to={`/products/${p.product_id}`}
          tabIndex={copy ? -1 : undefined}
          title={p.product_name}
          className={cn(TILE, 'overflow-hidden p-3 transition-transform hover:-translate-y-1', tileColor(i))}
        >
          <img src={firstImage(displayVariant(p)?.images)} alt={copy ? '' : p.product_name} className="size-full object-contain" />
        </Link>
      ))}
    </div>
  );

  return (
    // with reduced motion it stops moving and can be scrolled by hand instead
    <div className="overflow-hidden py-1 motion-reduce:overflow-x-auto">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

function Hero({ products }: { products: ProductsState }) {
  return (
    <section className="pb-14 pt-12 sm:pb-20 sm:pt-16">
      <div className="container-page flex flex-col items-center text-center">
        <h1 className="text-6xl font-semibold leading-none tracking-tight text-forest sm:text-8xl md:text-9xl">
          comfy<span className="text-bark">&amp;</span>co
        </h1>
        <p className="mt-5 max-w-sm text-lg text-ink sm:text-xl">Bring warmth and soft texture straight into your living space</p>
        <Button
          size="lg"
          className="mt-7 px-10"
          onClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })}
        >
          View Categories
        </Button>
      </div>
      <div className="mt-10 sm:mt-12">
        <Carousel products={products} />
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
          View About Us
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
