import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import StatusPill from '@/components/ui/StatusPill';
import Table, { type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { orderService } from '@/services/orderService';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/dates';
import { formatPeso } from '@/lib/pricing';
import { parseShipping } from '@/lib/tracking';
import type { OrderStat, RefundStat } from '@/types/db';
import type { OrderWithItems } from '@/types/models';
import AdminPageHeader from './AdminPageHeader';
import { FilterPills, SearchBox, StatCard, TodayChip } from './AdminUi';

const PAGE_SIZE = 8;
const STATUSES: OrderStat[] = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

const SELECT_STYLE: Record<OrderStat, string> = {
  Pending: 'bg-pending text-pending-text',
  Shipped: 'bg-mint text-forest',
  Delivered: 'bg-forest text-white',
  Cancelled: 'bg-cancelled text-cancelled-text',
};

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
  Refunded: 'bg-forest text-white',
};

type Tab = OrderStat | 'all' | 'refund';

const itemSummary = (o: OrderWithItems) =>
  o.items.length === 0 ? '-' : o.items[0].item_name + (o.items.length > 1 ? ` +${o.items.length - 1} more` : '');

// the orders that are showing, as a spreadsheet file
function exportCsv(orders: OrderWithItems[]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ['Order #', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Placed', 'Ship to'],
    ...orders.map((o) => [
      o.order_num,
      o.customer_name,
      o.items.map((i) => `${i.item_name} x${i.quantity}`).join('; '),
      o.total_amt,
      o.payment_method,
      o.order_stat,
      formatDateTime(o.placed_at),
      parseShipping(o.shipping_add).address,
    ]),
  ];
  const blob = new Blob(['﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `comfyco-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function OrderDetails({ order, onClose }: { order: OrderWithItems | null; onClose: () => void }) {
  if (!order) return null;
  const { pickup, courier, address, cancelReason } = parseShipping(order.shipping_add);
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
          <dd>{order.payment_method === 'COD' ? 'Cash on Delivery' : 'GCash'}</dd>
          <dt className="text-muted">Fulfilment</dt>
          <dd>{pickup ? 'Store pickup' : `Standard Delivery${courier ? ` via ${courier}` : ''}`}</dd>
          <dt className="text-muted">{pickup ? 'Customer address' : 'Ship to'}</dt>
          <dd>{address}</dd>
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
              </dd>
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
      </div>
    </Modal>
  );
}

export default function OrdersPage() {
  const toast = useToast();
  const orders = useAsync(() => orderService.getAll(), []);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<OrderWithItems | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const all = orders.data ?? [];
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

  const [cancelling, setCancelling] = useState<OrderWithItems | null>(null);

  const saveStatus = async (order: OrderWithItems, status: OrderStat) => {
    setSaving(order.order_id);
    try {
      await orderService.updateStatus(order.order_id, status);
      toast.success(`#${order.order_num} is now ${status}`);
      setCancelling(null);
      orders.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the order');
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

  // cancelling can't be undone, so it asks first
  const changeStatus = (order: OrderWithItems, status: OrderStat) => {
    if (status === order.order_stat) return;
    if (status === 'Cancelled') setCancelling(order);
    else saveStatus(order, status);
  };

  const columns: Column<OrderWithItems>[] = [
    {
      key: 'num',
      header: 'Order #',
      render: (o) => (
        <button onClick={() => setViewing(o)} className="font-medium text-forest underline-offset-2 hover:underline">
          #{o.order_num}
        </button>
      ),
    },
    { key: 'customer', header: 'Customer', render: (o) => o.customer_name },
    { key: 'item', header: 'Item', render: (o) => <span className="line-clamp-1">{itemSummary(o)}</span>, className: 'max-w-64' },
    { key: 'total', header: 'Total', render: (o) => <span className="font-medium">{formatPeso(o.total_amt)}</span> },
    {
      key: 'status',
      header: 'Delivery Status',
      render: (o) => (
        <select
          aria-label={`Status of order ${o.order_num}`}
          value={o.order_stat}
          disabled={o.order_stat === 'Cancelled' || saving === o.order_id}
          onChange={(e) => changeStatus(o, e.target.value as OrderStat)}
          className={cn(
            'cursor-pointer rounded-full border-0 py-1 pl-3 pr-7 text-xs font-semibold focus:ring-2 focus:ring-mint disabled:cursor-not-allowed disabled:opacity-80',
            SELECT_STYLE[o.order_stat],
          )}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-white text-ink">
              {s}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'refund',
      header: 'Refund',
      render: (o) => {
        if (!o.refund) return <span className="text-muted">–</span>;
        const { refund_stat } = o.refund;
        const next = REFUND_NEXT[refund_stat];
        return (
          <select
            aria-label={`Refund status of order ${o.order_num}`}
            title={o.refund.reason}
            value={refund_stat}
            disabled={!next.length || saving === o.order_id}
            onChange={(e) => saveRefund(o, e.target.value as RefundStat)}
            className={cn(
              'cursor-pointer rounded-full border-0 py-1 pl-3 pr-7 text-xs font-semibold focus:ring-2 focus:ring-mint disabled:cursor-not-allowed disabled:opacity-80',
              REFUND_STYLE[refund_stat],
            )}
          >
            {[refund_stat, ...next].map((s) => (
              <option key={s} value={s} className="bg-white text-ink">
                {s}
              </option>
            ))}
          </select>
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
          <FilterPills
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all' as const, label: 'All' },
              ...STATUSES.map((s) => ({ value: s as Tab, label: s })),
              { value: 'refund' as const, label: refundRequests ? `Refunds (${refundRequests})` : 'Refunds' },
            ]}
          />
          <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => exportCsv(rows)} disabled={!rows.length}>
            <Download className="size-4" /> Export CSV
          </Button>
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

      <OrderDetails order={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={!!cancelling}
        title="Cancel this order?"
        danger
        loading={saving === cancelling?.order_id}
        confirmLabel="Cancel order"
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && saveStatus(cancelling, 'Cancelled')}
        message={
          <>
            Order <strong className="text-ink">#{cancelling?.order_num}</strong> will be cancelled and its stock put back. A cancelled order can't be
            reopened.
          </>
        }
      />
    </>
  );
}
