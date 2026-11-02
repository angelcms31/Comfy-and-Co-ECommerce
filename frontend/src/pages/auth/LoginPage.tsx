import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/cn';
import { isAdmin } from '@/lib/roles';
import AuthCard from './AuthCard';
import { useLoginForm } from './useLoginForm';

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const state = useLocation().state as { from?: string; notice?: string } | null;
  const from = state?.from && !state.from.startsWith('/admin') ? state.from : '/';

  const { email, setEmail, password, setPassword, remember, setRemember, locked, loading, hasError, errorText, onSubmit } = useLoginForm(
    async (session) => {
      signIn(session);
      // admins can use this page too, they go straight to the dashboard
      navigate(isAdmin(session.user) ? '/admin' : from, { replace: true });
    },
  );

  if (user) return <Navigate to={from} replace />;

  return (
    <AuthCard title="Welcome back" subtitle="Log in to your comfy&co account." notice={state?.notice}>
      <form onSubmit={onSubmit} noValidate>
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            filled
            invalid={hasError}
            disabled={locked}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            filled
            invalid={hasError}
            error={errorText}
            disabled={locked}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 rounded accent-forest" />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            state={{ from: '/login' }}
            className={cn('text-ink hover:text-forest hover:underline', locked && 'font-semibold text-forest underline')}
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="mt-6 w-full" loading={loading} disabled={locked}>
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New to comfy&amp;co?{' '}
        <Link to="/register" state={state?.from ? { from: state.from } : undefined} className="font-medium text-forest hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
