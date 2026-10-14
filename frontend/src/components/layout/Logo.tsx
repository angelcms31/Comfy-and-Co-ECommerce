import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return <img src="/logo.png" alt="" className={cn('size-10', className)} />;
}

export default function Logo({ to = '/', showText = false, className }: { to?: string; showText?: boolean; className?: string }) {
  return (
    <Link to={to} className={cn('flex shrink-0 items-center gap-2', className)} aria-label="comfy&co home">
      <LogoMark />
      {showText && <span className="font-display text-2xl font-semibold text-white">comfy&amp;co</span>}
    </Link>
  );
}
