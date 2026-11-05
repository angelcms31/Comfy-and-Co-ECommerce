import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import { authService } from '@/services/authService';
import AuthCard from './AuthCard';

type Step = 'email' | 'code' | 'password';

// used by both login pages, "from" says which one to go back to
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from === '/admin/login' ? '/admin/login' : '/login';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/\.?$/, '.') : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email.');
    run(async () => {
      await authService.sendResetCode(email.trim());
      setStep('code');
      setNotice(`We sent a code to ${email.trim()}. It may take a minute to arrive.`);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,8}$/.test(code.trim())) return setError('Enter the code from the email.');
    run(async () => {
      const res = await authService.verifyResetCode(email.trim(), code.trim());
      setResetToken(res.reset_token);
      setNotice(null);
      setStep('password');
    });
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("Passwords don't match.");
    run(async () => {
      await authService.resetPassword(resetToken, password);
      navigate(from, { replace: true, state: { notice: 'Your password was changed. You can log in now.' } });
    });
  };

  return (
    <AuthCard
      title={step === 'password' ? 'Set a new password' : 'Forgot password'}
      subtitle={
        step === 'email' ? "Enter your account's email and we'll send you a code." : step === 'code' ? 'Enter the code from the email.' : null
      }
      notice={notice}
    >
      {step === 'email' && (
        <form onSubmit={sendCode} noValidate className="space-y-5">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            filled
            error={error}
          />
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Send code
          </Button>
        </form>
      )}

      {step === 'code' && (
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
            Verify code
          </Button>
          <p className="text-center text-sm text-muted">
            Didn't get it?{' '}
            <button type="button" onClick={() => sendCode()} disabled={loading} className="font-medium text-forest hover:underline">
              Send again
            </button>
          </p>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={save} noValidate className="space-y-4">
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            filled
          />
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            filled
            error={error}
          />
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={password.length < 8 || password !== confirm}>
            Save password
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to={from} className="text-muted hover:text-forest hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
