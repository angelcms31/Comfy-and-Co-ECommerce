import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/Toast';
import { authService } from '@/services/authService';
import { MAX_LOGIN_ATTEMPTS } from '@/lib/constants';
import type { Session } from '@/types/models';

const WRONG_LOGIN = 'Incorrect email or password'; // message from the backend

// shared by the customer and admin login pages.
// onSuccess can return a message to reject the login (e.g. a customer on the admin page)
export function useLoginForm(onSuccess: (session: Session) => Promise<string | void>) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  // the 3-try limit only lives here for now (SCHEMA_GAPS #4), a refresh resets it
  const locked = attempts >= MAX_LOGIN_ATTEMPTS;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await authService.login(email.trim(), password, remember);
      const rejected = await onSuccess(session);
      if (rejected) toast.error(rejected);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      // a wrong password stays under the field, anything else (server down etc.) is a popup
      if (message === WRONG_LOGIN) {
        setAttempts((n) => n + 1);
        setError(message);
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const left = MAX_LOGIN_ATTEMPTS - attempts;
  const errorText = locked
    ? 'Too many failed attempts. Please reset your password.'
    : error
      ? error.replace(/\.?$/, '.') + (error === WRONG_LOGIN ? ` ${left} ${left === 1 ? 'try' : 'tries'} left.` : '')
      : null;

  return { email, setEmail, password, setPassword, remember, setRemember, locked, loading, hasError: !!error || locked, errorText, onSubmit };
}
