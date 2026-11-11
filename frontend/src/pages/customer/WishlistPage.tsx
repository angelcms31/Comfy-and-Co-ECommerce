import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import PriceTag from '@/components/ui/PriceTag';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { firstImage } from '@/lib/images';
import { isBuyable, stockLabel, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { WishlistLine } from '@/types/models';

const checkbox = 'size-4 shrink-0 rounded accent-forest';

function LikeRow({ item, index, checked, onCheck }: { item: WishlistLine; index: number; checked: boolean; onCheck: (on: boolean) => void }) {
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
    <li className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card sm:gap-4 sm:p-4">
      <input
        type="checkbox"
        className={checkbox}
        checked={checked}
        disabled={!isBuyable(variant)}
        onChange={(e) => onCheck(e.target.checked)}
        aria-label={`Select ${variant.prod_var_name}`}
      />
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
  const { items, loading, error, reload, remove } = useWishlist();
  const { addItem } = useCart();
  const toast = useToast();
  const [picked, setPicked] = useState<Set<number>>(new Set()); // prod_var_ids
  const [moving, setMoving] = useState(false);

  // only items that can be bought can be picked; anything no longer liked drops out of the selection
  const buyable = useMemo(() => items.filter((i) => isBuyable(i.variant)), [items]);
  const selected = buyable.filter((i) => picked.has(i.prod_var_id));
  const allPicked = buyable.length > 0 && selected.length === buyable.length;

  const check = (prodVarId: number, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(prodVarId);
      else next.delete(prodVarId);
      return next;
    });

  // one of each picked item goes to the cart, then leaves the Likes. Stops if a guest closes the sign in prompt
  const moveSelected = async () => {
    setMoving(true);
    let moved = 0;
    for (const item of selected) {
      if (!(await addItem(item.variant, 1))) break;
      await remove(item.wishlist_item_id);
      moved += 1;
    }
    setMoving(false);
    setPicked(new Set());
    if (moved) toast.success(`${moved} ${moved === 1 ? 'item' : 'items'} moved to your cart`);
  };

  let content;
  if (authLoading || loading) {
    content = <LoadingState layout="list" />;
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
      <>
        <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-ink">
            <input
              type="checkbox"
              className={checkbox}
              checked={allPicked}
              disabled={buyable.length === 0}
              onChange={(e) => setPicked(e.target.checked ? new Set(buyable.map((i) => i.prod_var_id)) : new Set())}
            />
            Select all ({buyable.length} {buyable.length === 1 ? 'item' : 'items'})
          </label>
          {selected.length > 0 && (
            <Button size="sm" onClick={moveSelected} loading={moving}>
              <ShoppingCart className="size-4" /> Move to cart ({selected.length})
            </Button>
          )}
        </div>
        <ul className="space-y-3">
          {items.map((item, i) => (
            <LikeRow key={item.wishlist_item_id} item={item} index={i} checked={picked.has(item.prod_var_id)} onCheck={(on) => check(item.prod_var_id, on)} />
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <h1 className="mb-6 text-3xl font-semibold text-forest sm:text-4xl">
        Likes {items.length > 0 && <span className="text-xl text-muted">({items.length})</span>}
      </h1>
      {/* a guest's Likes live in this browser only until they sign in */}
      {!authLoading && !user && items.length > 0 && (
        <p className="mb-4 rounded-xl bg-cream px-4 py-3 text-sm text-ink">
          These Likes are saved in this browser only.{' '}
          <Link to="/login" state={{ from: '/wishlist' }} className="font-medium text-forest underline-offset-2 hover:underline">
            Sign in
          </Link>{' '}
          to keep them on your account.
        </p>
      )}
      {content}
    </div>
  );
}
