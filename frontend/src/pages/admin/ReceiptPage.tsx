import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Printer } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { orderService } from '@/services/orderService';
import { COURIER, STORE_ADDRESS, STORE_PHONE } from '@/lib/constants';
import { formatDateTime } from '@/lib/dates';
import { formatPeso } from '@/lib/pricing';
import { parseShipping, paymentLabel } from '@/lib/tracking';
import NotFound from '../NotFound';

// the link in the QR code: the rider's page, no login (backend routers/delivery.py)
export const riderLink = (orderNum: string, token: string) => `${window.location.origin}/deliver/${encodeURIComponent(orderNum)}/${encodeURIComponent(token)}`;

// Printed and taped to the package when the order ships. The Lalamove rider scans the QR code at the door to
// confirm the delivery (with photos) or log a failed attempt. Opened from Orders > order details > Print receipt.
export default function ReceiptPage() {
  const orderId = Number(useParams().orderId);
  const { data: order, loading, error, reload } = useAsync(() => orderService.getOne(orderId), [orderId]);
  const [qr, setQr] = useState<string | null>(null);

  const token = order?.delivery_token;
  useEffect(() => {
    if (!order || !token) return;
    QRCode.toDataURL(riderLink(order.order_num, token), { width: 420, margin: 1, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(null));
  }, [order, token]);

  if (!Number.isInteger(orderId)) return <NotFound />;
  if (loading) return <div className="container-page max-w-3xl py-8"><LoadingState label="Loading the order..." layout="detail" /></div>;
  if (error) return error.toLowerCase().includes('not found') ? <NotFound /> : <ErrorState message={error} onRetry={reload} />;
  if (!order) return <NotFound />;

  const { pickup, address } = parseShipping(order.shipping_add);
  const cod = order.payment_method === 'COD' || order._temp_payment_status !== 'Paid';
  const ready = order.order_stat === 'Shipped' && !pickup && !!token;

  return (
    <div className="min-h-screen bg-cream print:bg-white">
      <div className="container-page max-w-3xl py-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-forest">
            <ArrowLeft className="size-4" /> Back to orders
          </Link>
          <Button onClick={() => window.print()} disabled={!ready || !qr}>
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
        </div>
        {!ready && (
          <p className="mt-4 rounded-xl bg-pending p-3 text-sm text-pending-text">
            {pickup
              ? 'This is a store pickup order, there is nothing to deliver.'
              : order.order_stat !== 'Shipped'
                ? `The receipt is made when the order is marked Shipped (this order is ${order.order_stat}).`
                : 'This order has no delivery code yet. Set it to Shipped again to make one.'}
          </p>
        )}
      </div>

      {/* the sheet, A5-ish: store header, where it goes, what's inside, what to collect, and the rider's QR code */}
      <article className="mx-auto max-w-3xl bg-white p-8 text-ink shadow-card print:max-w-none print:p-6 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="size-14" />
            <div>
              <p className="font-display text-2xl font-semibold text-forest">comfy&amp;co</p>
              <p className="text-xs text-muted">{STORE_ADDRESS}</p>
              <p className="text-xs text-muted">{STORE_PHONE}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted">Delivery receipt</p>
            <p className="font-mono text-2xl font-bold">{order.order_num}</p>
            <p className="text-xs text-muted">Placed {formatDateTime(order.placed_at)}</p>
          </div>
        </header>

        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto]">
          <div className="space-y-4 text-sm">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Deliver to</p>
              <p className="mt-1 text-lg font-semibold">{order.customer_name}</p>
              <p className="font-medium">{order.customer_mobile ?? ''}</p>
              <p>{address}</p>
              {order.delivery_note && (
                <p className="mt-1 rounded-lg bg-butter-light px-2 py-1 text-xs">
                  <span className="font-semibold">Note for rider:</span> {order.delivery_note}
                </p>
              )}
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Items</p>
              <ul className="mt-1 divide-y divide-line border-y border-line">
                {order.items.map((i) => (
                  <li key={i.order_item_id} className="flex justify-between gap-3 py-1.5">
                    <span>{i.item_name}</span>
                    <span className="shrink-0 font-medium">× {i.quantity}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p className="text-muted">{COURIER} vehicle</p>
              <p className="font-medium">
                {order.vehicle ?? '—'}
                {order.trips > 1 && ` × ${order.trips} trips`}
              </p>
              <p className="text-muted">Distance</p>
              <p className="font-medium">{order.distance_km != null ? `${order.distance_km} km` : '—'}</p>
              <p className="text-muted">Payment</p>
              <p className="font-medium">{paymentLabel(order)}</p>
            </section>

            <section className={`rounded-xl border-2 p-3 ${cod ? 'border-ink' : 'border-line'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{cod ? 'Collect from customer' : 'Nothing to collect'}</p>
              <p className="text-2xl font-bold">{cod ? formatPeso(order.total_amt) : 'PAID via GCash'}</p>
            </section>
          </div>

          <aside className="flex flex-col items-center text-center sm:w-56">
            {qr ? <img src={qr} alt="QR code for the rider" className="size-52 rounded-lg border border-line" /> : <div className="size-52 rounded-lg border border-dashed border-line" />}
            <p className="mt-2 text-sm font-semibold">Rider: scan at the door</p>
            <p className="text-xs text-muted">Opens the delivery page: confirm with photos, or log a failed attempt. No app or login needed.</p>
          </aside>
        </div>

        <footer className="mt-6 border-t border-line pt-3 text-center text-[11px] text-muted">
          Please handle with care. Questions? Call {STORE_PHONE}. Thank you for choosing comfy&amp;co!
        </footer>
      </article>
    </div>
  );
}
