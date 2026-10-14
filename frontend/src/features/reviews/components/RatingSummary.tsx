import type { RatingSummary as Summary } from '../review.types';
import StarRating from './StarRating';

export default function RatingSummary({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-col gap-5 self-start sm:flex-row sm:items-center sm:gap-8">
      <div className="text-center sm:text-left">
        <p className="font-display text-5xl font-semibold text-forest">{summary.average.toFixed(1)}</p>
        <StarRating value={summary.average} size="md" />
        <p className="mt-1 text-xs text-muted">
          {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
        </p>
      </div>
      <div className="flex-1 space-y-1.5">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const n = summary.breakdown[star] ?? 0;
          const pct = summary.count ? (n / summary.count) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs text-muted">
              <span className="w-3 text-right">{star}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/70">
                <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-5 tabular-nums">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
