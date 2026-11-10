import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { MAX_EMAIL } from '@/lib/constants';

interface FieldProps {
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  filled?: boolean; // cream background with no border, like the login form
  invalid?: boolean; // red border without a message under it
}

function fieldClass({ error, filled, invalid }: FieldProps) {
  const bad = !!error || invalid;
  return cn(
    'w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70',
    'focus:outline-none focus:ring-2 focus:ring-mint disabled:text-muted',
    bad ? 'border-coral-dark' : filled ? 'border-transparent' : 'border-line focus:border-forest',
    filled && !bad ? 'bg-cream focus:bg-white' : 'bg-white',
    !filled && 'disabled:bg-cream',
  );
}

function Field({ id, label, error, hint, className, children }: FieldProps & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-coral-dark">{error}</p> : hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function Input({ label, error, hint, filled, invalid, className, id, maxLength, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  // email boxes stop at 30 characters unless a form sets its own limit (e.g. supplier emails)
  const limit = maxLength ?? (rest.type === 'email' ? MAX_EMAIL : undefined);
  return (
    <Field id={inputId} label={label} error={error} hint={hint}>
      <input id={inputId} aria-invalid={!!error || invalid} maxLength={limit} className={cn(fieldClass({ error, filled, invalid }), className)} {...rest} />
    </Field>
  );
}

export function Select({ label, error, hint, filled, invalid, className, id, children, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <Field id={selectId} label={label} error={error} hint={hint}>
      <select id={selectId} aria-invalid={!!error || invalid} className={cn(fieldClass({ error, filled, invalid }), 'pr-8', className)} {...rest}>
        {children}
      </select>
    </Field>
  );
}

// grow: the box stretches to fill the space left in a flex column (the Contact Us form uses it to end level with the card beside it)
export function Textarea({
  label,
  error,
  hint,
  filled,
  invalid,
  className,
  id,
  grow,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { grow?: boolean }) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <Field id={areaId} label={label} error={error} hint={hint} className={grow ? 'flex flex-1 flex-col' : undefined}>
      <textarea id={areaId} aria-invalid={!!error || invalid} className={cn(fieldClass({ error, filled, invalid }), 'min-h-24', grow && 'flex-1 resize-none', className)} {...rest} />
    </Field>
  );
}
