import type { ReactNode } from 'react';
import { formatDate } from '@/lib/dates';
import type { ReviewWithMeta } from '../review.types';
import StarRating from './StarRating';

export default function ReviewCard({ review, showProduct, actions }: { review: ReviewWithMeta; showProduct?: boolean; actions?: ReactNode }) {
  const initial = review.reviewer_name.charAt(0).toUpperCase();
  return (
    <article className="rounded-card border border-line bg-white p-4">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint font-semibold text-forest">{initial}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{review.reviewer_name}</p>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <StarRating value={review.rating} />
            {review._temp_created_at && <span>{formatDate(review._temp_created_at)}</span>}
          </div>
        </div>
        {actions}
      </header>
      <p className="mt-3 text-sm leading-relaxed text-ink">{review.content}</p>
      <p className="mt-2 text-xs text-muted">
        {showProduct ? `${review.product_name} · ` : ''}Variant: {review.prod_attr}
      </p>
    </article>
  );
}
