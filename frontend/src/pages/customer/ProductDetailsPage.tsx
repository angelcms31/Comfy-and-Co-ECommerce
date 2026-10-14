import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Heart, ShoppingCart } from 'lucide-react';
import Button from '@/components/ui/Button';
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

function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [PLACEHOLDER_IMG];

  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-3xl bg-mint-light">
        <img src={list[active] ?? list[0]} alt={alt} className="size-full object-contain p-6" />
      </div>
      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Image ${i + 1}`}
              aria-current={i === active}
              className={cn(
                'size-20 shrink-0 overflow-hidden rounded-xl border-2 bg-mint-light transition-colors',
                i === active ? 'border-forest' : 'border-transparent hover:border-mint',
              )}
            >
              <img src={src} alt="" className="size-full object-contain p-1.5" />
            </button>
          ))}
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

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const variantParam = Number(params.get('variant'));
  const variants = product?.variants.filter((v) => v.is_avail) ?? [];
  const variant = variants.find((v) => v.prod_var_id === variantParam) ?? (product ? displayVariant({ ...product, variants }) : undefined);

  useEffect(() => setQuantity(1), [variant?.prod_var_id]);

  if (!Number.isInteger(productId)) return <NotFound />;
  if (loading) return <LoadingState label="Loading product..." />;
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
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to="/" className="hover:text-forest">Home</Link>
        <ChevronRight className="size-3.5" />
        <Link to={`/products?category=${product.item_categ_id}`} className="hover:text-forest">
          {product.category.item_category}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-ink">{product.product_name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        <Gallery key={variant.prod_var_id} images={parseImages(variant.images)} alt={variant.prod_var_name} />

        <div className="flex flex-col">
          <p className="text-sm text-muted">{product.category.item_category}</p>
          <h1 className="mt-1 text-3xl font-semibold text-forest sm:text-4xl">{product.product_name}</h1>
          <p className="mt-1 text-xs text-muted">SKU: {variant.sku}</p>

          <div className="mt-4">
            <PriceTag variant={variant} size="lg" />
            {promo.onPromo && variant.pr_end && (
              <p className="mt-1 text-xs font-medium text-coral-dark">Sale price until {formatDate(variant.pr_end)}</p>
            )}
          </div>

          {variants.length > 1 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">
                Variant: <span className="font-normal text-muted">{variant.prod_attr}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.prod_var_id}
                    onClick={() => selectVariant(v.prod_var_id)}
                    aria-pressed={v.prod_var_id === variant.prod_var_id}
                    className={cn(
                      'rounded-full border px-4 py-1.5 text-sm transition-colors',
                      v.prod_var_id === variant.prod_var_id ? 'border-forest bg-forest text-white' : 'border-line bg-white hover:border-forest',
                      !isBuyable(v) && 'text-muted line-through decoration-1',
                    )}
                  >
                    {v.prod_attr}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p
            className={cn(
              'mt-6 text-sm font-medium',
              stock.tone === 'out' && 'text-coral-dark',
              stock.tone === 'low' && 'text-pending-text',
              stock.tone === 'ok' && 'text-forest',
            )}
          >
            {stock.text}
            {inCart > 0 && <span className="font-normal text-muted"> · {inCart} in your cart</span>}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} max={Math.max(1, canAdd)} onChange={setQuantity} disabled={!buyable || canAdd === 0} />
            <Button size="lg" className="flex-1 sm:flex-none sm:px-10" onClick={handleAdd} disabled={!buyable || canAdd === 0} loading={adding}>
              <ShoppingCart className="size-4" />
              {buyable ? 'Add to Cart' : 'Out of stock'}
            </Button>
            <button
              onClick={() => wishlist.toggle(variant.prod_var_id)}
              aria-pressed={liked}
              aria-label={liked ? 'Remove from Likes' : 'Save to Likes'}
              className={cn(
                'grid size-12 place-items-center rounded-full border transition-colors',
                liked ? 'border-coral-dark bg-coral/20 text-coral-dark' : 'border-line bg-white text-forest hover:border-forest',
              )}
            >
              <Heart className="size-5" fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>
          {buyable && canAdd === 0 && <p className="mt-2 text-xs text-muted">You already have all available stock in your cart.</p>}

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-muted">Description</h2>
            <p className="mt-2 leading-relaxed text-ink">{product.prod_desc}</p>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <ProductReviews productId={product.product_id} />
      </div>
    </div>
  );
}
