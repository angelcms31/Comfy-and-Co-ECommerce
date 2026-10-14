import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { firstImage } from '@/lib/images';
import { displayVariant, isBuyable, onPromo, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { ProductWithVariants } from '@/types/models';
import PriceTag from './PriceTag';

export default function ProductCard({ product, index = 0 }: { product: ProductWithVariants; index?: number }) {
  const { addItem } = useCart();
  const variant = displayVariant(product);
  if (!variant) return null;

  const buyable = isBuyable(variant);
  const link = `/products/${product.product_id}?variant=${variant.prod_var_id}`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-card bg-white shadow-card transition-shadow hover:shadow-lg">
      <Link to={link} className={cn('relative block aspect-[4/3] overflow-hidden', tileColor(index))}>
        <img
          src={firstImage(variant.images)}
          alt={product.product_name}
          loading="lazy"
          className="size-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
        />
        {onPromo(product) && (
          <span className="absolute left-2 top-2 rounded-full bg-coral-dark px-2 py-0.5 text-[11px] font-semibold text-white">Sale</span>
        )}
        {!buyable && (
          <span className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-semibold text-white">Out of stock</span>
        )}
      </Link>
      <div className="flex flex-1 items-end gap-2 p-3">
        <Link to={link} className="min-w-0 flex-1">
          <h3 className="truncate font-sans text-sm font-medium text-ink" title={product.product_name}>
            {product.product_name}
          </h3>
          <PriceTag variant={variant} size="md" />
        </Link>
        <button
          onClick={() => addItem(variant, 1)}
          disabled={!buyable}
          aria-label={`Add ${product.product_name} to cart`}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-forest-light disabled:bg-line disabled:text-muted"
        >
          <ShoppingCart className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-white shadow-card">
      <div className="aspect-[4/3] animate-pulse bg-line/60" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-line/60" />
      </div>
    </div>
  );
}
