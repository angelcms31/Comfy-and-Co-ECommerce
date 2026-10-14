import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function QuantityStepper({ value, max, onChange, disabled, size = 'md' }: QuantityStepperProps) {
  const btn = cn('grid place-items-center text-forest hover:bg-mint-light disabled:text-line disabled:hover:bg-transparent', size === 'sm' ? 'size-7' : 'size-10');
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white">
      <button className={cn(btn, 'rounded-l-full')} onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="Decrease quantity">
        <Minus className="size-4" />
      </button>
      <span className={cn('min-w-8 text-center font-medium tabular-nums', size === 'sm' ? 'text-sm' : 'text-base')} aria-live="polite">
        {value}
      </span>
      <button className={cn(btn, 'rounded-r-full')} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
