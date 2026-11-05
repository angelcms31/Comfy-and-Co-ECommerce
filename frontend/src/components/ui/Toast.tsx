import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Check, Info } from 'lucide-react';
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

const styles: Record<ToastType, { title: string; icon: ReactNode; circle: string }> = {
  success: { title: 'Success', icon: <Check className="size-7" strokeWidth={3} />, circle: 'bg-mint text-forest' },
  error: { title: 'Oops!', icon: <AlertCircle className="size-7" />, circle: 'bg-cancelled text-coral-dark' },
  info: { title: 'Heads up', icon: <Info className="size-7" />, circle: 'bg-butter text-forest' },
};

// errors stay a bit longer, and long messages get enough time to be read
function secondsOnScreen({ type, message }: ToastItem) {
  return Math.max(type === 'error' ? 5 : 3, message.length * 0.06);
}

let nextId = 1;

// one message at a time, shown as a card in the middle of the screen. It goes away by itself, a new message
// replaces the old one, and clicks pass through it so it never blocks what's underneath.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), secondsOnScreen(toast) * 1000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const show =useCallback((type: ToastType, message: string) => setToast({ id: nextId++, type, message }), []);

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
            className="relative w-full max-w-xs animate-pop-in overflow-hidden rounded-2xl bg-white px-6 py-6 text-center shadow-[0_12px_40px_rgb(29_43_38/0.25)] ring-1 ring-line"
          >
            <div className={cn('mx-auto grid size-14 place-items-center rounded-full', s.circle)}>{s.icon}</div>
            <p className="mt-3 font-display text-xl font-semibold text-forest">{s.title}</p>
            <p className="mt-1 text-sm text-ink">{toast.message}</p>
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
