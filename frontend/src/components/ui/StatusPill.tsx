import type { OrderStat } from '@/types/db';
import { cn } from '@/lib/cn';

const styles: Record<OrderStat, string> = {
  Pending: 'bg-pending text-pending-text',
  Shipped: 'bg-mint text-forest',
  Delivered: 'bg-forest text-white',
  Cancelled: 'bg-cancelled text-cancelled-text',
};

export default function StatusPill({ status, className }: { status: OrderStat; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', styles[status], className)}>
      {status}
    </span>
  );
}
