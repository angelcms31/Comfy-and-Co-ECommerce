import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Star } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ReviewPhotos, StoreReply, VerifiedBadge } from '@/features/reviews/components/ReviewCard';
import StarRating from '@/features/reviews/components/StarRating';
import type { ReviewWithMeta } from '@/features/reviews/review.types';
import { reviewService } from '@/features/reviews/reviewService';
import { useAsync } from '@/hooks/useAsync';
import { categoryService } from '@/services/categoryService';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { firstImage, parseImages } from '@/lib/images';
import AdminPageHeader from './AdminPageHeader';
import { FilterPills, SearchBox, StatCard } from './AdminUi';

const PAGE_SIZE = 4;

function AdminReviewCard({ review, onChanged }: { review: ReviewWithMeta; onChanged: () => void }) {
  const toast = useToast();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const photos = parseImages(review.photos).length;

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      setReplying(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const startReply = () => {
    // a ready-made thank you to edit, like the mockup
    // replies are public, so an anonymous reviewer isn't greeted by name
    const name = review.is_anonymous ? '' : `, ${review.reviewer_name.split(' ')[0]}`;
    setReply(review.reply ?? `Thank you so much for the feedback${name}! We are thrilled you loved the ${review.product_name}.`);
    setReplying(true);
  };

  return (
    <article className={cn('rounded-card border border-line bg-white p-4 sm:p-5', review.is_hidden && 'opacity-60')}>
      <header className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-line font-semibold text-muted">
          {review.reviewer_name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            {review.reviewer_name} <VerifiedBadge />
            {review.is_anonymous && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-muted" title="Shown as Anonymous on the store">
                Posted anonymously
              </span>
            )}
            {review.is_hidden && <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold text-muted">Hidden</span>}
          </p>
          <p className="text-xs text-muted">{formatDate(review.created_at)}</p>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <StarRating value={review.rating} /> ({review.rating.toFixed(1)})
        </span>
      </header>

      <div className="mt-3 flex items-center gap-3">
        <img src={firstImage(review.product_images)} alt="" className="size-12 rounded-lg bg-cream object-contain p-1" />
        <div>
          <p className="text-sm font-semibold text-ink">{review.product_name}</p>
          <span className="rounded-md bg-cream px-2 py-0.5 text-[11px] text-muted">{review.item_category}</span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink">{review.content}</p>
      <ReviewPhotos photos={review.photos} />
      {review.reply && !replying && <StoreReply reply={review.reply} />}

      {replying && (
        <div className="mt-3 space-y-2">
          <Textarea aria-label="Reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" loading={busy} disabled={!reply.trim()} onClick={() => run(() => reviewService.reply(review.review_id, reply.trim()), 'Reply sent')}>
              Send Reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{photos ? `Uploaded ${photos} photo${photos === 1 ? '' : 's'}` : 'No photos'}</p>
        <div className="flex items-center gap-2">
          {!replying && (
            <Button size="sm" variant="outline" onClick={startReply}>
              {review.reply ? 'Edit Reply' : 'Reply'}
            </Button>
          )}
          <Button
            size="sm"
            variant={review.is_featured ? 'secondary' : 'primary'}
            disabled={busy || review.is_hidden}
            onClick={() =>
              run(() => reviewService.setFlags(review.review_id, { is_featured: !review.is_featured }), review.is_featured ? 'Removed from featured' : 'Featured on the product page')
            }
          >
            {review.is_featured ? 'Featured ✓' : 'Feature'}
          </Button>
          <button
            onClick={() => run(() => reviewService.setFlags(review.review_id, { is_hidden: !review.is_hidden }), review.is_hidden ? 'Review is visible again' : 'Review hidden from the store')}
            disabled={busy}
            aria-label={review.is_hidden ? 'Show review' : 'Hide review'}
            title={review.is_hidden ? 'Show on the store' : 'Hide from the store'}
            className="grid size-8 place-items-center rounded-full border border-line text-forest hover:bg-cream disabled:opacity-50"
          >
            {review.is_hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </footer>
    </article>
  );
}

export default function ReviewsPage() {
  const reviews = useAsync(() => reviewService.getAll(), []);
  const categories = useAsync(() => categoryService.getAll(), []);
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('');
  const [categoryId, setCategoryId] = useState('all');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (reviews.data?.reviews ?? []).filter(
      (r) =>
        (!rating || r.rating === Number(rating)) &&
        (categoryId === 'all' || r.item_categ_id === Number(categoryId)) &&
        (!q || [r.reviewer_name, r.content, r.product_name].some((t) => t.toLowerCase().includes(q))),
    );
  }, [reviews.data, search, rating, categoryId]);

  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, rating, categoryId]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const d = reviews.data;

  return (
    <>
      <AdminPageHeader title="Customer Reviews" subtitle="Monitor customer feedback, ratings, and product photos." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Average Rating"
          value={
            <span className="inline-flex items-center gap-1">
              {d?.summary.count ? d.summary.average.toFixed(1) : '–'} <span className="text-sm font-normal text-muted">/ 5.0</span>
              <Star className="size-4 fill-amber text-amber" />
            </span>
          }
        />
        <StatCard label="Total Reviews" value={d?.summary.count ?? '–'} />
        <StatCard label="Pending Replies" value={d?.pendingReplies ?? '–'} tone="amber" />
        <StatCard label="Hidden Reviews" value={d?.hiddenCount ?? '–'} tone="coral" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by customer, review text, or product..." className="w-full flex-1 sm:min-w-64" />
        <div className="w-40">
          <Select aria-label="Rating" value={rating} onChange={(e) => setRating(e.target.value)} className="h-10 rounded-full !py-0">
            <option value="">Rating: All</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? '' : 's'}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <FilterPills
        className="mb-4"
        value={categoryId}
        onChange={setCategoryId}
        options={[{ value: 'all', label: 'All' }, ...(categories.data ?? []).map((c) => ({ value: String(c.item_categ_id), label: c.item_category }))]}
      />

      {reviews.loading && <LoadingState label="Loading reviews..." layout="list" />}
      {reviews.error && <ErrorState message={reviews.error} onRetry={reviews.reload} />}
      {d && rows.length === 0 && (
        <EmptyState
          title={d.reviews.length ? 'No matching reviews' : 'No reviews yet'}
          message={d.reviews.length ? 'Try another search or filter.' : 'Customers can review items after their order is delivered.'}
        />
      )}
      {rows.length > 0 && (
        <div className="space-y-4">
          {pageRows.map((r) => (
            <AdminReviewCard key={r.review_id} review={r} onChanged={reviews.reload} />
          ))}
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
        </div>
      )}
    </>
  );
}
