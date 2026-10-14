import type { ProdVar } from '@/types/db';
import { formatPeso, getEffectivePrice } from '@/lib/pricing';
import { cn } from '@/lib/cn';

interface PriceTagProps {
  variant: Pick<ProdVar, 'b_price' | 'pr_price' | 'pr_start' | 'pr_end'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' };

export default function PriceTag({ variant, size = 'md', className }: PriceTagProps) {
  const { price, original } = getEffectivePrice(variant);
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2', className)}>
      <span className={cn('font-semibold', original ? 'text-coral-dark' : 'text-forest', sizes[size])}>{formatPeso(price)}</span>
      {original && <s className="text-xs text-muted">{formatPeso(original)}</s>}
    </span>
  );
}
