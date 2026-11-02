import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, ShoppingCart, Trash2 } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import MoreProducts from '@/components/ui/MoreProducts';
import PriceTag from '@/components/ui/PriceTag';
import QuantityStepper from '@/components/ui/QuantityStepper';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { itemCount, linesTotal, saveCheckoutIds } from '@/lib/checkout';
import { firstImage } from '@/lib/images';
import { formatPeso } from '@/lib/pricing';
import { isBuyable, stockLabel, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { CartLine } from '@/types/models';

const checkbox = 'size-4 shrink-0 rounded accent-forest';

function CartRow({ line, index, checked, onCheck }: { line: CartLine; index: number; checked: boolean; onCheck: (on: boolean) => void }) {
  const { updateQuantity, removeItem } = useCart();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const navigate = useNavigate();
  const { variant } = line;
  const link = `/products/${variant.product_id}?variant=${variant.prod_var_id}`;
  const buyable = isBuyable(variant);
  const liked = wishlist.has(variant.prod_var_id);
  const stock = stockLabel(variant);

  return (
    <li className="flex items-center gap-3 border-b border-line py-4 last:border-0 sm:gap-4">
      <input type="checkbox" className={checkbox} checked={checked} disabled={!buyable} onChange={(e) => onCheck(e.target.checked)} aria-label={`Select ${variant.prod_var_name}`} />
      <Link to={link} className={cn('size-20 shrink-0 overflow-hidden rounded-xl border border-ink/15 sm:size-24', tileColor(index))}>
        <img src={firstImage(variant.images)} alt="" className="size-full object-contain p-2" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={link} className="line-clamp-2 font-medium text-ink hover:text-forest">
          {variant.product.product_name}
        </Link>
        <p className="text-xs text-muted">{variant.prod_attr}</p>
        <PriceTag variant={variant} size="sm" />
        {stock.tone !== 'ok' && <p className={cn('text-xs', stock.tone === 'out' ? 'text-coral-dark' : 'text-pending-text')}>{stock.text}</p>}
      </div>
      <div className="flex flex-col items-end gap-2">
        <QuantityStepper size="sm" value={line.quantity} max={Math.max(1, variant.stocks)} onChange={(q) => updateQuantity(line, q)} disabled={!buyable} />
        <div className="flex gap-1">
          <button
            onClick={() => (user ? wishlist.toggle(variant.prod_var_id) : navigate('/login', { state: { from: '/cart' } }))}
            aria-label={liked ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-pressed={liked}
            className={cn('rounded-full p-1.5 hover:bg-mint-light', liked ? 'text-coral-dark' : 'text-forest')}
          >
            <Heart className="size-4" fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => removeItem(line)} aria-label={`Remove ${variant.prod_var_name}`} className="rounded-full p-1.5 text-forest hover:bg-cancelled hover:text-coral-dark">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function CartPage() {
  const { lines, loading, error, reload, removeItem } = useCart();
  const navigate = useNavigate();

  // everything that can be bought starts ticked; items added later get ticked too
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());
  const buyable = useMemo(() => lines.filter((l) => isBuyable(l.variant)), [lines]);
  const selected = buyable.filter((l) => !unchecked.has(l.prod_var_id));
  const allChecked = buyable.length > 0 && selected.length === buyable.length;

  useEffect(() => {
    // forget removed items
    setUnchecked((s) => new Set([...s].filter((id) => lines.some((l) => l.prod_var_id === id))));
  }, [lines]);

  const setChecked = (id: number, on: boolean) =>
    setUnchecked((s) => {
      const next = new Set(s);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteSelected = async () => {
    for (const line of selected) await removeItem(line);
  };

  const checkout = () => {
    saveCheckoutIds(selected.map((l) => l.prod_var_id));
    navigate('/checkout');
  };

  let content;
  if (loading) content = <LoadingState label="Loading your cart..." layout="list" />;
  else if (error) content = <ErrorState message={error} onRetry={reload} />;
  else if (lines.length === 0) {
    content = (
      <EmptyState
        icon={<ShoppingCart className="size-7" />}
        title="Your cart is empty"
        message="Find something you love and add it here."
        action={<ButtonLink to="/products">Browse products</ButtonLink>}
      />
    );
  } else {
    content = (
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-3 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-ink">
              <input
                type="checkbox"
                className={checkbox}
                checked={allChecked}
                onChange={(e) => setUnchecked(e.target.checked ? new Set() : new Set(buyable.map((l) => l.prod_var_id)))}
              />
              Select all ({buyable.length} {buyable.length === 1 ? 'item' : 'items'})
            </label>
            <button onClick={deleteSelected} disabled={selected.length === 0} className="flex items-center gap-1 text-ink hover:text-coral-dark disabled:opacity-40">
              <Trash2 className="size-4" /> Delete
            </button>
          </div>
          <div className="hidden grid-cols-[2rem_6rem_1fr_auto] gap-4 rounded-full border border-forest/30 bg-mint px-5 py-2 text-sm font-semibold text-forest sm:grid">
            <span />
            <span className="text-center">Image</span>
            <span>Product</span>
            <span className="pr-4">Quantity</span>
          </div>
          <ul>
            {lines.map((line, i) => (
              <CartRow key={line.cart_item_id} line={line} index={i} checked={!unchecked.has(line.prod_var_id) && isBuyable(line.variant)} onCheck={(on) => setChecked(line.prod_var_id, on)} />
            ))}
          </ul>
        </div>

        <aside className="rounded-card border border-forest/30 bg-mint-light p-5 lg:sticky lg:top-36">
          <h2 className="font-sans text-base font-semibold text-ink">Order Summary</h2>
          <div className="mt-4 flex justify-between border-t border-forest/20 pt-4 text-sm">
            <span>
              Subtotal ({itemCount(selected)} {itemCount(selected) === 1 ? 'item' : 'items'})
            </span>
            <span className="font-semibold">{formatPeso(linesTotal(selected))}</span>
          </div>
          <p className="mt-3 text-xs italic text-muted">* Shipping, pickup options, and courier fees will be calculated at checkout.</p>
          <Button size="lg" className="mt-5 w-full" onClick={checkout} disabled={selected.length === 0}>
            Proceed to Checkout
          </Button>
        </aside>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-10">
      <Link to="/products" className="inline-flex items-center gap-1 text-sm text-muted hover:text-forest">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-semibold text-forest sm:text-4xl">My Cart</h1>
      {content}
      <MoreProducts title="you may also like" excludeIds={lines.map((l) => l.variant.product_id)} />
    </div>
  );
}
