import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Armchair, BedDouble, ChevronRight, LampDesk, Sofa, Utensils, X, type LucideIcon } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import ProductGrid from '@/components/ui/ProductGrid';
import { ErrorState } from '@/components/ui/States';
import { CATEGORY_PHOTOS, COLLECTIONS } from '@/lib/constants';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { firstImage, parseImages } from '@/lib/images';
import { displayVariant, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { Collection, ProductWithVariants } from '@/types/models';

type ProductsState = { data: ProductWithVariants[] | null; loading: boolean };

const TILE = 'aspect-square w-36 shrink-0 rounded-2xl border border-ink/25 sm:w-44';

// categories go in two rows like the mockup, the top one fuller: 7 -> 4 + 3, 5 -> 3 + 2. Four or less stay in one row.
function splitRows<T>(items: T[]): T[][] {
  if (items.length <= 4) return [items];
  const top = Math.ceil(items.length / 2);
  return [items.slice(0, top), items.slice(top)];
}

// icon for a category with no product photos yet, matched by a word in its name
const ROOM_ICONS: [string, LucideIcon][] = [
  ['living', Sofa],
  ['bed', BedDouble],
  ['kitchen', Utensils],
  ['dining', Utensils],
  ['office', LampDesk],
  ['storage', Archive],
];

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

  // use a product photo from each category as its picture, or a room icon if none of its products has a photo yet
  const imageFor = (categId: number) => {
    const withPhoto = (products.data ?? []).filter((x) => x.item_categ_id === categId && parseImages(displayVariant(x)?.images).length > 0);
    const chosen = CATEGORY_PHOTOS[withPhoto[0]?.category.item_category ?? ''];
    const p = withPhoto.find((x) => x.product_id === chosen) ?? withPhoto[0];
    return p ? firstImage(displayVariant(p)?.images) : null;
  };
  const iconFor = (name: string, size = 'size-12 sm:size-14') => {
    const Icon = ROOM_ICONS.find(([word]) => name.toLowerCase().includes(word))?.[1] ?? Armchair;
    return <Icon className={cn(size, 'text-forest/70')} strokeWidth={1.5} />;
  };
  // subcategory names of a category with how many products each has
  const subsOf = (categId: number) => {
    const counts = new Map<string, number>();
    for (const p of products.data ?? []) {
      if (p.item_categ_id === categId && p._temp_subcategory) counts.set(p._temp_subcategory, (counts.get(p._temp_subcategory) ?? 0) + 1);
    }
    return [...counts];
  };

  // clicking a category opens its panel in place of the row, the X goes back
  const [openId, setOpenId] = useState<number | null>(null);
  const open = categories.data?.find((c) => c.item_categ_id === openId);

  if (open) {
    const subs = subsOf(open.item_categ_id);
    const image = imageFor(open.item_categ_id);
    const all = `/products?category=${open.item_categ_id}`;
    return (
      <section id="categories" className="checker-butter scroll-mt-28 py-14 sm:py-20">
        <div className="container-page max-w-3xl">
          <div className="relative mb-8">
            <h2 className="text-center text-4xl font-semibold text-forest sm:text-5xl">our categories</h2>
            <button
              onClick={() => setOpenId(null)}
              aria-label="Back to all categories"
              className="absolute right-0 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-mint text-forest hover:bg-mint-light"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="grid animate-pop-in gap-4 sm:grid-cols-[1fr_1.4fr]">
            <div className="overflow-hidden rounded-card border border-ink/25 bg-white">
              <div className="grid h-48 place-items-center bg-mint-light p-4 sm:h-56">
                {image ? <img src={image} alt="" className="size-full object-contain" /> : iconFor(open.item_category, 'size-20')}
              </div>
              <div className="p-4">
                <p className="font-display text-2xl font-semibold text-forest">{open.item_category.toLowerCase()}</p>
                <p className="text-xs text-muted">
                  {subs.length} subcategor{subs.length === 1 ? 'y' : 'ies'}
                </p>
              </div>
            </div>

            <div className="flex flex-col rounded-card border border-ink/25 bg-white p-4">
              {subs.length ? (
                <ul className="flex-1 divide-y divide-line">
                  {subs.map(([name, count]) => (
                    <li key={name}>
                      <Link
                        to={`${all}&sub=${encodeURIComponent(name)}`}
                        className="flex items-center justify-between gap-2 py-2.5 text-sm text-ink hover:text-forest"
                      >
                        <span>
                          {name} <span className="text-xs text-muted">({count})</span>
                        </span>
                        <ChevronRight className="size-4 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="grid flex-1 place-items-center py-8 text-center text-sm text-muted">
                  No products in this category yet. Check back soon!
                </p>
              )}
              <ButtonLink to={all} size="sm" className="mt-4 self-start px-5">
                View all {open.item_category.toLowerCase()}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="categories" className="checker-butter scroll-mt-28 py-14 sm:py-20">
      <div className="container-page">
        <h2 className="mb-10 text-center text-4xl font-semibold text-forest sm:text-5xl">our categories</h2>
        {categories.error ? (
          <ErrorState message={categories.error} onRetry={categories.reload} />
        ) : (
          <div className="space-y-10">
            {splitRows(categories.data ?? Array.from({ length: 5 }, () => null)).map((row, r) => (
              <div key={r} className="flex flex-wrap justify-center gap-x-6 gap-y-10 sm:gap-x-14">
                {row.map((c, i) =>
                  c ? (
                    <button
                      key={c.item_categ_id}
                      type="button"
                      onClick={() => setOpenId(c.item_categ_id)}
                      className="group flex w-32 flex-col items-center gap-3 sm:w-44"
                    >
                      {imageFor(c.item_categ_id) ? (
                        // photos have a white background, multiply blends it into the checker pattern
                        <img
                          src={imageFor(c.item_categ_id)!}
                          alt=""
                          className="h-28 w-full object-contain mix-blend-multiply transition-transform group-hover:-translate-y-1 sm:h-36"
                        />
                      ) : (
                        <span className="grid h-28 w-full place-items-center transition-transform group-hover:-translate-y-1 sm:h-36">
                          {iconFor(c.item_category, 'size-20 sm:size-24')}
                        </span>
                      )}
                      <span className="font-display text-lg text-forest group-hover:underline sm:text-xl">{c.item_category.toLowerCase()}</span>
                    </button>
                  ) : (
                    <div key={i} className="flex w-32 flex-col items-center gap-3 sm:w-44">
                      <div className="h-28 w-full skeleton rounded-xl sm:h-36" />
                      <div className="h-5 w-24 skeleton rounded" />
                    </div>
                  ),
                )}
              </div>
            ))}
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
