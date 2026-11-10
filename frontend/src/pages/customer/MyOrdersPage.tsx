import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, PackageCheck, ReceiptText, Search, Store, Truck, XCircle } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import PhotoPicker from '@/components/ui/PhotoPicker';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useCart } from '@/context/CartContext';
import WriteReviewModal from '@/features/reviews/components/WriteReviewModal';
import { useAsync } from '@/hooks/useAsync';
import { useOrderEvents } from '@/hooks/useOrderEvents';
import { orderService } from '@/services/orderService';
import type { RefundStat } from '@/types/db';
import type { OrderWithItems } from '@/types/models';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { firstImage } from '@/lib/images';
import { MAX_SEARCH } from '@/lib/constants';
import { formatPeso } from '@/lib/pricing';
import { awaitingReceipt, ORDER_TABS, orderTab, parseShipping, type OrderTab } from '@/lib/tracking';

const CHIP: Record<Exclude<OrderTab, 'all'>, { label: string; className: string }> = {
  to_pay: { label: 'To Pay', className: 'bg-pending text-pending-text' },
  to_ship: { label: 'To Ship', className: 'bg-sky-100 text-sky-800' },
  to_receive: { label: 'To Receive', className: 'bg-coral/30 text-coral-dark' },
  completed: { label: 'Completed', className: 'bg-mint text-forest' },
  cancelled: { label: 'Cancelled', className: 'bg-line text-muted' },
  refund: { label: 'Refund', className: 'bg-cancelled text-cancelled-text' },
};

// the chip and the grey line for each refund status
const REFUND: Record<RefundStat, { label: string; className: string; bold: string; text: string }> = {
  Requested: { label: 'Refund Requested', className: 'bg-pending text-pending-text', bold: 'Refund requested.', text: "We're reviewing your request." },
  Approved: { label: 'Refund Approved', className: 'bg-mint text-forest', bold: 'Refund approved.', text: "We'll send your money back soon." },
  Rejected: { label: 'Refund Rejected', className: 'bg-line text-muted', bold: 'Refund rejected.', text: 'Contact us if you have questions.' },
  Refunded: { label: 'Refunded', className: 'bg-forest text-white', bold: 'Refunded.', text: 'Your money has been sent back.' },
};

const REFUND_REASONS = ['Item arrived damaged', 'Wrong item received', 'Missing parts or items', 'Item not as described', 'Other'];

const CANCEL_REASONS = ['Change of mind', 'Found a better price', 'Ordered the wrong item', 'Delivery takes too long', 'Other'];

const DAY = 86400000;
const plusDays = (iso: string, days: number) => formatDate(new Date(Date.parse(iso) + days * DAY).toISOString());

// the grey line at the bottom of each order card
function statusLine(order: OrderWithItems) {
  const { pickup, courier, cancelReason } = parseShipping(order.shipping_add);
  switch (orderTab(order)) {
    case 'to_pay':
      if (order._temp_payment_status === 'For verification') return { icon: Clock, bold: 'Checking your payment.', text: "We'll prepare your order once it's confirmed." };
      if (order._temp_payment_status === 'Rejected') return { icon: Clock, bold: 'Payment not confirmed.', text: 'Please check your reference number and send it again.' };
      return { icon: Clock, bold: 'Payment pending.', text: `Please complete payment before ${plusDays(order.placed_at, 1)}.` };
    case 'to_ship':
      return pickup
        ? { icon: Store, bold: 'Preparing.', text: "We're getting your order ready for pickup." }
        : { icon: Truck, bold: 'Ready to ship.', text: `We are preparing your order. The estimated dispatch is ${plusDays(order.placed_at, 1)}.` };
    case 'to_receive':
      return pickup
        ? { icon: Store, bold: 'Ready for pickup.', text: 'You can pick up your order at the store.' }
        : { icon: Truck, bold: `Out for delivery${courier ? ` with ${courier}` : ''}.`, text: 'Track it on the map.' };
    case 'refund': {
      const r = REFUND[order.refund!.refund_stat];
      return { icon: ReceiptText, bold: r.bold, text: r.text };
    }
    case 'completed':
      if (order.not_received_at) return { icon: XCircle, bold: 'Reported as not received.', text: "We're checking with the rider and will get back to you." };
      if (awaitingReceipt(order)) return { icon: PackageCheck, bold: 'Marked delivered by the rider.', text: 'Please confirm you received it, or report it if you did not.' };
      return { icon: PackageCheck, bold: pickup ? 'Picked up.' : 'Delivered.', text: pickup ? 'You picked up this order.' : 'Your package has been delivered.' };
    default:
      if (order.order_stat === 'Returned') {
        return { icon: XCircle, bold: 'Returned to store.', text: `The rider could not deliver it after ${order.attempts.length} attempts. Contact us to arrange a new delivery.` };
      }
      return {
        icon: XCircle,
        bold: 'Cancelled.',
        text: cancelReason ? `Order cancelled by buyer. Reason: ${cancelReason}.` : 'This order was cancelled.',
      };
  }
}

function OrderCard({
  order,
  onCancel,
  onReceived,
  onReview,
  onRefund,
  onGotIt,
  onNotReceived,
}: {
  order: OrderWithItems;
  onCancel: () => void;
  onReceived: () => void;
  onReview: () => void;
  onRefund: () => void;
  onGotIt: () => void;
  onNotReceived: () => void;
}) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const tab = orderTab(order) as Exclude<OrderTab, 'all'>;
  const first = order.items[0];
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  const line = statusLine(order);
  const support = `/contact?order=${order.order_num}`;

  const buyAgain = async () => {
    for (const i of order.items) await addItem({ prod_var_id: i.prod_var_id, stocks: Number.MAX_SAFE_INTEGER }, i.quantity);
    navigate('/cart');
  };

  const actions = {
    to_pay:
      order._temp_payment_status === 'For verification' ? (
        <ButtonLink to={support} variant="outline" size="sm">
          Contact Support
        </ButtonLink>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel Order
          </Button>
          <ButtonLink to={`/checkout/gcash/${order.order_id}`} size="sm">
            Pay Now
          </ButtonLink>
        </>
      ),
    to_ship: (
      <>
        {/* a paid GCash order needs the store to send the money back, so it goes through support */}
        {order._temp_payment_status !== 'Paid' && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel Order
          </Button>
        )}
        <ButtonLink to={support} size="sm">
          Contact Support
        </ButtonLink>
      </>
    ),
    to_receive: (
      <Button size="sm" onClick={onReceived}>
        Order Received
      </Button>
    ),
    completed: awaitingReceipt(order) ? (
      <>
        <Button variant="outline" size="sm" onClick={onNotReceived}>
          Not Received
        </Button>
        <Button size="sm" onClick={onGotIt}>
          Yes, I Received It
        </Button>
      </>
    ) : order.not_received_at ? (
      <ButtonLink to={support} variant="outline" size="sm">
        Contact Support
      </ButtonLink>
    ) : (
      <>
        <Button variant="outline" size="sm" onClick={onRefund}>
          Request Refund
        </Button>
        <Button size="sm" onClick={onReview}>
          Write Review
        </Button>
      </>
    ),
    cancelled:
      order.order_stat === 'Returned' ? (
        <ButtonLink to={support} size="sm">
          Contact Support
        </ButtonLink>
      ) : (
        <Button size="sm" onClick={buyAgain}>
          Buy Again
        </Button>
      ),
    refund:
      order.refund?.refund_stat === 'Rejected' ? (
        <ButtonLink to={support} variant="outline" size="sm">
          Contact Support
        </ButtonLink>
      ) : null,
  }[tab];
  const chip = order.refund ? REFUND[order.refund.refund_stat] : order.order_stat === 'Returned' ? { label: 'Returned', className: CHIP.cancelled.className } : CHIP[tab];

  return (
    <li className="overflow-hidden rounded-card border border-ink/20 bg-white">
      <div className="flex gap-3 p-4 sm:gap-4">
        <Link to={`/orders/${order.order_id}`} className="size-16 shrink-0 overflow-hidden rounded-lg bg-cream sm:size-20">
          <img src={firstImage(first?.images ?? null)} alt="" className="size-full object-contain p-1" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <Link to={`/orders/${order.order_id}`} className="truncate font-medium text-ink hover:underline">
                  {first?.item_name ?? order.order_num}
                </Link>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', chip.className)}>{chip.label}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {[first?.color, `${count} piece${count === 1 ? '' : 's'}`].filter(Boolean).join(' • ')}
                {order.items.length > 1 && ` • +${order.items.length - 1} more item${order.items.length > 2 ? 's' : ''}`}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Order #{order.order_num} • {formatDate(order.placed_at)}
              </p>
            </div>
            <p className="shrink-0 font-semibold text-amber">{formatPeso(order.total_amt)}</p>
          </div>
          {actions && <div className="mt-3 flex flex-wrap justify-end gap-2">{actions}</div>}
        </div>
      </div>

      <Link
        to={`/orders/${order.order_id}`}
        className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-cream px-3 py-2.5 text-xs text-ink hover:bg-line/60 sm:text-sm"
      >
        <line.icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{line.bold}</span> {line.text}
        </span>
        <span className="flex shrink-0 items-center text-muted">
          View <ChevronRight className="size-4" />
        </span>
      </Link>
    </li>
  );
}

export default function MyOrdersPage() {
  const { data: orders, loading, error, reload } = useAsync(() => orderService.getMine(), []);
  const toast = useToast();
  // any change to one of my orders (shipped, delivered by the rider, ...) refreshes the list right away
  useOrderEvents('/ws/me/orders', reload);
  const [tab, setTab] = useState<OrderTab>('all');
  const [q, setQ] = useState('');
  const [cancelling, setCancelling] = useState<OrderWithItems | null>(null);
  const [reviewing, setReviewing] = useState<OrderWithItems | null>(null);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const [refunding, setRefunding] = useState<OrderWithItems | null>(null);
  const [refundReason, setRefundReason] = useState(REFUND_REASONS[0]);
  const [refundDetails, setRefundDetails] = useState('');
  const [refundPhotos, setRefundPhotos] = useState<string[]>([]);
  const [reporting, setReporting] = useState<OrderWithItems | null>(null); // "I didn't receive it"
  const [reportDetails, setReportDetails] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // "Other" can be something a photo can't show, every other reason is about the item itself
  const photoNeeded = refundReason !== 'Other';
  const [busy, setBusy] = useState(false);

  const needle = q.trim().toLowerCase();
  const shown = (orders ?? [])
    .filter((o) => tab === 'all' || orderTab(o) === tab)
    .filter(
      (o) =>
        !needle ||
        [o.order_num, formatDate(o.placed_at), ...o.items.map((i) => i.item_name)].some((text) => text.toLowerCase().includes(needle)),
    )
    .sort((a, b) => Date.parse(b.placed_at) - Date.parse(a.placed_at));

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      setCancelling(null);
      setRefunding(null);
      setReporting(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <h1 className="text-3xl font-semibold text-forest">Track Order</h1>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          maxLength={MAX_SEARCH}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by order number, product name, or date"
          aria-label="Search orders"
          className="h-11 w-full rounded-xl border border-ink/25 bg-white pl-11 pr-4 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-mint"
        />
      </div>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
        <div className="flex min-w-max gap-2">
          {ORDER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={cn(
                'min-w-20 rounded-full px-4 py-2 text-xs font-medium transition-colors sm:text-sm',
                tab === t.key ? 'bg-forest text-white' : 'bg-mint text-forest hover:bg-mint-light',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading your orders..." layout="list" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !shown.length ? (
        <EmptyState
          title={needle ? 'No matching orders' : tab === 'refund' ? 'No refunds' : 'No orders here yet'}
          message={
            needle
              ? 'Try another order number, product name, or date.'
              : tab === 'all'
                ? "When you place an order, you'll be able to track it here."
                : 'Orders with this status will show up here.'
          }
          action={!needle && <ButtonLink to="/products">Start shopping</ButtonLink>}
        />
      ) : (
        <ul className="mt-5 space-y-4">
          {shown.map((o) => (
            <OrderCard
              key={o.order_id}
              order={o}
              onCancel={() => {
                setReason(CANCEL_REASONS[0]);
                setOtherReason('');
                setCancelling(o);
              }}
              onReceived={() => run(() => orderService.markReceived(o.order_id), 'Thanks! Your order is marked as received.')}
              onReview={() => setReviewing(o)}
              onRefund={() => {
                setRefundReason(REFUND_REASONS[0]);
                setRefundDetails('');
                setRefundPhotos([]);
                setRefunding(o);
              }}
              onGotIt={() => run(() => orderService.deliveryFeedback(o.order_id, true), 'Thanks for confirming! Enjoy your new furniture.')}
              onNotReceived={() => {
                setReportDetails('');
                setReporting(o);
              }}
            />
          ))}
        </ul>
      )}

      <Modal
        open={!!cancelling}
        onClose={() => !busy && setCancelling(null)}
        title="Cancel this order?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)} disabled={busy}>
              Keep order
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={reason === 'Other' && !otherReason.trim()}
              onClick={() => cancelling && run(() => orderService.cancel(cancelling.order_id, reason === 'Other' ? otherReason.trim() : reason), 'Your order was cancelled.')}>
              Cancel order
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">Order #{cancelling?.order_num} will be cancelled and can't be undone.</p>
        <div className="space-y-4">
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {CANCEL_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          {reason === 'Other' && (
            <Textarea label="Please tell us why" rows={3} maxLength={200} value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />
          )}
        </div>
      </Modal>

      <Modal
        open={!!refunding}
        onClose={() => !busy && setRefunding(null)}
        title="Request a refund"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefunding(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={uploadingPhoto || (refundReason === 'Other' ? !refundDetails.trim() : !refundPhotos.length)}
              onClick={() =>
                refunding &&
                run(() => orderService.requestRefund(refunding.order_id, refundReason, refundDetails, refundPhotos), 'Refund requested. We will review it soon.')
              }
            >
              Send request
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">
          Order #{refunding?.order_num} • {refunding && formatPeso(refunding.total_amt)}
        </p>
        <div className="space-y-4">
          <Select label="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)}>
            {REFUND_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Textarea
            label={refundReason === 'Other' ? 'Tell us what happened' : 'Details (optional)'}
            rows={4}
            maxLength={1000}
            value={refundDetails}
            onChange={(e) => setRefundDetails(e.target.value)}
            placeholder="e.g., The table leg was cracked when it arrived."
          />
          <PhotoPicker
            label={photoNeeded ? 'Photos of the item (at least 1, up to 3)' : 'Photos (optional, up to 3)'}
            photos={refundPhotos}
            onChange={setRefundPhotos}
            upload={orderService.uploadRefundPhoto}
            onUploadingChange={setUploadingPhoto}
          />
        </div>
      </Modal>

      <Modal
        open={!!reporting}
        onClose={() => !busy && setReporting(null)}
        title="Order not received?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReporting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!reportDetails.trim()}
              onClick={() => reporting && run(() => orderService.deliveryFeedback(reporting.order_id, false, reportDetails.trim()), 'Report sent. We will check with the rider and contact you.')}
            >
              Send report
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">
          The rider marked order #{reporting?.order_num} as delivered. Tell us what happened and we'll look into it right away.
        </p>
        <Textarea
          label="What happened?"
          rows={4}
          maxLength={500}
          value={reportDetails}
          onChange={(e) => setReportDetails(e.target.value)}
          placeholder="e.g., Nobody came to our house today and the photo is not our gate."
        />
      </Modal>

      <WriteReviewModal order={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}
