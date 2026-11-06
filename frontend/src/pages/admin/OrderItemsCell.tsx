import { useState } from 'react';
import type { OrderWithItems } from '@/types/models';

const LONG_NAME = 32; // about what fits in the column before it gets cut off

// the items of an order in a table: the first one, and a button to see the rest or a name that's cut off
export default function OrderItemsCell({ order }: { order: OrderWithItems }) {
  const [open, setOpen] = useState(false);
  const { items } = order;
  if (items.length === 0) return <>-</>;

  const toggle = 'shrink-0 whitespace-nowrap text-xs font-medium text-forest underline underline-offset-2 hover:text-forest-light';

  if (open) {
    return (
      <div className="whitespace-normal">
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.order_item_id}>
              {i.item_name} <span className="text-muted">× {i.quantity}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setOpen(false)} className={`mt-1 ${toggle}`}>
          Show less
        </button>
      </div>
    );
  }

  const more = items.length - 1;
  return (
    <span className="flex items-center gap-2">
      <span className="line-clamp-1">{items[0].item_name}</span>
      {(more > 0 || items[0].item_name.length > LONG_NAME) && (
        <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className={toggle}>
          {more > 0 ? `+${more} more` : 'See all'}
        </button>
      )}
    </span>
  );
}
