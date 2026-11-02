import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { firstImage } from '@/lib/images';
import { displayVariant, isBuyable, onPromo, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { ProductWithVariants } from '@/types/models';
import PriceTag from './PriceTag';

// row: the list view on the products page, photo on the left and the description next to it
export default function ProductCard({ product, index = 0, row }: { product: ProductWithVariants; index?: number; row?: boolean }) {
  const { addItem } = useCart();
  const variant = displayVariant(product);
  if (!variant) return null;

  const buyable = isBuyable(variant);
  const link = `/products/${product.product_id}?variant=${variant.prod_var_id}`;

  return (
    <div
      className={cn(
        'group relative flex overflow-hidden rounded-card bg-white shadow-card transition-shadow hover:shadow-lg',
        row ? 'flex-row' : 'flex-col',
      )}
    >
      <Link
        to={link}
        className={cn('relative block shrink-0 overflow-hidden', row ? 'aspect-square w-32 sm:w-44' : 'aspect-[4/3]', tileColor(index))}
      >
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
      <div className={cn('flex flex-1 gap-2 p-3', row ? 'items-center sm:p-4' : 'items-end')}>
        <Link to={link} className="min-w-0 flex-1">
          <h3 className={cn('font-sans text-sm font-medium text-ink', row ? 'line-clamp-2 sm:text-base' : 'truncate')} title={product.product_name}>
            {product.product_name}
          </h3>
          {row && (
            <p className="mt-1 hidden text-xs text-muted sm:line-clamp-2">
              {variant.prod_attr} · {product.category.item_category}
            </p>
          )}
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
      <div className="aspect-[4/3] skeleton" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 skeleton rounded" />
        <div className="h-4 w-1/3 skeleton rounded" />
      </div>
    </div>
  );
}
