import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, MapPin, Package, Store } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import StatusPill from '@/components/ui/StatusPill';
import DeliveryMap from '@/components/order/DeliveryMap';
import TrackingSteps from '@/components/order/TrackingSteps';
import { useAsync } from '@/hooks/useAsync';
import { orderService } from '@/services/orderService';
import { DELIVERY_DAYS, STORE_ADDRESS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatPeso } from '@/lib/pricing';
import { deliveryProgress, parseShipping } from '@/lib/tracking';
import NotFound from '../NotFound';

const STATUS_TEXT = {
  delivery: {
    Pending: "We're preparing your order for shipping.",
    Shipped: 'Your order is on the way.',
    Delivered: 'Your order has been delivered.',
    Cancelled: 'This order was cancelled.',
  },
  pickup: {
    Pending: "We're preparing your order.",
    Shipped: 'Your order is ready for pickup at the store.',
    Delivered: 'You picked up this order.',
    Cancelled: 'This order was cancelled.',
  },
};

export default function OrderConfirmationPage() {
  const orderId = Number(useParams().orderId);
  const justPlaced = !!(useLocation().state as { placed?: boolean } | null)?.placed;
  const { data: order, loading, error, reload } = useAsync(() => orderService.getById(orderId), [orderId]);

  if (!Number.isInteger(orderId)) return <NotFound />;
  if (loading) return <div className="container-page max-w-4xl py-8"><LoadingState label="Loading your order..." layout="detail" /></div>;
  if (error) return error.toLowerCase().includes('not found') ? <NotFound /> : <ErrorState message={error} onRetry={reload} />;
  if (!order) return <NotFound />;

  const itemsTotal = order.items.reduce((sum, i) => sum + i.sub_total, 0);
  const fee = order.total_amt - itemsTotal;
  const { pickup, courier, address } = parseShipping(order.shipping_add);
  const progress = deliveryProgress(order);
  const eta = DELIVERY_DAYS.map((d) => formatDate(new Date(Date.parse(order.placed_at) + d * 86400000).toISOString()));

  return (
    <div className="container-page max-w-4xl space-y-5 py-8 sm:py-12">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
        <ChevronLeft className="size-4" /> My orders
      </Link>

      <section className="rounded-card border border-line bg-white p-6 text-center shadow-card sm:p-8">
        {justPlaced ? (
          <>
            <CheckCircle2 className="mx-auto size-14 text-forest" />
            <h1 className="mt-3 text-3xl font-semibold text-forest">Thank you for your order!</h1>
            <p className="mt-1 text-sm text-muted">We've received it and will get it ready soon.</p>
          </>
        ) : (
          <>
            <Package className="mx-auto size-12 text-forest" />
            <h1 className="mt-3 text-3xl font-semibold text-forest">Track your order</h1>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="font-semibold text-ink">{order.order_num}</span>
          <StatusPill status={order.order_stat} />
          <span className="text-muted">· {formatDateTime(order.placed_at)}</span>
        </div>
      </section>

      <section className="space-y-5 rounded-card border border-line bg-white p-5 shadow-card sm:p-7">
        <TrackingSteps status={order.order_stat} pickup={pickup} courier={courier} />

        {order.order_stat !== 'Cancelled' && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-forest">{STATUS_TEXT[pickup ? 'pickup' : 'delivery'][order.order_stat]}</p>
              {!pickup && order.order_stat !== 'Delivered' && (
                <p className="text-sm text-muted">
                  Estimated arrival: <span className="font-medium text-ink">{eta[0]} – {eta[1]}</span>
                </p>
              )}
            </div>

            <DeliveryMap address={address} progress={progress} pickup={pickup} />

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p className="flex gap-2 rounded-xl bg-cream p-3">
                <Store className="mt-0.5 size-4 shrink-0 text-forest" />
                <span>
                  <span className="block text-xs text-muted">{pickup ? 'Pick up at' : 'From'}</span>
                  Comfy&amp;Co, {STORE_ADDRESS}
                </span>
              </p>
              {!pickup && (
                <p className="flex gap-2 rounded-xl bg-cream p-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-coral-dark" />
                  <span>
                    <span className="block text-xs text-muted">Deliver to</span>
                    {address}
                  </span>
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-card border border-line bg-white p-5 shadow-card sm:p-7">
        <h2 className="text-lg font-semibold text-forest">Order summary</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {order.items.map((i) => (
            <li key={i.order_item_id} className="flex justify-between gap-3 py-3">
              <span className="text-ink">
                {i.item_name} <span className="text-muted">× {i.quantity}</span>
              </span>
              <span className="font-medium">{formatPeso(i.sub_total)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Items</dt>
            <dd>{formatPeso(itemsTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Delivery Fee</dt>
            <dd>{fee > 0 ? formatPeso(fee) : 'Free'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Payment</dt>
            <dd>{order.payment_method === 'COD' ? 'Cash on Delivery' : 'GCash'}</dd>
          </div>
          <div className="flex justify-between pt-2 text-lg font-semibold text-forest">
            <dt className="font-display">Total</dt>
            <dd>{formatPeso(order.total_amt)}</dd>
          </div>
        </dl>
        {order.payment_method === 'GCash' && order.order_stat === 'Pending' && (
          <p className="mt-3 text-xs text-muted">We'll text the GCash payment details to your mobile number.</p>
        )}

        <div className="mt-6 text-center">
          <ButtonLink to="/products" size="lg" className="w-full sm:w-auto sm:px-10">
            Continue shopping
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
