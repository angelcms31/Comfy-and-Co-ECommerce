import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

// page numbers to show, with "..." for gaps: 1 ... 4 5 6 ... 10
function pageList(page: number, pages: number): (number | '...')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < pages);
  return [1, ...(around[0] > 2 ? ['...' as const] : []), ...around, ...(around[around.length - 1] < pages - 1 ? ['...' as const] : []), pages];
}

interface PaginationProps {
  page: number; // starts at 1
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const arrow = 'grid size-9 place-items-center rounded-full text-forest hover:bg-mint-light disabled:pointer-events-none disabled:opacity-30';

  return (
    <div className="flex flex-col items-center justify-between gap-3 px-2 py-3 sm:flex-row">
      <p className="text-sm text-muted">
        Showing <span className="font-medium text-ink">{from}</span>–<span className="font-medium text-ink">{to}</span> of{' '}
        <span className="font-medium text-ink">{total}</span>
      </p>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button onClick={() => onChange(page - 1)} disabled={page === 1} className={arrow} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === '...' ? (
              <span key={`gap${i}`} className="w-6 text-center text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'size-9 rounded-full text-sm font-medium tabular-nums transition-colors',
                  p === page ? 'bg-forest text-white' : 'text-ink hover:bg-mint-light',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button onClick={() => onChange(page + 1)} disabled={page === pages} className={arrow} aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
