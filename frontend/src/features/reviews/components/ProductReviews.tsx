import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import Button from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { reviewService } from '../reviewService';
import RatingSummary from './RatingSummary';
import ReviewCard from './ReviewCard';

const PAGE = 4;

export default function ProductReviews({ productId }: { productId: number }) {
  const { data, loading, error, reload } = useAsync(() => reviewService.getForProduct(productId), [productId]);
  const [shown, setShown] = useState(PAGE);

  return (
    <section aria-labelledby="reviews-title" className="rounded-card bg-white/70 p-5 sm:p-8">
      <h2 id="reviews-title" className="mb-6 text-2xl font-semibold text-forest">
        Ratings &amp; reviews
      </h2>

      {loading && <LoadingState label="Loading reviews..." />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.reviews.length === 0 && (
        <EmptyState icon={<MessageSquareText className="size-7" />} title="No reviews yet" message="Be the first to review this after your order arrives." />
      )}
      {data && data.reviews.length > 0 && (
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <RatingSummary summary={data.summary} />
          <div className="space-y-3">
            {data.reviews.slice(0, shown).map((r) => (
              <ReviewCard key={r.review_id} review={r} />
            ))}
            {shown < data.reviews.length && (
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                Show more reviews
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
