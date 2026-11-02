import { useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Package } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import StatusPill from '@/components/ui/StatusPill';
import { useAsync } from '@/hooks/useAsync';
import { orderService } from '@/services/orderService';
import { formatDateTime } from '@/lib/dates';
import { formatPeso } from '@/lib/pricing';
import NotFound from '../NotFound';

export default function OrderConfirmationPage() {
  const orderId = Number(useParams().orderId);
  const justPlaced = !!(useLocation().state as { placed?: boolean } | null)?.placed;
  const { data: order, loading, error, reload } = useAsync(() => orderService.getById(orderId), [orderId]);

  if (!Number.isInteger(orderId)) return <NotFound />;
  if (loading) return <LoadingState label="Loading your order..." />;
  if (error) return error.toLowerCase().includes('not found') ? <NotFound /> : <ErrorState message={error} onRetry={reload} />;
  if (!order) return <NotFound />;

  const itemsTotal = order.items.reduce((sum, i) => sum + i.sub_total, 0);
  const fee = order.total_amt - itemsTotal;

  return (
    <div className="container-page max-w-2xl py-8 sm:py-12">
      <div className="rounded-card border border-line bg-white p-6 text-center shadow-card sm:p-8">
        {justPlaced ? (
          <>
            <CheckCircle2 className="mx-auto size-14 text-forest" />
            <h1 className="mt-3 text-3xl font-semibold text-forest">Thank you for your order!</h1>
            <p className="mt-1 text-sm text-muted">We've received it and will get it ready soon.</p>
          </>
        ) : (
          <>
            <Package className="mx-auto size-12 text-forest" />
            <h1 className="mt-3 text-3xl font-semibold text-forest">Order details</h1>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="font-semibold text-ink">{order.order_num}</span>
          <StatusPill status={order.order_stat} />
          <span className="text-muted">· {formatDateTime(order.placed_at)}</span>
        </div>

        <ul className="mt-6 divide-y divide-line border-y border-line text-left text-sm">
          {order.items.map((i) => (
            <li key={i.order_item_id} className="flex justify-between gap-3 py-3">
              <span className="text-ink">
                {i.item_name} <span className="text-muted">× {i.quantity}</span>
              </span>
              <span className="font-medium">{formatPeso(i.sub_total)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 text-left text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Items</dt>
            <dd>{formatPeso(itemsTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Delivery Fee</dt>
            <dd>{fee > 0 ? formatPeso(fee) : 'Free'}</dd>
          </div>
          <div className="flex justify-between pt-2 text-lg font-semibold text-forest">
            <dt className="font-display">Total</dt>
            <dd>{formatPeso(order.total_amt)}</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-1 rounded-xl bg-cream p-4 text-left text-sm">
          <p>
            <span className="text-muted">Payment: </span>
            {order.payment_method === 'COD' ? 'Cash on Delivery' : 'GCash'}
          </p>
          <p>
            <span className="text-muted">Ship to: </span>
            {order.shipping_add}
          </p>
          {order.payment_method === 'GCash' && order.order_stat === 'Pending' && (
            <p className="pt-1 text-xs text-muted">We'll text the GCash payment details to your mobile number.</p>
          )}
        </div>

        <ButtonLink to="/products" size="lg" className="mt-6 w-full sm:w-auto sm:px-10">
          Continue shopping
        </ButtonLink>
      </div>
    </div>
  );
}
