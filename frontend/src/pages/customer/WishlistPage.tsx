import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import PriceTag from '@/components/ui/PriceTag';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { firstImage } from '@/lib/images';
import { isBuyable, stockLabel, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { WishlistLine } from '@/types/models';

function LikeRow({ item, index }: { item: WishlistLine; index: number }) {
  const { addItem } = useCart();
  const { remove } = useWishlist();
  const [busy, setBusy] = useState(false);
  const { variant } = item;
  const stock = stockLabel(variant);
  const link = `/products/${variant.product_id}?variant=${variant.prod_var_id}`;

  const moveToCart = async () => {
    setBusy(true);
    if (await addItem(variant, 1)) await remove(item.wishlist_item_id);
    setBusy(false);
  };

  return (
    <li className="flex gap-4 rounded-card bg-white p-3 shadow-card sm:items-center sm:p-4">
      <Link to={link} className={cn('size-24 shrink-0 overflow-hidden rounded-xl sm:size-28', tileColor(index))}>
        <img src={firstImage(variant.images)} alt={variant.prod_var_name} className="size-full object-contain p-2" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Link to={link} className="font-medium text-ink hover:text-forest">
            {variant.product.product_name}
          </Link>
          <p className="text-sm text-muted">{variant.prod_attr}</p>
          <PriceTag variant={variant} size="sm" />
          <p className={cn('text-xs', stock.tone === 'out' ? 'text-coral-dark' : stock.tone === 'low' ? 'text-pending-text' : 'text-muted')}>
            {stock.text}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={moveToCart} disabled={!isBuyable(variant)} loading={busy}>
            <ShoppingCart className="size-4" /> Move to cart
          </Button>
          <Button size="sm" variant="ghost" onClick={() => remove(item.wishlist_item_id)} aria-label="Remove from Likes">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, error, reload } = useWishlist();

  let content;
  if (authLoading || (user && loading)) {
    content = <LoadingState />;
  } else if (!user) {
    content = (
      <EmptyState
        icon={<Heart className="size-7" />}
        title="Log in to see your Likes"
        message="Save the pieces you love and come back to them anytime."
        action={
          <ButtonLink to="/login" state={{ from: '/wishlist' }}>
            Log in
          </ButtonLink>
        }
      />
    );
  } else if (error) {
    content = <ErrorState message={error} onRetry={reload} />;
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={<Heart className="size-7" />}
        title="No likes yet"
        message="Tap the heart on any product to save it here."
        action={<ButtonLink to="/products">Browse products</ButtonLink>}
      />
    );
  } else {
    content = (
      <ul className="space-y-3">
        {items.map((item, i) => (
          <LikeRow key={item.wishlist_item_id} item={item} index={i} />
        ))}
      </ul>
    );
  }

  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <h1 className="mb-6 text-3xl font-semibold text-forest sm:text-4xl">
        Likes {user && items.length > 0 && <span className="text-xl text-muted">({items.length})</span>}
      </h1>
      {content}
    </div>
  );
}
