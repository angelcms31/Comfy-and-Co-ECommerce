import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Download, Printer, Truck } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { orderService } from '@/services/orderService';
import { COURIER, STORE_ADDRESS, STORE_PHONE } from '@/lib/constants';
import { formatDateTime } from '@/lib/dates';
import { formatPeso } from '@/lib/pricing';
import { downloadReceiptPdf } from '@/lib/receiptPdf';
import { parseShipping, paymentLabel } from '@/lib/tracking';
import NotFound from '../NotFound';

// the link in the QR code: the rider's page, no login (backend routers/delivery.py)
export const riderLink = (orderNum: string, token: string) => `${window.location.origin}/deliver/${encodeURIComponent(orderNum)}/${encodeURIComponent(token)}`;

// Printed and taped to the package when the order ships. The Lalamove rider scans the QR code at the door to
// confirm the delivery (with photos) or log a failed attempt. Opened from Orders (picking Shipped, or the details'
// "Print QR receipt"). A Pending delivery order gets its QR token here, and is marked Shipped here after printing.
export default function ReceiptPage() {
  const orderId = Number(useParams().orderId);
  const { data: order, loading, error, reload, setData } = useAsync(() => orderService.getOne(orderId), [orderId]);
  const [qr, setQr] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false); // downloaded or printed: unlocks "Mark as shipped"
  const [downloading, setDownloading] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const toast = useToast();

  // step 1: the QR token, made once for a Pending delivery order (refused e.g. while an e-wallet payment is unconfirmed)
  const needsToken = !!order && order.order_stat === 'Pending' && !order.delivery_token && !parseShipping(order.shipping_add).pickup;
  useEffect(() => {
    if (!needsToken) return;
    setTokenError(null);
    orderService
      .makeReceipt(orderId)
      .then(setData)
      .catch((err: unknown) => setTokenError(err instanceof Error ? err.message : 'Could not make the receipt'));
  }, [needsToken, orderId, setData]);

  // one click: the PDF lands in the downloads folder, no dialog
  const download = async () => {
    if (!order || !qr) return;
    setDownloading(true);
    try {
      const filename = await downloadReceiptPdf(order, qr);
      setPrinted(true);
      toast.success(`Saved ${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not make the PDF');
    } finally {
      setDownloading(false);
    }
  };

  const print = () => {
    window.print();
    setPrinted(true);
  };

  // step 2: after the receipt is printed and on the package
  const markShipped = async () => {
    if (!order) return;
    setShipping(true);
    try {
      setData(await orderService.updateStatus(order.order_id, 'Shipped'));
      toast.success(`#${order.order_num} is now Shipped`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the order');
    } finally {
      setShipping(false);
    }
  };

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
  const ready = (order.order_stat === 'Pending' || order.order_stat === 'Shipped') && !pickup && !!token;

  return (
    <div className="min-h-screen bg-cream print:bg-white">
      <div className="container-page max-w-3xl py-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-forest">
            <ArrowLeft className="size-4" /> Back to orders
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button variant={ready && order.order_stat === 'Pending' && !printed ? undefined : 'outline'} onClick={download} loading={downloading} disabled={!ready || !qr}>
              <Download className="size-4" /> Download PDF
            </Button>
            <Button variant="outline" onClick={print} disabled={!ready || !qr} title="Print on paper now">
              <Printer className="size-4" /> Print
            </Button>
            {ready && order.order_stat === 'Pending' && (
              <Button onClick={markShipped} loading={shipping} disabled={!printed} title={printed ? undefined : 'Download or print the receipt first'}>
                <Truck className="size-4" /> Mark as shipped
              </Button>
            )}
          </div>
        </div>
        {ready && order.order_stat === 'Pending' && (
          <p className="mt-4 rounded-xl bg-mint-light p-3 text-sm text-forest">
            {printed ? 'Tape the receipt to the package, then mark the order as shipped.' : 'Download (or print) this receipt first. The "Mark as shipped" button unlocks after that.'}
          </p>
        )}
        {ready && order.order_stat === 'Shipped' && <p className="mt-4 rounded-xl bg-cream p-3 text-sm text-ink">This order is already out for delivery. You can download or print the receipt again.</p>}
        {!ready && (
          <p className="mt-4 rounded-xl bg-pending p-3 text-sm text-pending-text">
            {pickup
              ? 'This is a store pickup order, there is nothing to deliver.'
              : needsToken
                ? (tokenError ?? 'Making the QR code...')
                : `A ${order.order_stat.toLowerCase()} order has no delivery receipt.`}
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
              <p className="text-2xl font-bold">{cod ? formatPeso(order.total_amt) : `PAID via ${order._temp_payment_wallet ?? 'e-wallet'}`}</p>
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
