import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import { LogoMark } from '@/components/layout/Logo';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/cn';
import { useLoginForm } from './useLoginForm';

export default function AdminLoginPage() {
  const { user, signIn, logout } = useAuth();
  const navigate = useNavigate();
  const state = useLocation().state as { from?: string; notice?: string } | null;
  const from = state?.from;
  const target = from?.startsWith('/admin') ? from : '/admin';

  const { email, setEmail, password, setPassword, remember, setRemember, locked, loading, hasError, errorText, onSubmit } = useLoginForm(
    async (session) => {
      if (session.user.role !== 'admin') {
        await logout();
        return "This account doesn't have admin access.";
      }
      signIn(session);
      navigate(target, { replace: true });
    },
  );

  if (user?.role === 'admin') return <Navigate to={target} replace />;

  return (
    <div className="grid min-h-screen bg-cream md:grid-cols-2">
      <section className="relative flex flex-col items-center justify-center overflow-hidden bg-forest px-6 py-14 text-center text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-28 -right-20 size-80 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-2">
          <LogoMark className="size-12" />
          <span className="font-display text-4xl font-semibold">comfy&amp;co</span>
        </div>
        <p className="relative mt-3 text-xs uppercase tracking-widest text-mint">Admin Portal</p>
        <p className="relative mt-2 font-display text-xl font-semibold">Making every corner feel like home.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-card sm:p-8">
          <h1 className="text-3xl font-semibold text-forest">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Log in to manage comfy&amp;co.</p>
          {state?.notice && (
            <p role="status" className="mt-4 rounded-xl bg-mint-light px-3.5 py-2.5 text-sm text-forest">
              {state.notice}
            </p>
          )}

          <div className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="admin@comfyandco.com"
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
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 rounded accent-forest"
              />
              Remember me
            </label>
            <Link
              to="/forgot-password"
              state={{ from: '/admin/login' }}
              className={cn('text-ink hover:text-forest hover:underline', locked && 'font-semibold text-forest underline')}
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" size="lg" className="mt-6 w-full" loading={loading} disabled={locked}>
            Log in
          </Button>
          <p className="mt-4 text-center text-xs text-muted">Authorized personnel only.</p>
        </form>
      </section>
    </div>
  );
}
