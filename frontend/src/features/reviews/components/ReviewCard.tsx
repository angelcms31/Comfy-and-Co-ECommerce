import type { ReactNode } from 'react';
import { BadgeCheck, Store } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { parseImages } from '@/lib/images';
import type { ReviewWithMeta } from '../review.types';
import StarRating from './StarRating';

// reviews can only be written after delivery, so every reviewer is a verified buyer
export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint-light px-2 py-0.5 text-[11px] font-semibold text-forest">
      <BadgeCheck className="size-3" /> Verified Buyer
    </span>
  );
}

export function ReviewPhotos({ photos }: { photos: string | null }) {
  const list = parseImages(photos);
  if (!list.length) return null;
  return (
    <div className="mt-3 flex gap-2">
      {list.map((src) => (
        <a key={src} href={src} target="_blank" rel="noreferrer" className="size-16 overflow-hidden rounded-lg border border-line sm:size-20">
          <img src={src} alt="Customer photo" loading="lazy" className="size-full object-cover" />
        </a>
      ))}
    </div>
  );
}

export function StoreReply({ reply }: { reply: string }) {
  return (
    <div className="mt-3 rounded-xl bg-cream p-3 text-sm">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-forest">
        <Store className="size-3.5" /> Reply from comfy&amp;co
      </p>
      <p className="text-ink">{reply}</p>
    </div>
  );
}

export default function ReviewCard({ review, showProduct, actions }: { review: ReviewWithMeta; showProduct?: boolean; actions?: ReactNode }) {
  const initial = review.reviewer_name.charAt(0).toUpperCase();
  return (
    <article className="rounded-card border border-line bg-white p-4">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint font-semibold text-forest">{initial}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            {review.reviewer_name} <VerifiedBadge />
            {review.is_featured && <span className="rounded-full bg-butter px-2 py-0.5 text-[11px] font-semibold text-forest">Featured</span>}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <StarRating value={review.rating} />
            <span>{formatDate(review.created_at)}</span>
          </div>
        </div>
        {actions}
      </header>
      {review.content && <p className="mt-3 text-sm leading-relaxed text-ink">{review.content}</p>}
      <ReviewPhotos photos={review.photos} />
      <p className="mt-2 text-xs text-muted">
        {showProduct ? `${review.product_name} · ` : ''}Variant: {review.prod_attr}
      </p>
      {review.reply && <StoreReply reply={review.reply} />}
    </article>
  );
}
