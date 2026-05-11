import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useMobileKeyboardState } from '@/hooks/useMobileKeyboardState.js';
import { cn } from '@/lib/utils.js';

const ResetPasswordPage = ({ mobile = false }) => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const keyboardActive = useMobileKeyboardState();
  const loginPath = mobile ? '/mobile/login' : '/login';
  const shellClassName = mobile
    ? cn('mobile-app min-h-screen px-4 py-6', keyboardActive && 'mobile-keyboard-active')
    : 'min-h-screen bg-background flex items-center justify-center p-4';
  const cardClassName = mobile
    ? 'mobile-soft-card p-5'
    : 'w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm';

  const helperText = useMemo(() => {
    if (password.length === 0) return 'Use at least 8 characters.';
    if (password.length < 8) return 'Password is too short.';
    if (passwordConfirm && password !== passwordConfirm) return 'Passwords do not match yet.';
    return 'Ready to update.';
  }, [password, passwordConfirm]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Password confirmation does not match.');
      return;
    }

    setSaving(true);
    try {
      await updatePassword(password);
      toast.success('Password updated');
      navigate(loginPath, { replace: true });
    } catch (updateError) {
      const message = updateError.message || 'Failed to update password';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={shellClassName}>
      <Helmet><title>Reset Password - Solivagant</title></Helmet>
      <div className={cardClassName}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-200">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold leading-tight text-[#1f2937]">Reset password</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
          Enter a new password for your Solivagant studio account.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div> : null}
          <div className="space-y-2">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="h-12 rounded-2xl bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm">Confirm password</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
              minLength={8}
              className="h-12 rounded-2xl bg-white"
            />
            <p className="text-xs font-semibold text-[#6b7280]">{helperText}</p>
          </div>
          <Button type="submit" disabled={saving} className="h-12 w-full rounded-2xl bg-[#f59e0b] text-white hover:bg-[#d97706]">
            {saving ? 'Updating...' : 'Update password'}
          </Button>
          <Button type="button" variant="ghost" className="h-11 w-full rounded-2xl" onClick={() => navigate(loginPath)}>
            Back to login
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
