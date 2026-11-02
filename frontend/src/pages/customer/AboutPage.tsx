import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { firstImage, parseImages } from '@/lib/images';
import { displayVariant } from '@/lib/product';
import type { ProductWithVariants } from '@/types/models';

const photo = (p?: ProductWithVariants) => (p ? firstImage(displayVariant(p)?.images) : '/images/placeholder.svg');

// image: the cut-out picture in public/images/about/, fallback: a product photo used until that file is added
function Story({ title, image, fallback, flip, children }: { title: string; image: string; fallback: string; flip?: boolean; children: ReactNode }) {
  const [missing, setMissing] = useState(false);
  return (
    <div className="grid items-center gap-6 sm:grid-cols-2 sm:gap-12">
      <img
        src={missing ? fallback : image}
        alt=""
        onError={() => setMissing(true)}
        // product photos have a white background, multiply blends it into the butter
        className={`mx-auto h-56 w-full object-contain sm:h-72 ${missing ? 'mix-blend-multiply' : ''} ${flip ? '' : 'sm:order-2'}`}
      />
      <div>
        <h2 className="text-2xl font-semibold leading-tight text-forest sm:text-[1.7rem]">{title}</h2>
        <p className="mt-3 text-justify text-sm leading-relaxed text-ink sm:text-base">{children}</p>
      </div>
    </div>
  );
}

// one floor of the building: a row of windows with product photos
function Floor({ products }: { products: ProductWithVariants[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
      {products.map((p) => (
        <Link key={p.product_id} to={`/products/${p.product_id}`} title={p.product_name} className="group">
          <div className="aspect-square overflow-hidden rounded-md border-[6px] border-white bg-butter-light p-2 shadow-[inset_0_0_0_2px_rgb(29_77_64/0.25)]">
            <img src={photo(p)} alt={p.product_name} className="size-full object-contain transition-transform group-hover:scale-105" />
          </div>
          <div className="-mx-1 h-2 rounded-sm bg-forest-light/60" />
        </Link>
      ))}
    </div>
  );
}

export default function AboutPage() {
  const products = useAsync(() => productService.getAll({ sort: 'newest' }), []);
  // products that have a photo, one per category first so the windows look varied
  const withPhoto = (products.data ?? []).filter((p) => parseImages(displayVariant(p)?.images).length > 0);
  const firstOfEach = withPhoto.filter((p, i) => withPhoto.findIndex((x) => x.item_categ_id === p.item_categ_id) === i);
  const windows = [...firstOfEach, ...withPhoto.filter((p) => !firstOfEach.includes(p))].slice(0, 8);
  // story pictures until the plant/sofa files are added: dark wood pieces, since white or beige ones blend into the butter background
  const dark = withPhoto.filter((p) => /brown|black/i.test(displayVariant(p)?.prod_attr ?? ''));
  const storyPhoto = (productId: number, n: number) => photo(withPhoto.find((p) => p.product_id === productId) ?? dark[n]);

  return (
    <>
      <section className="relative overflow-hidden bg-butter pb-16 pt-14 sm:pb-24">
        {/* soft light swoosh behind the stories */}
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden>
          <path
            d="M-50 330 C 150 180, 260 420, 330 560 S 470 760, 560 610 S 760 300, 1050 520"
            fill="none"
            stroke="var(--color-butter-light)"
            strokeWidth="120"
            strokeLinecap="round"
          />
        </svg>

        <div className="container-page relative max-w-4xl">
          <div className="text-center">
            <h1 className="text-5xl font-semibold text-forest sm:text-7xl">
              about comfy<span className="text-bark">&amp;</span>co
            </h1>
            <p className="mt-2 text-sm font-medium text-amber sm:text-base">"Making every corner feel like home"</p>
          </div>

          <div className="mt-10 space-y-12 sm:space-y-8">
            <Story title="Born in Manila, made for real living spaces" image="/images/about/plant.png" fallback={storyPhoto(24, 0)}>
              Comfy &amp; Co. started in Manila to solve a problem of finding furniture that has personality, fits through standard doors,
              and does not require a massive budget. We aim to go against offering cold, plain boards or vintage tables that crowded small
              rooms. We want to combine warm, curved shapes with practical, space-smart designs.
            </Story>
            <Story
              title="Proportioned for condos, renters, and first-time setups"
              image="/images/about/sofa.png"
              fallback={storyPhoto(16, 1)}
              flip
            >
              We design our products around renters, hybrid workers, and first-time movers who want their home to feel warm without
              feeling cluttered. Every item lists exact dimensions so there are no delivery-day surprises at the doorway.
            </Story>
          </div>
        </div>
      </section>

      <section className="relative">
        {/* cream sky on top, striped green ground under the building */}
        <div className="stripes-forest absolute inset-x-0 bottom-0 top-[55%]" />

        <div className="container-page relative max-w-3xl pb-16">
          {/* roof */}
          <div className="mx-auto w-[94%] bg-coral px-6 pb-6 pt-8 text-center text-white [clip-path:polygon(5%_0,95%_0,100%_100%,0_100%)]">
            <h2 className="text-4xl font-semibold sm:text-5xl">what we offer</h2>
            <p className="mt-1 text-sm text-white/90">Built for every room in your home or studio</p>
          </div>
          <div className="h-3 bg-coral-dark/70" />

          {/* front of the building */}
          <div className="border-x-[10px] border-mint-light bg-mint px-5 pb-0 pt-8 sm:px-10">
            {products.loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="aspect-square skeleton rounded-md border-[6px] border-white" />
                ))}
              </div>
            ) : (
              <>
                <Floor products={windows.slice(0, 4)} />
                <p className="my-6 text-center font-display text-sm italic text-forest">ranging from living room sofas and dining sets...</p>
                {windows.length > 4 && <Floor products={windows.slice(4, 8)} />}
                <p className="my-6 text-center font-display text-sm italic text-forest">...to storage that keeps every corner of your home tidy</p>
              </>
            )}

            {/* door */}
            <div className="mx-auto grid h-36 w-28 grid-cols-2 gap-1.5 rounded-t-lg border-[6px] border-forest-light bg-forest p-2 sm:h-44 sm:w-32">
              <div className="rounded-sm bg-mint/30" />
              <div className="rounded-sm bg-mint/30" />
              <div className="col-span-2 flex items-center justify-end pr-1">
                <span className="size-2 rounded-full bg-butter" />
              </div>
            </div>
          </div>

          <div className="relative mx-auto mt-14 max-w-md rounded-card bg-white p-8 text-center shadow-card">
            <h2 className="text-3xl font-semibold text-forest">Ready to shape your space?</h2>
            <p className="mt-2 text-sm text-muted">Explore our full collection of warm tones, compact seating, and practical storage pieces.</p>
            <ButtonLink to="/products" className="mt-5 px-8">
              View Categories
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
