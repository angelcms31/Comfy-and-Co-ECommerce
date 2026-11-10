import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { emailError } from '@/lib/email';
import { cleanMobile, isValidMobile, MOBILE_ERROR, MOBILE_LENGTH, MOBILE_REQUIRED, normalizeMobile } from '@/lib/mobile';
import { isValidName, NAME_ERROR } from '@/lib/names';
import { authService } from '@/services/authService';
import AuthCard from './AuthCard';

const EMPTY = { full_name: '', email: '', mobile_no: '', birthdate: '', password: '', confirm: '' };
type Form = typeof EMPTY;

// what was typed before opening the terms or privacy page. Only kept in memory, so it's gone after a reload.
let draft: Form | null = null;
const POLICY_PAGES = ['/terms', '/privacy'];

const today = () => new Date().toISOString().slice(0, 10);
const optional = <em className="font-normal text-muted">(optional)</em>;

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.full_name.trim()) e.full_name = 'Please enter your name';
  else if (!isValidName(f.full_name)) e.full_name = NAME_ERROR;
  const badEmail = emailError(f.email);
  if (badEmail) e.email = badEmail;
  if (!f.mobile_no) e.mobile_no = MOBILE_REQUIRED;
  else if (!isValidMobile(f.mobile_no)) e.mobile_no = MOBILE_ERROR;
  if (f.birthdate && f.birthdate >= today()) e.birthdate = 'Birthdate must be in the past';
  if (f.password.length < 8) e.password = 'Use at least 8 characters';
  if (f.confirm !== f.password) e.confirm = "Passwords don't match";
  return e;
}

export default function RegisterPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const fromState = (useLocation().state as { from?: string } | null)?.from;
  const from = fromState && !fromState.startsWith('/admin') ? fromState : '/';

  const [form, setForm] = useState<Form>(() => draft ?? EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const latest = useRef(form);
  useEffect(() => {
    latest.current = form;
  }, [form]);
  useEffect(
    () => () => {
      draft = POLICY_PAGES.includes(window.location.pathname) ? latest.current : null;
    },
    [],
  );

  if (user) return <Navigate to={from} replace />;

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      const session = await authService.register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        mobile_no: normalizeMobile(form.mobile_no),
        birthdate: form.birthdate || undefined,
      });
      signIn(session);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error((err instanceof Error ? err.message : 'Something went wrong').replace(/\.?$/, '.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Create an account" subtitle="Save your favorites and check out faster." wide>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" autoComplete="name" value={form.full_name} onChange={set('full_name')} filled error={errors.full_name} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set('email')}
            filled
            error={errors.email}
          />

          <Input
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            maxLength={MOBILE_LENGTH}
            placeholder="09171234567"
            value={form.mobile_no}
            onChange={(e) => setForm((f) => ({ ...f, mobile_no: cleanMobile(e.target.value) }))}
            filled
            error={errors.mobile_no}
          />
          <Input label={<>Birthdate {optional}</>} type="date" max={today()} value={form.birthdate} onChange={set('birthdate')} filled error={errors.birthdate} />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={set('password')}
            filled
            error={errors.password}
          />
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
            filled
            error={errors.confirm}
          />
        </div>

        <div className="flex justify-center pt-2">
          <Button type="submit" size="lg" className="w-full sm:max-w-sm" loading={loading}>
            Create account
          </Button>
        </div>
        <p className="text-center text-xs text-muted">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="underline hover:text-forest">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline hover:text-forest">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" state={fromState ? { from: fromState } : undefined} className="font-medium text-forest hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
