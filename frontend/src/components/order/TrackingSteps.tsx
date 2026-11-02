import { Check, ClipboardList, House, Package, Store, Truck, XCircle } from 'lucide-react';
import type { OrderStat } from '@/types/db';
import { cn } from '@/lib/cn';

const STEP_OF: Record<OrderStat, number> = { Pending: 1, Shipped: 2, Delivered: 3, Cancelled: 0 };

// Shopee-style row of steps: placed -> preparing -> on the way -> delivered
export default function TrackingSteps({ status, pickup, courier }: { status: OrderStat; pickup: boolean; courier: string | null }) {
  if (status === 'Cancelled') {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-cancelled px-4 py-3 text-sm font-medium text-cancelled-text">
        <XCircle className="size-5 shrink-0" /> This order was cancelled.
      </p>
    );
  }

  const steps: { icon: typeof Truck; label: string; sub?: string | null }[] = [
    { icon: ClipboardList, label: 'Order placed' },
    { icon: Package, label: 'Preparing' },
    pickup ? { icon: Store, label: 'Ready for pickup' } : { icon: Truck, label: 'On the way', sub: courier },
    pickup ? { icon: Check, label: 'Picked up' } : { icon: House, label: 'Delivered' },
  ];
  const current = STEP_OF[status];

  return (
    <ol className="grid grid-cols-4">
      {steps.map(({ icon: Icon, label, sub }, i) => {
        const reached = i <= current;
        return (
          <li key={label} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span className={cn('absolute right-1/2 top-5 h-1 w-full -translate-y-1/2', i <= current ? 'bg-forest' : 'bg-line')} aria-hidden />
            )}
            <span
              className={cn(
                'relative z-10 grid size-10 place-items-center rounded-full border-2',
                reached ? 'border-forest bg-forest text-white' : 'border-line bg-white text-muted',
                i === current && i < 3 && 'ring-4 ring-mint',
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className={cn('mt-2 px-1 text-[11px] leading-tight sm:text-xs', reached ? 'font-semibold text-forest' : 'text-muted')}>{label}</span>
            {sub && <span className="mt-0.5 px-1 text-[10px] leading-tight text-muted sm:text-[11px]">{sub}</span>}
          </li>
        );
      })}
    </ol>
  );
}
