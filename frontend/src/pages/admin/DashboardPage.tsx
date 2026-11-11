import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Heart, PhilippinePeso, ShoppingCart, Star } from 'lucide-react';
import { Select } from '@/components/ui/Input';
import StatusPill from '@/components/ui/StatusPill';
import Table, { type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { dashboardService } from '@/services/dashboardService';
import { useAsync } from '@/hooks/useAsync';
import { firstImage } from '@/lib/images';
import { formatPeso } from '@/lib/pricing';
import type { OrderStat } from '@/types/db';
import type { SalesRange } from '@/types/admin';
import type { OrderWithItems } from '@/types/models';
import AdminPageHeader from './AdminPageHeader';
import OrderItemsCell from './OrderItemsCell';
import { Card, StatCard, TodayChip } from './AdminUi';
import SalesChart, { ChartLegend, ForecastSummary } from './SalesChart';

const RANGES: { value: SalesRange; label: string; unit: 'day' | 'week' | 'month' }[] = [
  { value: '7d', label: 'Last 7 Days', unit: 'day' },
  { value: '30d', label: 'Last 30 Days', unit: 'week' },
  { value: '12m', label: 'Monthly (12 months)', unit: 'month' },
  { value: '24m', label: 'Long Term (2 years)', unit: 'month' },
];

const columns: Column<OrderWithItems>[] = [
  { key: 'num', header: 'Order #', render: (o) => <span className="font-medium">#{o.order_num}</span> },
  { key: 'customer', header: 'Customer', render: (o) => o.customer_name },
  { key: 'item', header: 'Item', render: (o) => <OrderItemsCell order={o} />, className: 'max-w-64' },
  { key: 'total', header: 'Total', render: (o) => <span className="font-medium">{formatPeso(o.total_amt)}</span> },
  { key: 'status', header: 'Status', render: (o) => <StatusPill status={o.order_stat} /> },
];

export default function DashboardPage() {
  const [range, setRange] = useState<SalesRange>('7d');
  const [status, setStatus] = useState<OrderStat | ''>('');
  const summary = useAsync(() => dashboardService.getSummary(range), [range]);
  const recent = (summary.data?.recentOrders ?? []).filter((o) => !status || o.order_stat === status);

  return (
    <>
      <AdminPageHeader title="Overview" subtitle="Managing comfy&co furniture operations." actions={<TodayChip />} />

      {summary.loading && !summary.data && <LoadingState label="Loading dashboard..." />}
      {summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}

      {summary.data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard label="Sales Today" value={formatPeso(summary.data.salesToday)} icon={<PhilippinePeso className="size-4" />} />
            <StatCard label="Orders" value={summary.data.ordersToday} icon={<ShoppingCart className="size-4" />} />
            <StatCard label="Low Stock Items" value={summary.data.lowStockCount} icon={<AlertTriangle className="size-4" />} tone="coral" />
            <StatCard
              label="Avg. Rating"
              value={
                <span className="inline-flex items-center gap-1">
                  {summary.data.reviewCount ? summary.data.avgRating.toFixed(1) : '–'} <Star className="size-5 fill-amber text-amber" />
                </span>
              }
              icon={<Star className="size-4" />}
            />
          </div>

          <Card
            title={
              <span className="flex flex-wrap items-center gap-3">
                Sales
                <span className="w-48 font-sans text-sm font-normal">
                  <Select aria-label="Sales range" value={range} onChange={(e) => setRange(e.target.value as SalesRange)} className="h-9 !py-0">
                    {RANGES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </span>
              </span>
            }
            actions={<ChartLegend />}
          >
            <SalesChart data={summary.data.chart} />
            <ForecastSummary data={summary.data.chart} unit={RANGES.find((r) => r.value === range)?.unit ?? 'day'} />
          </Card>

          <Card title="Most Liked" actions={<span className="text-sm text-muted">Saved to customers' Likes</span>}>
            {summary.data.mostLiked.length === 0 ? (
              <EmptyState title="No likes yet" />
            ) : (
              <ol className="divide-y divide-line">
                {summary.data.mostLiked.map((p, i) => {
                  const img = firstImage(p.images);
                  return (
                    <li key={p.product_id} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 shrink-0 text-center font-display text-lg font-semibold text-forest">{i + 1}</span>
                      {img ? (
                        <img src={img} alt="" className="size-11 shrink-0 rounded-lg border border-line object-cover" />
                      ) : (
                        <span className="size-11 shrink-0 rounded-lg bg-cream" />
                      )}
                      <Link to={`/products/${p.product_id}`} target="_blank" className="min-w-0 flex-1 truncate font-medium text-ink hover:text-forest hover:underline">
                        {p.product_name}
                      </Link>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-coral/20 px-2.5 py-1 text-sm font-semibold text-coral-dark">
                        <Heart className="size-3.5 fill-current" /> {p.likes}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card
            title="Recent Orders"
            actions={
              <div className="flex items-center gap-3">
                <div className="w-36">
                  <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as OrderStat | '')} className="h-9 !py-0">
                    <option value="">Status: All</option>
                    <option value="Pending">Pending</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </Select>
                </div>
                <Link to="/admin/orders" className="text-sm text-forest hover:underline">
                  View all
                </Link>
              </div>
            }
          >
            {recent.length === 0 ? (
              <EmptyState title="No orders here" />
            ) : (
              <Table columns={columns} rows={recent} rowKey={(o) => o.order_id} />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
