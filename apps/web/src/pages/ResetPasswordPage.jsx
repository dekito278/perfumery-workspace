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
  const { initialLoading, mfaChallenge, session, updatePassword, verifyMfaCode } = useAuth();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
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
    if (password.length === 0) return 'Minimal 8 karakter.';
    if (password.length < 8) return 'Password terlalu pendek.';
    if (passwordConfirm && password !== passwordConfirm) return 'Konfirmasi belum sama.';
    return 'Siap disimpan.';
  }, [password, passwordConfirm]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Konfirmasi password belum sama.');
      return;
    }

    setSaving(true);
    try {
      await updatePassword(password);
      toast.success('Password diperbarui');
      navigate(loginPath, { replace: true });
    } catch (updateError) {
      const message = updateError.message || 'Gagal memperbarui password';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // A recovery link lands on an aal1 session. For an account with an authenticator Supabase refuses
  // updateUser({ password }) at aal1 ("AAL2 required"), so the code has to come first. AuthContext already
  // opened the challenge on load; this only collects the answer.
  const handleVerify = async (event) => {
    event.preventDefault();
    setError('');
    setVerifying(true);
    try {
      await verifyMfaCode(code);
    } catch (verifyError) {
      setError(verifyError.message || 'Kode authenticator salah');
    } finally {
      setVerifying(false);
    }
  };

  // Opened without a recovery session (typed URL, expired or already-used link): the form would only
  // fail later with "Auth session missing". Say it up front.
  if (!initialLoading && !session?.user) {
    return (
      <div className={shellClassName}>
        <Helmet><title>Reset Password - Solivagant</title></Helmet>
        <div className={cardClassName}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-200">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold leading-tight text-[#1f2937]">Link reset tidak berlaku</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
            Link reset password sudah kedaluwarsa atau sudah dipakai. Minta link baru dari halaman login.
          </p>
          <Button type="button" className="mt-5 h-12 w-full rounded-2xl bg-[#f59e0b] text-white hover:bg-[#d97706]" onClick={() => navigate(loginPath)}>
            Ke halaman login
          </Button>
        </div>
      </div>
    );
  }

  if (mfaChallenge) {
    return (
      <div className={shellClassName}>
        <Helmet><title>Reset Password - Solivagant</title></Helmet>
        <div className={cardClassName}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-200">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold leading-tight text-[#1f2937]">Verifikasi authenticator dulu</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
            Masukkan kode 6 digit untuk {mfaChallenge.friendlyName || 'Solivagant Studio'} untuk membuka form password.
          </p>
          <form onSubmit={handleVerify} className="mt-5 space-y-4">
            {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div> : null}
            <div className="space-y-2">
              <Label htmlFor="reset-mfa-code">Kode authenticator</Label>
              <Input
                id="reset-mfa-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="h-12 rounded-2xl bg-white text-center text-lg tracking-[0.35em]"
              />
            </div>
            <Button type="submit" disabled={verifying || code.length < 6} className="h-12 w-full rounded-2xl bg-[#f59e0b] text-white hover:bg-[#d97706]">
              {verifying ? 'Memverifikasi...' : 'Verifikasi authenticator'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <Helmet><title>Reset Password - Solivagant</title></Helmet>
      <div className={cardClassName}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-200">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold leading-tight text-[#1f2937]">Atur ulang password</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
          Masukkan password baru untuk akun studio Solivagant.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div> : null}
          <div className="space-y-2">
            <Label htmlFor="reset-password">Password baru</Label>
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
            <Label htmlFor="reset-password-confirm">Konfirmasi password</Label>
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
            {saving ? 'Menyimpan...' : 'Simpan password baru'}
          </Button>
          <Button type="button" variant="ghost" className="h-11 w-full rounded-2xl" onClick={() => navigate(loginPath)}>
            Ke halaman login
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
