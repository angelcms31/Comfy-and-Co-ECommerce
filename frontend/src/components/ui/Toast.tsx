import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, Check, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION = 3500;

const styles: Record<ToastType, { title: string; icon: ReactNode; circle: string; bar: string }> = {
  success: { title: 'Success', icon: <Check className="size-7" strokeWidth={3} />, circle: 'bg-mint text-forest', bar: 'bg-forest' },
  error: { title: 'Oops!', icon: <AlertCircle className="size-7" />, circle: 'bg-cancelled text-coral-dark', bar: 'bg-coral-dark' },
  info: { title: 'Heads up', icon: <Info className="size-7" />, circle: 'bg-butter text-forest', bar: 'bg-forest' },
};

let nextId = 1;

// one message at a time, shown as a card in the middle of the screen.
// the page behind stays clickable, it closes by itself or with the X
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);

  const dismiss = useCallback((id: number) => setToast((t) => (t?.id === id ? null : t)), []);

  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId++;
      setToast({ id, type, message });
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const [api] = useState<ToastApi>(() => ({
    success: (m) => show('success', m),
    error: (m) => show('error', m),
    info: (m) => show('info', m),
  }));

  const s = toast && styles[toast.type];

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
        {toast && s && (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto relative w-full max-w-xs animate-pop-in overflow-hidden rounded-2xl bg-white px-6 pb-6 pt-7 text-center shadow-[0_12px_40px_rgb(29_43_38/0.25)] ring-1 ring-line"
          >
            <button onClick={() => dismiss(toast.id)} className="absolute right-3 top-3 rounded-full p-1 text-muted hover:bg-cream hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </button>
            <div className={cn('mx-auto grid size-14 place-items-center rounded-full', s.circle)}>{s.icon}</div>
            <p className="mt-3 font-display text-xl font-semibold text-forest">{s.title}</p>
            <p className="mt-1 text-sm text-ink">{toast.message}</p>
            {/* shrinks to show when it will close */}
            <div
              className={cn('absolute inset-x-0 bottom-0 h-1 origin-left animate-shrink motion-reduce:hidden', s.bar)}
              style={{ animationDuration: `${DURATION}ms` }}
            />
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
