import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Heart, ShoppingCart, X, ZoomIn } from 'lucide-react';
import Button from '@/components/ui/Button';
import MoreProducts from '@/components/ui/MoreProducts';
import PriceTag from '@/components/ui/PriceTag';
import QuantityStepper from '@/components/ui/QuantityStepper';
import { ErrorState, LoadingState } from '@/components/ui/States';
import ProductReviews from '@/features/reviews/components/ProductReviews';
import { useAsync } from '@/hooks/useAsync';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { productService } from '@/services/productService';
import { parseImages, PLACEHOLDER_IMG } from '@/lib/images';
import { getEffectivePrice } from '@/lib/pricing';
import { formatDate } from '@/lib/dates';
import { displayVariant, isBuyable, stockLabel } from '@/lib/product';
import { cn } from '@/lib/cn';
import NotFound from '../NotFound';

const THUMBS_SHOWN = 4; // more than this and the row gets left and right buttons

function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [first, setFirst] = useState(0); // the first photo showing in the row
  const list = images.length ? images : [PLACEHOLDER_IMG];
  const src = list[active] ?? list[0];
  const lastFirst = Math.max(0, list.length - THUMBS_SHOWN);
  const peek = lastFirst > 0 ? '1.5rem' : '0rem'; // how much of the next photo shows, so it's clear there are more
  const arrow = 'grid size-9 shrink-0 place-items-center rounded-full border border-forest/30 bg-white text-forest transition-colors hover:bg-mint-light disabled:border-line disabled:text-line disabled:hover:bg-white';

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoomed(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoomed]);

  // left and right arrow keys go through the photos, unless someone is typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement;
      if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      const next = active + (e.key === 'ArrowRight' ? 1 : -1);
      if (next < 0 || next >= list.length) return;
      e.preventDefault();
      setActive(next);
      // the row follows, so the photo stays in view
      setFirst((f) => (next < f ? next : next >= f + THUMBS_SHOWN ? next - THUMBS_SHOWN + 1 : f));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, list.length]);

  // swiping the row on a phone
  const swipeStart = useRef<number | null>(null);
  const onSwipeEnd = (x: number) => {
    if (swipeStart.current === null) return;
    const moved = x - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(moved) < 30) return;
    setFirst((f) => Math.min(lastFirst, Math.max(0, f + (moved < 0 ? 1 : -1))));
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink/15 bg-white">
        <img src={src} alt={alt} className="size-full object-contain p-6" />
        <button
          onClick={() => setZoomed(true)}
          aria-label="Zoom image"
          className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-white/90 text-forest shadow-card hover:bg-mint-light"
        >
          <ZoomIn className="size-5" />
        </button>
      </div>
      {list.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            {lastFirst > 0 && (
              <button type="button" onClick={() => setFirst((f) => f - 1)} disabled={first === 0} aria-label="Previous photos" className={arrow}>
                <ChevronLeft className="size-5" />
              </button>
            )}
            {/* the small padding leaves room for the focus ring */}
            <div
              className="min-w-0 flex-1 touch-pan-y overflow-hidden p-1 [--gap:0.5rem] sm:[--gap:0.75rem]"
              onTouchStart={(e) => {
                swipeStart.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => onSwipeEnd(e.changedTouches[0].clientX)}
            >
              <div
                className="flex gap-[var(--gap)] transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(calc(${-first} * (100% - ${peek}) / ${THUMBS_SHOWN}${first === lastFirst && lastFirst > 0 ? ` + ${peek} + var(--gap)` : ''}))` }}
              >
                {list.map((img, i) => {
                  const inView = i >= first && i < first + THUMBS_SHOWN;
                  return (
                    <button
                      key={img}
                      onClick={() => setActive(i)}
                      tabIndex={inView ? undefined : -1}
                      aria-hidden={inView ? undefined : true}
                      aria-label={`Image ${i + 1}`}
                      aria-current={i === active}
                      style={{ flex: `0 0 calc((100% - ${lastFirst > 0 ? THUMBS_SHOWN : THUMBS_SHOWN - 1} * var(--gap) - ${peek}) / ${THUMBS_SHOWN})` }}
                      className={cn(
                        'aspect-square min-w-0 overflow-hidden rounded-xl border-2 bg-white transition-colors',
                        i === active ? 'border-forest' : 'border-ink/15 hover:border-mint',
                      )}
                    >
                      <img src={img} alt="" className="size-full object-contain p-1.5" />
                    </button>
                  );
                })}
              </div>
            </div>
            {lastFirst > 0 && (
              <button type="button" onClick={() => setFirst((f) => f + 1)} disabled={first === lastFirst} aria-label="Next photos" className={arrow}>
                <ChevronRight className="size-5" />
              </button>
            )}
          </div>
          {lastFirst > 0 && (
            <div className="flex items-center gap-3 px-11">
              <div data-testid="photo-slider" aria-hidden className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className="absolute inset-y-0 rounded-full bg-forest transition-[left] duration-300 ease-out motion-reduce:transition-none"
                  style={{ left: `${(first / list.length) * 100}%`, width: `${(THUMBS_SHOWN / list.length) * 100}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted">
                {active + 1} / {list.length}
              </span>
            </div>
          )}
        </div>
      )}

      {zoomed && (
        <div role="dialog" aria-label={alt} className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4" onClick={() => setZoomed(false)}>
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-2xl bg-white object-contain p-4" />
          <button onClick={() => setZoomed(false)} aria-label="Close" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white text-ink">
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProductDetailsPage() {
  const productId = Number(useParams().productId);
  const [params, setParams] = useSearchParams();
  const { data: product, loading, error, reload } = useAsync(() => productService.getById(productId), [productId]);
  const { addItem, lines } = useCart();
  const wishlist = useWishlist();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const variantParam = Number(params.get('variant'));
  const variants = product?.variants.filter((v) => v.is_avail) ?? [];
  const variant = variants.find((v) => v.prod_var_id === variantParam) ?? (product ? displayVariant({ ...product, variants }) : undefined);

  useEffect(() => setQuantity(1), [variant?.prod_var_id]);
  useEffect(() => setShowAll(false), [productId]);

  if (!Number.isInteger(productId)) return <NotFound />;
  if (loading) return <div className="container-page py-8"><LoadingState label="Loading product..." layout="detail" /></div>;
  if (error) {
    return error.toLowerCase().includes('not found') ? <NotFound /> : <ErrorState message={error} onRetry={reload} />;
  }
  if (!product || !variant) return <NotFound />;

  const stock = stockLabel(variant);
  const buyable = isBuyable(variant);
  const inCart = lines.find((l) => l.prod_var_id === variant.prod_var_id)?.quantity ?? 0;
  const canAdd = Math.max(0, variant.stocks - inCart);
  const promo = getEffectivePrice(variant);
  const liked = wishlist.has(variant.prod_var_id);

  const selectVariant = (id: number) => setParams({ variant: String(id) }, { replace: true });

  const handleAdd = async () => {
    setAdding(true);
    await addItem(variant, quantity);
    setAdding(false);
  };

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        <Gallery key={variant.prod_var_id} images={parseImages(variant.images)} alt={variant.prod_var_name} />

        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link to={`/products?category=${product.item_categ_id}`} className="text-sm text-muted hover:text-forest">
                {product.category.item_category}
              </Link>
              <h1 className="mt-1 text-3xl font-semibold text-forest sm:text-4xl">{product.product_name}</h1>
            </div>
            <button
              onClick={() => wishlist.toggle(variant.prod_var_id)}
              aria-pressed={liked}
              aria-label={liked ? 'Remove from wishlist' : 'Save to wishlist'}
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full border transition-colors',
                liked ? 'border-coral-dark bg-coral/20 text-coral-dark' : 'border-forest/30 bg-mint-light text-forest hover:border-forest',
              )}
            >
              <Heart className="size-5" fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="mt-3">
            <PriceTag variant={variant} size="lg" />
            {promo.onPromo && variant.pr_end && (
              <p className="mt-1 text-xs font-medium text-coral-dark">Sale price until {formatDate(variant.pr_end)}</p>
            )}
          </div>

          <div className="mt-6">
            <h2 className="font-sans text-base font-semibold text-ink">Description</h2>
            <p className={cn('mt-1 whitespace-pre-line text-sm leading-relaxed text-ink', !showAll && 'line-clamp-4')}>{product.prod_desc}</p>
            {(product.prod_desc?.length ?? 0) > 220 && (
              <button onClick={() => setShowAll((v) => !v)} className="mt-1 text-sm font-medium text-forest hover:underline">
                {showAll ? 'see less' : 'see more'}
              </button>
            )}
          </div>

          <div className="mt-6">
            <h2 className="mb-2 font-sans text-base font-semibold text-ink">Variant</h2>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.prod_var_id}
                  onClick={() => selectVariant(v.prod_var_id)}
                  aria-pressed={v.prod_var_id === variant.prod_var_id}
                  className={cn(
                    'rounded-full border px-5 py-1.5 text-sm transition-colors',
                    v.prod_var_id === variant.prod_var_id ? 'border-forest bg-mint font-medium text-forest' : 'border-ink/30 bg-white hover:border-forest',
                    !isBuyable(v) && 'text-muted line-through decoration-1',
                  )}
                >
                  {v.prod_attr?.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <p className={cn('mt-5 flex items-center gap-1.5 text-sm font-medium', stock.tone === 'ok' ? 'text-forest' : 'text-coral-dark')}>
            {stock.tone !== 'ok' && <AlertCircle className="size-4" />}
            {stock.tone === 'low' ? `Only ${variant.stocks} left in stock` : stock.text}
            {inCart > 0 && <span className="font-normal text-muted"> · {inCart} in your cart</span>}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} max={Math.max(1, canAdd)} onChange={setQuantity} disabled={!buyable || canAdd === 0} />
            <Button size="lg" className="flex-1 sm:flex-none sm:px-10" onClick={handleAdd} disabled={!buyable || canAdd === 0} loading={adding}>
              <ShoppingCart className="size-4" />
              {buyable ? 'Add to Cart' : 'Out of stock'}
            </Button>
            {buyable && (
              <Button size="lg" variant="secondary" className="flex-1 sm:flex-none sm:px-10" onClick={() => navigate(`/checkout?buy=${variant.prod_var_id}&qty=${quantity}`)}>
                Buy Now
              </Button>
            )}
          </div>
          {buyable && canAdd === 0 && <p className="mt-2 text-xs text-muted">You already have all available stock in your cart.</p>}
          <p className="mt-4 text-xs text-muted">SKU: {variant.sku}</p>
        </div>
      </div>

      <div className="mt-12">
        <ProductReviews productId={product.product_id} />
      </div>

      <MoreProducts title="more like this" categoryId={product.item_categ_id} excludeIds={[product.product_id]} />
    </div>
  );
}
