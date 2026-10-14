import type { ReactNode } from 'react';
import { AlertCircle, Loader2, PackageOpen } from 'lucide-react';
import Button from './Button';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted" role="status">
      <Loader2 className="size-6 animate-spin text-forest" />
      <span className="text-sm">{label}</span>
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
