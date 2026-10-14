import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, PhilippinePeso, ShoppingCart, Star } from 'lucide-react';
import StatusPill from '@/components/ui/StatusPill';
import Table, { type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { reviewService } from '@/features/reviews/reviewService';
import { dashboardService } from '@/services/dashboardService';
import { useAsync } from '@/hooks/useAsync';
import { DAILY_SALES_TARGET, LOW_STOCK_LIMIT } from '@/lib/constants';
import { formatPeso } from '@/lib/pricing';
import type { OrderWithItems } from '@/types/models';
import AdminPageHeader from './AdminPageHeader';
import SalesChart from './SalesChart';

function StatCard({ label, value, icon, hint }: { label: string; value: ReactNode; icon: ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card bg-white p-4 shadow-card">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint-light text-forest">{icon}</span>
    </div>
  );
}

const itemSummary = (o: OrderWithItems) =>
  o.items.length === 0 ? '-' : o.items[0].item_name + (o.items.length > 1 ? ` +${o.items.length - 1} more` : '');

const columns: Column<OrderWithItems>[] = [
  { key: 'num', header: 'Order #', render: (o) => <span className="font-medium">{o.order_num}</span> },
  { key: 'customer', header: 'Customer', render: (o) => o.customer_name },
  { key: 'item', header: 'Item', render: (o) => <span className="line-clamp-1">{itemSummary(o)}</span>, className: 'max-w-64' },
  { key: 'total', header: 'Total', render: (o) => <span className="font-medium">{formatPeso(o.total_amt)}</span> },
  { key: 'status', header: 'Status', render: (o) => <StatusPill status={o.order_stat} /> },
];

export default function DashboardPage() {
  const summary = useAsync(() => dashboardService.getSummary(), []);
  const reviews = useAsync(() => reviewService.getAll(), []);

  const todayLabel = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <>
      <AdminPageHeader
        title="Overview"
        subtitle="Managing comfy&co furniture operations."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink">
            <CalendarDays className="size-4 text-forest" />
            Today, {todayLabel}
          </span>
        }
      />

      {summary.loading && <LoadingState label="Loading dashboard..." />}
      {summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}

      {summary.data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard label="Sales Today" value={formatPeso(summary.data.salesToday)} icon={<PhilippinePeso className="size-4" />} />
            <StatCard label="Orders Today" value={summary.data.ordersToday} icon={<ShoppingCart className="size-4" />} hint={`${summary.data.pendingOrders} pending`} />
            <StatCard
              label="Low Stock Items"
              value={summary.data.lowStockCount}
              icon={<AlertTriangle className="size-4" />}
              hint={`${LOW_STOCK_LIMIT} or fewer left`}
            />
            <StatCard
              label="Avg. Rating"
              value={
                reviews.data ? (
                  <span className="inline-flex items-center gap-1">
                    {reviews.data.summary.average.toFixed(1)} <Star className="size-5 fill-[#f2b84b] text-[#f2b84b]" />
                  </span>
                ) : (
                  '–'
                )
              }
              icon={<Star className="size-4" />}
              hint={reviews.data ? `${reviews.data.summary.count} reviews` : undefined}
            />
          </div>

          <section className="rounded-card bg-white p-4 shadow-card sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-forest">Sales - Last 7 Days</h2>
              <p className="flex items-center gap-2 text-xs text-muted">
                <span className="inline-block w-5 border-t-2 border-dashed border-coral-dark" />
                Target {formatPeso(DAILY_SALES_TARGET)} / day
              </p>
            </div>
            <SalesChart days={summary.data.last7Days} />
          </section>

          <section className="rounded-card bg-white shadow-card">
            <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
              <h2 className="text-lg font-semibold text-forest">Recent Orders</h2>
              <Link to="/admin/orders" className="text-sm text-forest hover:underline">
                View all
              </Link>
            </div>
            {summary.data.recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              <div className="p-2 sm:p-3">
                <Table columns={columns} rows={summary.data.recentOrders} rowKey={(o) => o.order_id} />
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
