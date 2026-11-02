import { cn } from '@/lib/cn';

// used everywhere something is loading instead of a spinning circle. Dots use the text color.
export default function LoadingDots({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  const dot = size === 'sm' ? 'size-1.5' : 'size-2.5';
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className={cn('rounded-full bg-current animate-dot-hop motion-reduce:animate-none', dot)}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
