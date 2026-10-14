import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from './Input';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string; error?: string | null; filled?: boolean; invalid?: boolean };

export default function PasswordInput(props: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className={`pr-11 ${props.className ?? ''}`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className={`absolute right-3 text-muted hover:text-ink ${props.label ? 'top-[38px]' : 'top-1/2 -translate-y-1/2'}`}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
