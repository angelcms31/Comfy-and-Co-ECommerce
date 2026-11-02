import type { ReactNode } from 'react';
import { AlertCircle, PackageOpen } from 'lucide-react';
import { cn } from '@/lib/cn';
import Button from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} />;
}

// a card made of skeleton bars: photo on the left, lines of text next to it
function SkeletonRow() {
  return (
    <div className="flex gap-4 rounded-card border border-line bg-white p-4">
      <Skeleton className="size-16 shrink-0 rounded-lg sm:size-20" />
      <div className="flex-1 space-y-2.5 py-1">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="hidden h-4 w-16 sm:block" />
    </div>
  );
}

const LAYOUTS = {
  // title, two cards, a few lines
  page: (
    <>
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-4 w-1/5" />
      <div className="grid grid-cols-2 gap-4 pt-2">
        <Skeleton className="h-28 rounded-xl sm:h-36" />
        <Skeleton className="h-28 rounded-xl sm:h-36" />
      </div>
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/4" />
    </>
  ),
  // orders, cart, wishlist, reviews
  list: (
    <>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </>
  ),
  // product or order page: big picture next to the details
  detail: (
    <div className="grid gap-6 sm:grid-cols-2">
      <Skeleton className="aspect-square rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-4 h-11 w-1/2 rounded-full" />
      </div>
    </div>
  ),
  // admin tables
  table: (
    <>
      <Skeleton className="h-9 w-full rounded-lg" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </>
  ),
};

// label is only read out by screen readers, the skeleton is what people see
export function LoadingState({ label = 'Loading...', layout = 'page' }: { label?: string; layout?: keyof typeof LAYOUTS }) {
  return (
    <div className="w-full space-y-3 py-6" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {LAYOUTS[layout]}
    </div>
  );
}

export function EmptyState({ title, message, icon, action }: { title: string; message?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="rounded-full bg-mint-light p-4 text-forest">{icon ?? <PackageOpen className="size-7" />}</div>
      <h3 className="text-xl font-semibold text-forest">{title}</h3>
      {message && <p className="max-w-sm text-sm text-muted">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center" role="alert">
      <AlertCircle className="size-8 text-coral-dark" />
      <p className="text-sm text-muted">{message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
