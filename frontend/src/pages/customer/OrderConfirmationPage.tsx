import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Camera, CheckCircle2, ChevronLeft, MapPin, Package, Store } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ErrorState, LoadingState } from '@/components/ui/States';
import StatusPill from '@/components/ui/StatusPill';
import DeliveryMap from '@/components/order/DeliveryMap';
import TrackingSteps from '@/components/order/TrackingSteps';
import { useAsync } from '@/hooks/useAsync';
import { useOrderEvents } from '@/hooks/useOrderEvents';
import { usePolling } from '@/hooks/usePolling';
import { orderService } from '@/services/orderService';
import { DELIVERY_DAYS, STORE_ADDRESS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/dates';
import { parseImages } from '@/lib/images';
import { formatPeso } from '@/lib/pricing';
import { awaitingReceipt, canPayGcash, deliveryProgress, parseShipping, paymentLabel, type LatLng } from '@/lib/tracking';
import NotFound from '../NotFound';

const STATUS_TEXT = {
  delivery: {
    Pending: "We're preparing your order for shipping.",
    Shipped: 'Your order is on the way.',
    Delivered: 'Your order has been delivered.',
    Cancelled: 'This order was cancelled.',
    Returned: 'The rider could not deliver this order, so it went back to our store.',
  },
  pickup: {
    Pending: "We're preparing your order.",
    Shipped: 'Your order is ready for pickup at the store.',
    Delivered: 'You picked up this order.',
    Cancelled: 'This order was cancelled.',
    Returned: 'This order is back at the store.',
  },
};

const DELIVERED_BY = { rider: 'confirmed by the rider', customer: 'confirmed by you', admin: 'confirmed by the store' };

export default function OrderConfirmationPage() {
  const orderId = Number(useParams().orderId);
  const justPlaced = !!(useLocation().state as { placed?: boolean } | null)?.placed;
  const { data: order, loading, error, reload } = useAsync(() => orderService.getById(orderId), [orderId]);
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const answer = async (received: boolean) => {
    if (!order) return;
    setBusy(true);
    try {
      await orderService.deliveryFeedback(order.order_id, received, received ? undefined : reportDetails.trim());
      toast.success(received ? 'Thanks for confirming!' : 'Report sent. We will check with the rider and contact you.');
      setReporting(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };
  // live updates over a WebSocket, so the page turns to Delivered the moment the rider scans the receipt;
  // while the socket is down and the order is on the way, it checks every half minute instead
  const live = useOrderEvents(Number.isInteger(orderId) ? `/ws/orders/${orderId}` : null, reload);
  usePolling(reload, 30000, !live && order?.order_stat === 'Shipped');

  if (!Number.isInteger(orderId)) return <NotFound />;
  if (loading && !order) return <div className="container-page max-w-4xl py-8"><LoadingState label="Loading your order..." layout="detail" /></div>;
  if (error) return error.toLowerCase().includes('not found') ? <NotFound /> : <ErrorState message={error} onRetry={reload} />;
  if (!order) return <NotFound />;

  const itemsTotal = order.items.reduce((sum, i) => sum + i.sub_total, 0);
  // older orders (before the delivery_fee column) only have the difference between the total and the items
  const fee = order.delivery_fee || order.total_amt - itemsTotal;
  const { pickup, courier, address } = parseShipping(order.shipping_add);
  const progress = deliveryProgress(order);
  const eta = DELIVERY_DAYS.map((d) => formatDate(new Date(Date.parse(order.placed_at) + d * 86400000).toISOString()));
  const point: LatLng | null = order.drop_lat != null && order.drop_lng != null ? [order.drop_lat, order.drop_lng] : null;
  const proof = parseImages(order.proof_photos);

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

        {order.order_stat !== 'Cancelled' && order.order_stat !== 'Returned' && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-forest">{STATUS_TEXT[pickup ? 'pickup' : 'delivery'][order.order_stat]}</p>
              {!pickup && order.order_stat !== 'Delivered' && (
                <p className="text-sm text-muted">
                  Estimated arrival: <span className="font-medium text-ink">{eta[0]} – {eta[1]}</span>
                </p>
              )}
              {order.order_stat === 'Delivered' && order.delivered_at && (
                <p className="text-sm text-muted">
                  Delivered <span className="font-medium text-ink">{formatDateTime(order.delivered_at)}</span>
                  {order.delivered_by && ` · ${DELIVERED_BY[order.delivered_by]}`}
                </p>
              )}
            </div>

            <DeliveryMap address={address} point={point} progress={progress} pickup={pickup} courier={courier} vehicle={order.vehicle} orderNum={order.order_num} />

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
                    {order.delivery_note && <span className="mt-1 block text-xs text-muted">Note to rider: {order.delivery_note}</span>}
                  </span>
                </p>
              )}
            </div>

            {order.attempts.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-butter-light p-3 text-sm">
                {order.attempts.map((a, i) => (
                  <li key={a.attempt_id}>
                    <span className="font-medium text-ink">Delivery attempt {i + 1} failed</span> · {a.reason}
                    {a.note && ` (${a.note})`} · <span className="text-muted">{formatDateTime(a.attempted_at)}</span>
                  </li>
                ))}
              </ul>
            )}

            {proof.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Camera className="size-4 text-forest" /> Proof of delivery
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {proof.map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" aria-label={`Open delivery photo ${i + 1}`}>
                      <img src={src} alt="" className="size-24 rounded-lg border border-line object-cover sm:size-28" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {awaitingReceipt(order) && (
              <div className="rounded-xl bg-butter-light p-4 text-sm">
                <p className="font-medium text-ink">Did you receive your order?</p>
                <p className="mt-0.5 text-muted">The rider marked it as delivered. Please check the photos above.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" loading={busy} onClick={() => answer(true)}>
                    Yes, I received it
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setReporting(true)}>
                    No, I didn't receive it
                  </Button>
                </div>
              </div>
            )}
            {order.not_received_at && (
              <p className="rounded-xl bg-cancelled p-3 text-sm text-cancelled-text">
                You reported this order as not received on {formatDateTime(order.not_received_at)}. We're checking with the rider and will contact you.
              </p>
            )}
            {order.receipt_confirmed_at && (
              <p className="rounded-xl bg-mint-light p-3 text-sm text-forest">You confirmed you received this order on {formatDateTime(order.receipt_confirmed_at)}.</p>
            )}
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
            <dt className="text-muted">
              Delivery Fee
              {order.vehicle && (
                <span className="block text-xs">
                  {courier} {order.vehicle}
                  {order.trips > 1 && ` × ${order.trips} trips`}
                  {order.distance_km != null && ` · ${order.distance_km} km`}
                </span>
              )}
            </dt>
            <dd>{fee > 0 ? formatPeso(fee) : 'Free'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Payment</dt>
            <dd className="text-right">{paymentLabel(order)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-lg font-semibold text-forest">
            <dt className="font-display">Total</dt>
            <dd>{formatPeso(order.total_amt)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {canPayGcash(order) && (
            <ButtonLink to={`/checkout/gcash/${order.order_id}`} size="lg" className="w-full sm:w-auto sm:px-10">
              Pay with e-wallet
            </ButtonLink>
          )}
          <ButtonLink to="/products" size="lg" variant={canPayGcash(order) ? 'outline' : undefined} className="w-full sm:w-auto sm:px-10">
            Continue shopping
          </ButtonLink>
        </div>
      </section>

      <Modal
        open={reporting}
        onClose={() => !busy && setReporting(false)}
        title="Order not received?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReporting(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} disabled={!reportDetails.trim()} onClick={() => answer(false)}>
              Send report
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">Tell us what happened and we'll look into it right away.</p>
        <Textarea label="What happened?" rows={4} maxLength={500} value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="e.g., Nobody came to our house today and the photo is not our gate." />
      </Modal>
    </div>
  );
}
