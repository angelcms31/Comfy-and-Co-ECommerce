import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';
import AuthCard from './AuthCard';

const WAIT_SECONDS = 60; // Supabase only allows a new code about once a minute

// after sign up (or a login before verifying): enter the 6 digit code from the email to finish
export default function VerifyEmailPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const state = useLocation().state as { email?: string; from?: string } | null;
  const email = state?.email ?? '';
  const from = state?.from && !state.from.startsWith('/admin') ? state.from : '/';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(email ? `We sent a 6-digit code to ${email}. It may take a minute to arrive.` : null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(WAIT_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (user) return <Navigate to={from} replace />;
  if (!email) return <Navigate to="/register" replace />;

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,8}$/.test(code.trim())) return setError('Enter the code from the email.');
    setLoading(true);
    setError(null);
    try {
      const session = await authService.verifyEmail(email, code.trim());
      signIn(session);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/\.?$/, '.') : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await authService.resendVerification(email);
      setNotice(`We sent a new code to ${email}.`);
      setWait(WAIT_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/\.?$/, '.') : 'Something went wrong.');
    }
  };

  return (
    <AuthCard title="Verify your email" subtitle="Enter the code we emailed you to finish creating your account." notice={notice}>
      <form onSubmit={verify} noValidate className="space-y-5">
        <Input
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          filled
          error={error}
          className="text-center text-lg tracking-[0.4em]"
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Verify email
        </Button>
        <p className="text-center text-sm text-muted">
          Didn't get it? Check your spam folder or{' '}
          {wait > 0 ? (
            <span>send again in {wait}s</span>
          ) : (
            <button type="button" onClick={resend} className="font-medium text-forest hover:underline">
              send again
            </button>
          )}
        </p>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to="/register" className="text-muted hover:text-forest hover:underline">
          Use a different email
        </Link>
      </p>
    </AuthCard>
  );
}