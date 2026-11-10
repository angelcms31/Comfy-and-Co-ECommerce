import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Image as ImageIcon, MapPin, PackageX, Printer, QrCode } from 'lucide-react';
import Button, { buttonClass, ButtonLink } from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Dropdown from '@/components/ui/Dropdown';
import { Select } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import StatusPill from '@/components/ui/StatusPill';
import Table, { type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { useOrderEvents, type OrderEvent } from '@/hooks/useOrderEvents';
import { orderService } from '@/services/orderService';
import { cn } from '@/lib/cn';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/dates';
import { parseImages } from '@/lib/images';
import { downloadPdf, downloadStamp, type SavedPdf } from '@/lib/pdf';
import { formatPeso } from '@/lib/pricing';
import { awaitingReceipt, parseShipping, paymentLabel } from '@/lib/tracking';
import type { OrderStat, RefundStat } from '@/types/db';
import type { OrderWithItems } from '@/types/models';
import AdminPageHeader from './AdminPageHeader';
import OrderItemsCell from './OrderItemsCell';
import { FilterPills, SearchBox, StatCard, TodayChip } from './AdminUi';

const PAGE_SIZE = 8;
const STATUSES: OrderStat[] = ['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
const FINAL: OrderStat[] = ['Cancelled', 'Returned']; // can't be changed again, and the stock went back
// the one small pill in the Action column: whatever moves the order forward
const NEXT_STEP = 'h-7 gap-1 whitespace-nowrap px-3 text-xs font-semibold';

const SELECT_STYLE: Record<OrderStat, string> = {
  Pending: 'bg-pending text-pending-text',
  Shipped: 'bg-mint text-forest',
  Delivered: 'bg-forest text-white select-arrow-light',
  Cancelled: 'bg-cancelled text-cancelled-text',
  Returned: 'bg-line text-muted',
};

const DELIVERED_BY = { rider: 'by the rider (QR scan)', customer: 'by the customer', admin: 'by an admin' };

// what each refund status can change to; Rejected and Refunded are final
const REFUND_NEXT: Record<RefundStat, RefundStat[]> = {
  Requested: ['Approved', 'Rejected'],
  Approved: ['Refunded', 'Rejected'],
  Rejected: [],
  Refunded: [],
};

const REFUND_STYLE: Record<RefundStat, string> = {
  Requested: 'bg-pending text-pending-text',
  Approved: 'bg-mint text-forest',
  Rejected: 'bg-line text-muted',
  Refunded: 'bg-forest text-white select-arrow-light',
};

type Tab = OrderStat | 'all' | 'refund';

const EXPORT_COLUMNS = ['Order #', 'Customer', 'Items', 'Total', 'Delivery fee', 'Vehicle', 'Payment', 'Status', 'Placed', 'Ship to'];
const exportRow = (o: OrderWithItems, total: string | number, fee: string | number) => [
  o.order_num,
  o.customer_name,
  o.items.map((i) => `${i.item_name} x${i.quantity}`).join('; '),
  total,
  fee,
  o.vehicle ? `${o.vehicle}${o.trips > 1 ? ` x${o.trips}` : ''}${o.distance_km != null ? ` (${o.distance_km} km)` : ''}` : parseShipping(o.shipping_add).pickup ? 'Pickup' : '',
  o.payment_method,
  o.order_stat,
  formatDateTime(o.placed_at),
  parseShipping(o.shipping_add).address,
];
const php = (n: number) => `PHP ${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const filterLabel = (tab: Tab) => (tab === 'all' ? 'All orders' : tab === 'refund' ? 'Refund requests' : `${tab} orders`);

// the orders that are showing, as a spreadsheet file; who downloaded it and when goes at the bottom
function exportCsv(orders: OrderWithItems[], tab: Tab, by: string | null | undefined) {
  downloadCsv('comfyco-orders', [
    EXPORT_COLUMNS,
    ...orders.map((o) => exportRow(o, o.total_amt, o.delivery_fee)),
    [],
    [`${filterLabel(tab)}: ${orders.length}`],
    [downloadStamp(by)],
  ]);
}

// the same list as a PDF report (amounts written as PHP, the PDF font has no ₱)
function exportPdf(orders: OrderWithItems[], tab: Tab, by: string | null | undefined) {
  return downloadPdf('comfyco-orders', {
    title: 'Orders',
    subtitle: `${filterLabel(tab)} · ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`,
    by,
    columns: EXPORT_COLUMNS,
    rows: orders.map((o) => exportRow(o, php(o.total_amt), php(o.delivery_fee))),
  });
}

function OrderDetails({
  order,
  onClose,
  onPayment,
  onShip,
  saving,
}: {
  order: OrderWithItems | null;
  onClose: () => void;
  onPayment: (order: OrderWithItems, decision: 'confirm' | 'reject') => void;
  onShip: (order: OrderWithItems) => void;
  saving: boolean;
}) {
  if (!order) return null;
  const { pickup, courier, address, cancelReason } = parseShipping(order.shipping_add);
  // a delivery order is shipped from the receipt page (QR printed first); a pickup order is marked ready here
  const paid = order.payment_method !== 'GCash' || order._temp_payment_status === 'Paid';
  const canShip = order.order_stat === 'Pending' && paid;
  return (
    <Modal open onClose={onClose} title={`Order #${order.order_num}`} size="md">
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={order.order_stat} />
          <span className="text-muted">{formatDateTime(order.placed_at)}</span>
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {order.items.map((i) => (
            <li key={i.order_item_id} className="flex justify-between gap-3 px-3 py-2">
              <span>
                {i.item_name} <span className="text-muted">× {i.quantity}</span>
              </span>
              <span className="font-medium">{formatPeso(i.sub_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted">Customer</dt>
          <dd>{order.customer_name}</dd>
          <dt className="text-muted">Payment</dt>
          <dd>{paymentLabel(order)}</dd>
          <dt className="text-muted">Fulfilment</dt>
          <dd>
            {pickup ? 'Store pickup' : `Delivery${courier ? ` via ${courier}` : ''}`}
            {order.vehicle && (
              <span className="block text-xs text-muted">
                {order.vehicle}
                {order.trips > 1 && ` × ${order.trips} trips`}
                {order.distance_km != null && ` · ${order.distance_km} km`} · fee {formatPeso(order.delivery_fee)}
              </span>
            )}
          </dd>
          <dt className="text-muted">{pickup ? 'Customer address' : 'Ship to'}</dt>
          <dd>
            {address}
            {order.customer_mobile && <span className="block text-xs text-muted">{order.customer_mobile}</span>}
            {order.drop_lat != null && order.drop_lng != null && (
              <a
                href={`https://www.google.com/maps?q=${order.drop_lat},${order.drop_lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline"
              >
                <MapPin className="size-3.5" /> Customer's map pin
              </a>
            )}
          </dd>
          {order.delivery_note && (
            <>
              <dt className="text-muted">Rider note</dt>
              <dd className="whitespace-pre-line">{order.delivery_note}</dd>
            </>
          )}
          {order.attempts.length > 0 && (
            <>
              <dt className="text-muted">Failed attempts</dt>
              <dd>
                {order.attempts.map((a, i) => (
                  <span key={a.attempt_id} className="block">
                    {i + 1}. {a.reason}
                    {a.note && ` (${a.note})`} <span className="text-muted">· {formatDateTime(a.attempted_at)}</span>
                  </span>
                ))}
              </dd>
            </>
          )}
          {order.delivered_at && (
            <>
              <dt className="text-muted">Delivered</dt>
              <dd>
                {formatDateTime(order.delivered_at)}
                {order.delivered_by && <span className="text-muted"> · {DELIVERED_BY[order.delivered_by]}</span>}
                {order.receipt_confirmed_at && <span className="block text-xs text-forest">Customer confirmed receipt {formatDateTime(order.receipt_confirmed_at)}</span>}
              </dd>
            </>
          )}
          {parseImages(order.proof_photos).length > 0 && (
            <>
              <dt className="text-muted">Proof photos</dt>
              <dd className="flex flex-wrap gap-2">
                {parseImages(order.proof_photos).map((src, i) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" aria-label={`Open delivery photo ${i + 1}`}>
                    <img src={src} alt="" className="size-20 rounded-lg border border-line object-cover" />
                  </a>
                ))}
              </dd>
            </>
          )}
          {order.refund && (
            <>
              <dt className="text-muted">Refund</dt>
              <dd>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', REFUND_STYLE[order.refund.refund_stat])}>
                  {order.refund.refund_stat}
                </span>{' '}
                <span className="text-muted">· {formatDateTime(order.refund.requested_at)}</span>
              </dd>
              <dt className="text-muted">Refund reason</dt>
              <dd>
                {order.refund.reason}
                {order.refund.details && <span className="mt-1 block whitespace-pre-line text-muted">{order.refund.details}</span>}
                {/* a damaged item from the supplier: start an item issue report with this order's item and photos */}
                <Link
                  to={`/admin/suppliers?order=${order.order_id}`}
                  className="mt-2 flex w-fit items-center gap-1.5 rounded-full border border-coral-dark/50 px-3 py-1 text-xs font-medium text-coral-dark hover:bg-coral/10"
                >
                  <PackageX className="size-3.5" /> Report issue to supplier
                </Link>
              </dd>
              {parseImages(order.refund.photos).length > 0 && (
                <>
                  <dt className="text-muted">Refund photos</dt>
                  <dd className="flex flex-wrap gap-2">
                    {parseImages(order.refund.photos).map((src, i) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer" aria-label={`Open refund photo ${i + 1}`}>
                        <img src={src} alt="" className="size-20 rounded-lg border border-line object-cover" />
                      </a>
                    ))}
                  </dd>
                </>
              )}
            </>
          )}
          {cancelReason && (
            <>
              <dt className="text-muted">Cancel reason</dt>
              <dd>{cancelReason}</dd>
            </>
          )}
          <dt className="font-semibold text-forest">Total</dt>
          <dd className="font-semibold text-forest">{formatPeso(order.total_amt)}</dd>
        </dl>
        {order.not_received_at && (
          <div className="rounded-xl bg-cancelled p-3 text-cancelled-text">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="size-4" /> Customer says this was NOT received ({formatDateTime(order.not_received_at)})
            </p>
            <p className="mt-1 whitespace-pre-line">{order.not_received_report}</p>
            <p className="mt-1 text-xs">Check the rider's photos above and contact the customer.</p>
          </div>
        )}
        {!pickup && (canShip || order.order_stat === 'Shipped') && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream p-3">
            <p className="text-ink">
              {order.order_stat === 'Pending'
                ? 'Print the QR receipt and tape it to the package. The order is marked Shipped from the receipt page, after printing.'
                : 'Receipt printed and on the package. The rider scans its QR code at the door.'}
            </p>
            <ButtonLink to={`/admin/orders/${order.order_id}/receipt`} size="sm" variant={order.order_stat === 'Pending' ? undefined : 'outline'}>
              {order.order_stat === 'Pending' ? <QrCode className="size-4" /> : <Printer className="size-4" />}
              {order.order_stat === 'Pending' ? 'Print QR receipt' : 'Print again'}
            </ButtonLink>
          </div>
        )}
        {order._temp_payment_status === 'For verification' && order.order_stat === 'Pending' && (
          <div className="rounded-xl bg-pending p-3 text-pending-text">
            <p className="font-medium">
              Check the store's GCash app for reference no. {order._temp_payment_ref} and {formatPeso(order.total_amt)}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={saving} onClick={() => onPayment(order, 'confirm')}>
                Confirm payment
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => onPayment(order, 'reject')}>
                Not found, reject
              </Button>
            </div>
          </div>
        )}
        {order.payment_method === 'GCash' && order._temp_payment_status === 'Paid' && order.order_stat === 'Pending' && pickup && (
          <div className="rounded-xl bg-mint p-3 text-forest">
            <p className="font-medium">Payment confirmed. This order is ready to pick up.</p>
            <Button size="sm" className="mt-3" loading={saving} onClick={() => onShip(order)}>
              Mark as ready for pickup
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function OrdersPage() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savedPdf, setSavedPdf] = useState<SavedPdf | null>(null); // "Open PDF?" after an export
  const closePdf = () => {
    if (savedPdf) URL.revokeObjectURL(savedPdf.url);
    setSavedPdf(null);
  };
  const orders = useAsync(() => orderService.getAll(), []);
  // live: new orders, rider scans, failed attempts and customer reports show up without a refresh
  useOrderEvents('/ws/admin/orders', (e: OrderEvent & { received?: boolean; reason?: string; attempts?: number }) => {
    orders.reload();
    const num = `#${e.order_num}`;
    if (e.event === 'placed') toast.info(`New order ${num}`);
    else if (e.event === 'delivered') toast.success(`${num} delivered by the rider`);
    else if (e.event === 'failed_attempt') toast.info(`${num}: delivery attempt ${e.attempts ?? ''} failed (${e.reason ?? ''})`);
    else if (e.event === 'returned') toast.error(`${num} is coming back to the store`);
    else if (e.event === 'feedback' && e.received === false) toast.error(`${num}: the customer says it was NOT received`);
  });
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<OrderWithItems | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const all = orders.data ?? [];
  const count = (s: OrderStat) => all.filter((o) => o.order_stat === s).length;
  const refundRequests = all.filter((o) => o.refund?.refund_stat === 'Requested').length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (o) =>
        (tab === 'all' || (tab === 'refund' ? !!o.refund : o.order_stat === tab)) &&
        (!q || [o.order_num, o.customer_name, ...o.items.map((i) => i.item_name)].some((t) => t.toLowerCase().includes(q))),
    );
  }, [all, tab, search]);

  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [tab, search]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const [cancelling, setCancelling] = useState<{ order: OrderWithItems; status: OrderStat } | null>(null); // Cancelled / Returned ask first

  const saveStatus = async (order: OrderWithItems, status: OrderStat) => {
    setSaving(order.order_id);
    try {
      const updated = await orderService.updateStatus(order.order_id, status);
      setViewing((v) => (v?.order_id === updated.order_id ? updated : v));
      toast.success(`#${order.order_num} is now ${status}`);
      setCancelling(null);
      orders.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the order');
    } finally {
      setSaving(null);
    }
  };

  const savePayment = async (order: OrderWithItems, decision: 'confirm' | 'reject') => {
    setSaving(order.order_id);
    try {
      setViewing(await orderService.decideGcash(order.order_id, decision));
      toast.success(`Payment for #${order.order_num} ${decision === 'confirm' ? 'confirmed' : 'rejected'}`);
      orders.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the payment');
    } finally {
      setSaving(null);
    }
  };

  const saveRefund = async (order: OrderWithItems, status: RefundStat) => {
    setSaving(order.order_id);
    try {
      await orderService.updateRefund(order.order_id, status);
      toast.success(`Refund for #${order.order_num} is now ${status}`);
      orders.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the refund');
    } finally {
      setSaving(null);
    }
  };

  // cancelling or returning can't be undone, so it asks first
  const changeStatus = (order: OrderWithItems, status: OrderStat) => {
    if (status === order.order_stat) return;
    if (FINAL.includes(status)) setCancelling({ order, status });
    else if (status === 'Shipped' && order.order_stat === 'Pending' && !parseShipping(order.shipping_add).pickup) {
      // a delivery order ships from the receipt page: the QR receipt is printed first, then it's marked Shipped there
      toast.info(`Print the QR receipt for #${order.order_num} first`);
      navigate(`/admin/orders/${order.order_id}/receipt`);
    } else saveStatus(order, status);
  };

  const columns: Column<OrderWithItems>[] = [
    {
      key: 'num',
      header: 'Order #',
      render: (o) => (
        <span className="flex flex-wrap items-center gap-2">
          <button onClick={() => setViewing(o)} className="font-medium text-forest underline-offset-2 hover:underline">
            #{o.order_num}
          </button>
          {o.not_received_at && (
            <button onClick={() => setViewing(o)} className="inline-flex items-center gap-1 rounded-full bg-cancelled px-2 py-0.5 text-[11px] font-semibold text-cancelled-text" title="The customer reported this order as not received">
              <AlertTriangle className="size-3" /> Not received
            </button>
          )}
        </span>
      ),
    },
    { key: 'customer', header: 'Customer', render: (o) => o.customer_name },
    { key: 'item', header: 'Item', render: (o) => <OrderItemsCell order={o} />, className: 'max-w-64' },
    { key: 'total', header: 'Total', render: (o) => <span className="font-medium">{formatPeso(o.total_amt)}</span> },
    {
      key: 'status',
      header: 'Delivery Status',
      render: (o) => (
        <select
          aria-label={`Status of order ${o.order_num}`}
          value={o.order_stat}
          disabled={FINAL.includes(o.order_stat) || saving === o.order_id}
          onChange={(e) => changeStatus(o, e.target.value as OrderStat)}
          className={cn(
            'cursor-pointer rounded-full border-0 py-1 pl-3 pr-8 text-xs font-semibold focus:ring-2 focus:ring-mint disabled:cursor-not-allowed disabled:opacity-80',
            SELECT_STYLE[o.order_stat],
          )}
        >
          {STATUSES.filter((s) => s !== 'Returned' || o.order_stat === 'Shipped').map((s) => (
            <option key={s} value={s} className="bg-white text-ink">
              {s}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'next',
      header: 'Action',
      className: 'whitespace-nowrap',
      render: (o) => {
        const busy = saving === o.order_id;
        const { pickup } = parseShipping(o.shipping_add);
        if (o.order_stat === 'Pending') {
          if (o._temp_payment_status === 'For verification')
            return (
              <Button size="sm" variant="secondary" className={NEXT_STEP} disabled={busy} onClick={() => setViewing(o)}>
                Check payment <ChevronRight className="size-3.5" />
              </Button>
            );
          if (o.payment_method === 'GCash' && o._temp_payment_status !== 'Paid') return <span className="text-xs text-muted">Waiting for payment</span>;
          if (pickup)
            return (
              <Button size="sm" variant="secondary" className={NEXT_STEP} loading={busy} onClick={() => saveStatus(o, 'Shipped')}>
                Ready for pickup <ChevronRight className="size-3.5" />
              </Button>
            );
          return (
            <ButtonLink to={`/admin/orders/${o.order_id}/receipt`} size="sm" variant="secondary" className={NEXT_STEP}>
              <QrCode className="size-3.5" /> Print QR <ChevronRight className="size-3.5" />
            </ButtonLink>
          );
        }
        if (o.order_stat === 'Shipped')
          return (
            <Button size="sm" variant="secondary" className={NEXT_STEP} loading={busy} onClick={() => saveStatus(o, 'Delivered')} title={pickup ? undefined : 'The rider does this by scanning the QR code; use this if they could not'}>
              {pickup ? 'Picked up' : 'Delivered'} <ChevronRight className="size-3.5" />
            </Button>
          );
        if (awaitingReceipt(o)) return <span className="text-xs text-muted">Waiting for customer</span>;
        return <span className="text-muted">–</span>;
      },
    },
    {
      key: 'refund',
      header: 'Refund',
      render: (o) => {
        if (!o.refund) return <span className="text-muted">–</span>;
        const { refund_stat } = o.refund;
        const next = REFUND_NEXT[refund_stat];
        const photos = parseImages(o.refund.photos);
        return (
          <div className="space-y-1.5">
            <select
              aria-label={`Refund status of order ${o.order_num}`}
              title={o.refund.reason}
              value={refund_stat}
              disabled={!next.length || saving === o.order_id}
              onChange={(e) => saveRefund(o, e.target.value as RefundStat)}
              className={cn(
                'cursor-pointer rounded-full border-0 py-1 pl-3 pr-8 text-xs font-semibold focus:ring-2 focus:ring-mint disabled:cursor-not-allowed disabled:opacity-80',
                REFUND_STYLE[refund_stat],
              )}
            >
              {[refund_stat, ...next].map((s) => (
                <option key={s} value={s} className="bg-white text-ink">
                  {s}
                </option>
              ))}
            </select>
            {/* the customer's reason and photos are in the order details; this opens them before deciding */}
            <button type="button" onClick={() => setViewing(o)} className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-forest hover:underline" title={o.refund.reason}>
              <ImageIcon className="size-3.5" /> {photos.length ? `View ${photos.length === 1 ? 'photo' : `${photos.length} photos`}` : 'View reason'}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <AdminPageHeader title="Orders" subtitle="Manage and process customer orders." actions={<TodayChip />} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        <StatCard label="Total Orders" value={all.length} />
        <StatCard label="Pending Orders" value={count('Pending')} tone="amber" />
        <StatCard label="Out for Delivery" value={count('Shipped')} />
        <StatCard label="Cancelled" value={count('Cancelled')} tone="coral" />
        <StatCard label="Refund Requests" value={refundRequests} tone="coral" />
      </div>

      <section className="rounded-card border border-line bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search Order # or Customer..." className="w-full sm:w-64" />
          {/* All stays a button; the statuses are in one dropdown so Export fits on the same line */}
          <FilterPills value={tab === 'all' ? 'all' : ''} onChange={() => setTab('all')} options={[{ value: 'all', label: 'All' }]} />
          <div className="w-44">
            <Select aria-label="Filter by status" value={tab === 'all' ? '' : tab} onChange={(e) => setTab((e.target.value || 'all') as Tab)} className={cn('h-9 rounded-full !py-0 text-sm', tab !== 'all' && 'border-forest bg-mint-light font-medium text-forest')}>
              <option value="">Filter by status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="refund">{refundRequests ? `Refunds (${refundRequests})` : 'Refunds'}</option>
            </Select>
          </div>
          <Dropdown
            className="sm:ml-auto"
            align="right"
            ariaLabel="Export the orders showing"
            buttonClassName={buttonClass('outline', 'sm', !rows.length ? 'pointer-events-none opacity-50' : undefined)}
            label={
              <>
                <Download className="size-4" /> Export <ChevronDown className="size-3.5" />
              </>
            }
          >
            {(close) => (
              <>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-cream"
                  onClick={() => {
                    exportCsv(rows, tab, user?.full_name);
                    close();
                  }}
                >
                  <FileSpreadsheet className="size-4 text-forest" /> Spreadsheet (CSV)
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-cream"
                  onClick={() => {
                    setSavedPdf(exportPdf(rows, tab, user?.full_name));
                    close();
                  }}
                >
                  <FileText className="size-4 text-forest" /> PDF report
                </button>
              </>
            )}
          </Dropdown>
        </div>

        {orders.loading && <LoadingState label="Loading orders..." layout="table" />}
        {orders.error && <ErrorState message={orders.error} onRetry={orders.reload} />}
        {orders.data && rows.length === 0 && <EmptyState title={all.length ? 'No matching orders' : 'No orders yet'} />}
        {rows.length > 0 && (
          <>
            <Table columns={columns} rows={pageRows} rowKey={(o) => o.order_id} />
            <div className="border-t border-line">
              <Pagination page={currentPage} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
            </div>
          </>
        )}
      </section>

      <OrderDetails
        order={viewing}
        onClose={() => setViewing(null)}
        onPayment={savePayment}
        onShip={(o) => saveStatus(o, 'Shipped')}
        saving={saving === viewing?.order_id}
      />
      <ConfirmDialog
        open={!!cancelling}
        title={cancelling?.status === 'Returned' ? 'Mark this order as returned?' : 'Cancel this order?'}
        danger
        loading={saving === cancelling?.order.order_id}
        confirmLabel={cancelling?.status === 'Returned' ? 'Mark as returned' : 'Cancel order'}
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && saveStatus(cancelling.order, cancelling.status)}
        message={
          cancelling?.status === 'Returned' ? (
            <>
              Order <strong className="text-ink">#{cancelling.order.order_num}</strong> will be marked as returned to the store and its stock put back. This can't be
              undone.
            </>
          ) : (
            <>
              Order <strong className="text-ink">#{cancelling?.order.order_num}</strong> will be cancelled and its stock put back. A cancelled order can't be
              reopened.
            </>
          )
        }
      />
      {/* the PDF is already saved; this just offers to open it right away */}
      <ConfirmDialog
        open={!!savedPdf}
        title="PDF downloaded"
        confirmLabel="Open PDF"
        onCancel={closePdf}
        onConfirm={() => {
          if (savedPdf) window.open(savedPdf.url, '_blank', 'noopener');
          closePdf();
        }}
        message={
          <>
            <strong className="text-ink">{savedPdf?.filename}</strong> is in your Downloads folder. Open it now?
          </>
        }
      />
    </>
  );
}
