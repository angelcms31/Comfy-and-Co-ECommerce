import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function StarRating({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const icon = size === 'sm' ? 'size-3.5' : 'size-5';
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(icon, n <= Math.round(value) ? 'fill-[#f2b84b] text-[#f2b84b]' : 'fill-line text-line')}
        />
      ))}
    </span>
  );
}
