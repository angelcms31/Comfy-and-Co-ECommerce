import { EWALLET_INFO, EWALLETS, type Ewallet } from '@/lib/constants';
import { cn } from '@/lib/cn';

// the e-wallets one under another, each with its logo: on checkout (under "E-wallet") and on the payment page
export default function WalletPicker({ value, onChange, className }: { value: Ewallet; onChange: (wallet: Ewallet) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="E-wallet" className={cn('space-y-2', className)}>
      {EWALLETS.map((w) => {
        const on = value === w;
        return (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(w)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
              on ? 'border-forest bg-mint-light' : 'border-line bg-white hover:border-forest/50',
            )}
          >
            <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border-2', on ? 'border-forest' : 'border-ink/30')}>
              {on && <span className="size-2 rounded-full bg-forest" />}
            </span>
            <img src={EWALLET_INFO[w].logo} alt="" className="size-8 shrink-0 rounded-lg object-contain" />
            <span className="min-w-0">
              <span className="block font-medium text-ink">{w}</span>
              <span className="block text-xs text-muted">{EWALLET_INFO[w].note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
