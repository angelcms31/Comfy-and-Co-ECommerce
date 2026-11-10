import type { ReactNode } from 'react';
import { MAX_SEARCH } from '@/lib/constants';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/cn';

// small pieces shared by the admin pages

export function TodayChip() {
  const today = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <CalendarDays className="size-4 text-forest" /> Today: {today}
    </span>
  );
}

export function StatCard({ label, value, icon, tone = 'forest' }: { label: string; value: ReactNode; icon?: ReactNode; tone?: 'forest' | 'amber' | 'coral' }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-white p-4">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p
          className={cn(
            'mt-1 font-display text-2xl font-semibold',
            tone === 'forest' && 'text-forest',
            tone === 'amber' && 'text-amber',
            tone === 'coral' && 'text-coral-dark',
          )}
        >
          {value}
        </p>
      </div>
      {icon && <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream text-forest">{icon}</span>}
    </div>
  );
}

// a row of rounded filter buttons; the selected one is dark green
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode; activeClass?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm',
            value === o.value ? (o.activeClass ?? 'border-forest bg-forest text-white') : 'border-forest/40 bg-white text-forest hover:bg-mint-light',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <input
      type="search"
      maxLength={MAX_SEARCH}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        'h-10 rounded-full border border-line bg-white bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%235c6b65%27 stroke-width=%272%27 viewBox=%270 0 24 24%27%3E%3Ccircle cx=%2711%27 cy=%2711%27 r=%278%27/%3E%3Cpath d=%27m21 21-4.3-4.3%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[position:12px_center] bg-no-repeat pl-9 pr-3 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-mint',
        className,
      )}
    />
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-card border border-line bg-white p-4 sm:p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-xl font-semibold text-forest">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
