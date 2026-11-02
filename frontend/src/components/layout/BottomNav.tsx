import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

// tab bar fixed to the bottom on phones and tablets, like the Facebook app.
// the layouts add bottom padding (BOTTOM_NAV_SPACE) so it never covers the page
export const BOTTOM_NAV_SPACE = 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0';

export default function BottomNav({ children, label }: { children: ReactNode; label: string }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-forest pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-4px_14px_rgb(29_43_38/0.15)] lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-2xl grid-flow-col auto-cols-fr">{children}</div>
    </nav>
  );
}

interface TabProps {
  to?: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}

export function BottomTab({ to, label, icon, active, badge, onClick }: TabProps) {
  const className = cn(
    'relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
    active ? 'text-mint' : 'text-white/65 hover:text-white',
  );
  const inner = (
    <>
      <span className={cn('absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-mint transition-opacity', active ? 'opacity-100' : 'opacity-0')} />
      <span className="relative">
        {icon}
        {!!badge && (
          <span className="absolute -right-2.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-coral-dark px-1 text-[11px] font-semibold leading-5 text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {label}
    </>
  );

  return to ? (
    <Link to={to} className={className} aria-current={active ? 'page' : undefined} aria-label={badge ? `${label} (${badge})` : undefined}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={className} aria-expanded={active}>
      {inner}
    </button>
  );
}
