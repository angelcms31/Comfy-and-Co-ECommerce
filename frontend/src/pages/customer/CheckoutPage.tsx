import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Banknote, MapPin, Pencil, ShoppingBag, Smartphone, Store, Truck } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import PriceTag from '@/components/ui/PriceTag';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useAsync } from '@/hooks/useAsync';
import { orderService } from '@/services/orderService';
import { productService } from '@/services/productService';
import type { CartLine, DeliveryQuote, UserProfile, VariantWithProduct } from '@/types/models';
import { COURIER, DELIVERY_DAYS, STORE_ADDRESS } from '@/lib/constants';
import { itemCount, lineTotal, linesTotal, readCheckoutIds } from '@/lib/checkout';
import { addDays, toDay } from '@/lib/dates';
import { firstImage } from '@/lib/images';
import { formatPeso } from '@/lib/pricing';
import { isBuyable, tileColor } from '@/lib/product';
import { cn } from '@/lib/cn';
import type { PaymentMethod } from '@/types/db';
import type { Fulfillment } from '@/types/models';

// "Oct 13-15" (or "Oct 30-Nov 1")
function deliveryWindow() {
  const fmt = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T00:00:00`).toLocaleDateString('en-PH', opts);
  const from = addDays(toDay(), DELIVERY_DAYS[0]);
  const to = addDays(toDay(), DELIVERY_DAYS[1]);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return `${fmt(from, { month: 'short', day: 'numeric' })}-${fmt(to, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-sans text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Choice({ checked, onSelect, icon, label, note, name }: { checked: boolean; onSelect: () => void; icon: ReactNode; label: string; note?: string; name: string }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors',
        checked ? 'border-forest bg-mint-light' : 'border-line hover:border-forest/50',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="size-4 accent-forest" />
      <span className="text-forest">{icon}</span>
      <span className="font-medium text-ink">{label}</span>
      {note && <span className="text-xs italic text-muted">{note}</span>}
    </label>
  );
}

// the Lalamove quote for these items going to the saved address: asked again whenever the items or the address change
function useDeliveryQuote(enabled: boolean, lines: CartLine[], user: UserProfile) {
  const [state, setState] = useState<{ quote: DeliveryQuote | null; loading: boolean; error: string | null }>({ quote: null, loading: false, error: null });
  const key = lines.map((l) => `${l.prod_var_id}:${l.quantity}`).join(',');
  const { st_add, postal, city_id, lat, lng } = user;

  useEffect(() => {
    if (!enabled || !st_add || !city_id) {
      setState({ quote: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    orderService
      .quoteDelivery({ lines: lines.map((l) => ({ prod_var_id: l.prod_var_id, quantity: l.quantity })), st_add, postal, city_id, lat, lng })
      .then((quote) => !cancelled && setState({ quote, loading: false, error: null }))
      .catch((err: unknown) => !cancelled && setState({ quote: null, loading: false, error: err instanceof Error ? err.message : 'Could not get a delivery quote' }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, st_add, postal, city_id, lat, lng]);

  return state;
}

function CheckoutForm({ lines, user, buyVariant, buySearch }: { lines: CartLine[]; user: UserProfile; buyVariant?: VariantWithProduct; buySearch: string }) {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [payment, setPayment] = useState<PaymentMethod>('COD');
  const [placing, setPlacing] = useState(false);

  const hasAddress = !!(user.mobile_no && user.st_add && user.postal && user.city_id);
  const delivery = fulfillment === 'delivery';
  const { quote, loading: quoting, error: quoteError } = useDeliveryQuote(delivery && hasAddress, lines, user);
  const fee = delivery ? (quote?.delivery_fee ?? 0) : 0;
  const subtotal = linesTotal(lines);
  const count = itemCount(lines);
  const address = [user.st_add, user.city?.city, user.postal, user.city?.country.country].filter(Boolean).join(', ');
  const hasPin = user.lat != null && user.lng != null;

  const placeOrder = async () => {
    if (!hasAddress) {
      toast.error('Please add your shipping details first.');
      return;
    }
    if (delivery && !quote) {
      toast.error(quoteError ?? 'Please wait for the delivery fee.');
      return;
    }
    setPlacing(true);
    try {
      const order = await orderService.place({
        lines: lines.map((l) => ({ prod_var_id: l.prod_var_id, quantity: l.quantity })),
        payment_method: payment,
        customer: { full_name: user.full_name, mobile_no: user.mobile_no, st_add: user.st_add, postal: user.postal, city_id: user.city_id },
        fulfillment,
        drop_off: delivery ? { lat: user.lat, lng: user.lng, delivery_note: user.delivery_note } : undefined,
      });
      cart.reload(); // the backend took the ordered items out of the cart
      if (payment === 'GCash') navigate(`/checkout/gcash/${order.order_id}`, { replace: true });
      else navigate(`/orders/${order.order_id}`, { replace: true, state: { placed: true } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not place your order');
      setPlacing(false);
    }
  };

  const feeCell = !delivery ? 'Free' : !hasAddress ? 'Add your address' : quoting ? 'Calculating…' : quoteError ? 'Unavailable' : formatPeso(fee);

  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <Link to={buyVariant ? `/products/${buyVariant.product_id}?variant=${buyVariant.prod_var_id}` : '/cart'} className="inline-flex items-center gap-1 text-sm text-muted hover:text-forest">
        <ArrowLeft className="size-4" /> {buyVariant ? 'Back to product' : 'Back to cart'}
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-semibold text-forest sm:text-4xl">Checkout</h1>

      <div className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-full border border-forest/30 bg-mint px-5 py-2 text-sm font-semibold text-forest">
        <span>Product</span>
        <span className="w-16 text-center sm:w-24">Quantity</span>
        <span className="w-20 text-right sm:w-28">Subtotal</span>
      </div>
      <ul className="mb-6">
        {lines.map((l, i) => (
          <li key={l.cart_item_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line px-1 py-3 last:border-0 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn('size-14 shrink-0 overflow-hidden rounded-xl border border-ink/15 sm:size-16', tileColor(i))}>
                <img src={firstImage(l.variant.images)} alt="" className="size-full object-contain p-1.5" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium text-ink">{l.variant.product.product_name}</p>
                <p className="text-xs text-muted">{l.variant.prod_attr}</p>
                <PriceTag variant={l.variant} size="sm" className="sm:hidden" />
              </div>
            </div>
            <span className="w-16 text-center text-sm sm:w-24">{l.quantity} pc{l.quantity > 1 ? 's' : ''}</span>
            <span className="w-20 text-right text-sm font-semibold text-forest sm:w-28">{formatPeso(lineTotal(l))}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-5">
        <Card title="Fulfilment Method">
          <div className="space-y-2">
            <Choice name="fulfillment" checked={delivery} onSelect={() => setFulfillment('delivery')} icon={<Truck className="size-4" />} label={`${COURIER} Delivery`} note={`Estimated ${deliveryWindow()}`} />
            <Choice name="fulfillment" checked={!delivery} onSelect={() => setFulfillment('pickup')} icon={<Store className="size-4" />} label="Store Pickup" note="Available today" />
          </div>
          {delivery ? (
            <div className="mt-4 rounded-xl bg-cream p-3 text-sm">
              {!hasAddress ? (
                <p className="text-muted">Add your shipping address to see the delivery fee.</p>
              ) : quoting ? (
                <p className="text-muted">Finding the right vehicle and distance for your order…</p>
              ) : quoteError ? (
                <p className="text-coral-dark">{quoteError}</p>
              ) : quote ? (
                <>
                  <p className="font-medium text-ink">
                    {COURIER} {quote.vehicle}
                    {quote.trips > 1 && ` × ${quote.trips} trips`} · {quote.distance_km} km from our store
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    The vehicle is picked from the size and weight of your items. The fee is the {COURIER} rate for that vehicle and distance
                    {quote.located_by === 'address' && ', measured to your typed address'}
                    {quote.located_by === 'pin' && ', measured to your map pin'}.
                  </p>
                </>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Pick up at <span className="font-medium text-ink">{STORE_ADDRESS}</span>. We'll text you when it's ready.
            </p>
          )}
        </Card>

        <Card
          title={delivery ? 'Shipping Address' : 'Contact Details'}
          action={
            <Link to={`/checkout/shipping${buySearch}`} className="inline-flex items-center gap-1 text-sm text-ink hover:text-forest">
              <Pencil className="size-3.5" /> Edit details
            </Link>
          }
        >
          {hasAddress ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted">Contact Name</dt>
              <dd className="text-ink">
                {user.full_name} ({user.mobile_no})
              </dd>
              <dt className="text-muted">Address</dt>
              <dd className="text-ink">{address}</dd>
              {delivery && (
                <>
                  <dt className="text-muted">Map pin</dt>
                  <dd className={hasPin ? 'text-ink' : 'text-muted'}>
                    <MapPin className="mr-1 inline size-3.5 text-forest" />
                    {hasPin ? 'Pinned, the rider will be sent to your pin' : 'None yet. Pin your house so the rider finds you faster.'}
                  </dd>
                  {user.delivery_note && (
                    <>
                      <dt className="text-muted">Rider notes</dt>
                      <dd className="whitespace-pre-line text-ink">{user.delivery_note}</dd>
                    </>
                  )}
                </>
              )}
            </dl>
          ) : (
            <div className="rounded-xl bg-butter-light p-4 text-sm">
              <p className="text-ink">We need your mobile number and address to send your order.</p>
              <ButtonLink to={`/checkout/shipping${buySearch}`} size="sm" className="mt-3">
                Add shipping details
              </ButtonLink>
            </div>
          )}
        </Card>

        <Card title="Payment Method">
          <div className="space-y-2">
            <Choice
              name="payment"
              checked={payment === 'COD'}
              onSelect={() => setPayment('COD')}
              icon={<Banknote className="size-4" />}
              label={delivery ? 'Cash on Delivery' : 'Cash on Pickup'}
            />
            <Choice name="payment" checked={payment === 'GCash'} onSelect={() => setPayment('GCash')} icon={<Smartphone className="size-4" />} label="GCash" />
          </div>

          <h3 className="mt-6 font-sans text-base font-semibold text-ink">Order Summary</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>
                Subtotal ({count} {count === 1 ? 'item' : 'items'})
              </dt>
              <dd>{formatPeso(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery Fee{delivery && quote ? ` (${COURIER})` : ''}</dt>
              <dd className={delivery && !quote ? 'text-muted' : undefined}>{feeCell}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold">
              <dt className="font-display text-forest">Total Amount</dt>
              <dd className="text-forest">{formatPeso(subtotal + fee)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Button size="lg" className="mt-6 w-full" onClick={placeOrder} loading={placing} disabled={!hasAddress || (delivery && !quote)}>
        <ShoppingBag className="size-4" /> Checkout
      </Button>
    </div>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const cart = useCart();

  // Buy Now on a product page: /checkout?buy=<variant>&qty=<number>. It's in the URL so it survives logging in and editing the address.
  const [params] = useSearchParams();
  const buyId = Number(params.get('buy')) || null;
  const buyNow = useAsync(() => (buyId ? productService.getVariants([buyId]) : Promise.resolve([])), [buyId]);
  const buySearch = buyId ? `?${params.toString()}` : '';

  if (!user) return null; // RequireLogin handles this
  if (cart.loading || (buyId && buyNow.loading)) return <div className="container-page max-w-4xl py-8"><LoadingState label="Loading your order..." layout="list" /></div>;
  if (cart.error) return <ErrorState message={cart.error} onRetry={cart.reload} />;
  if (buyNow.error) return <ErrorState message={buyNow.error} onRetry={buyNow.reload} />;

  const buyVariant = buyNow.data?.[0];
  const buyLines: CartLine[] = buyVariant
    ? [{ cart_item_id: `buy-${buyVariant.prod_var_id}`, prod_var_id: buyVariant.prod_var_id, quantity: Math.min(Math.max(1, Math.floor(Number(params.get('qty'))) || 1), buyVariant.stocks), variant: buyVariant }]
    : [];

  // the one Buy Now item, or the items ticked in the cart (all of them if the cart was skipped)
  const ids = readCheckoutIds();
  const lines = buyId ? buyLines.filter((l) => isBuyable(l.variant)) : cart.lines.filter((l) => isBuyable(l.variant) && (!ids || ids.includes(l.prod_var_id)));

  if (lines.length === 0) {
    return (
      <div className="container-page py-12">
        <EmptyState
          icon={<ShoppingBag className="size-7" />}
          title="Nothing to check out"
          message={buyId ? 'This item is no longer available.' : 'Pick the items you want from your cart first.'}
          action={buyId ? <ButtonLink to="/products">Browse products</ButtonLink> : <ButtonLink to="/cart">Go to cart</ButtonLink>}
        />
      </div>
    );
  }

  return <CheckoutForm lines={lines} user={user} buyVariant={buyVariant} buySearch={buySearch} />;
}
