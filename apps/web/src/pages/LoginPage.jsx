
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cancelMfaChallenge, login, mfaChallenge, requestPasswordReset, verifyMfaCode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [authStep, setAuthStep] = useState('password');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      if (result?.mfaRequired) {
        setAuthStep('mfa');
        toast.info('Enter your authenticator code');
        return;
      }
      toast.success('Login successful');
      const redirectTo = location.state?.from?.pathname || '/studio';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (event) => {
    event.preventDefault();
    setMfaLoading(true);
    setError('');

    try {
      await verifyMfaCode(authenticatorCode);
      toast.success('Authenticator verified');
      const redirectTo = location.state?.from?.pathname || '/studio';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid authenticator code');
      toast.error(err.message || 'Invalid authenticator code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleBackToPassword = async () => {
    setError('');
    setAuthenticatorCode('');
    setAuthStep('password');
    await cancelMfaChallenge();
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then request a reset link.');
      return;
    }

    setResetLoading(true);
    setError('');
    try {
      await requestPasswordReset(email.trim(), `${window.location.origin}/reset-password`);
      toast.success('Password reset email sent');
    } catch (resetError) {
      setError(resetError.message || 'Failed to send reset email');
      toast.error(resetError.message || 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Login - Solivagant</title>
        <meta name="description" content="Sign in to your Solivagant account to manage briefs, materials, formulas, and validation work." />
      </Helmet>
      <div className="flex min-h-screen items-center justify-center bg-[#050705] p-4">
        <Card className="w-full max-w-md border-white/10 bg-[#f7f8f2] shadow-2xl shadow-black/40">
          <CardHeader className="space-y-1">
            <img src="/brand/solivagant-logo.png" alt="Solivagant" className="mb-5 h-16 w-auto rounded-2xl object-contain" />
            <CardTitle className="text-2xl font-bold">Welcome back, Solivagant</CardTitle>
            <CardDescription>Masuk dan lanjut racik hari ini.</CardDescription>
          </CardHeader>
          <CardContent>
            {authStep === 'mfa' || mfaChallenge ? (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                  Open your authenticator app and enter the 6 digit code for {mfaChallenge?.friendlyName || 'Solivagant Studio'}.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authenticator-code">Authenticator code</Label>
                  <Input
                    id="authenticator-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={authenticatorCode}
                    onChange={(e) => setAuthenticatorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    className="text-foreground text-center text-lg tracking-[0.35em]"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={mfaLoading || authenticatorCode.length < 6}>
                  {mfaLoading ? 'Verifying...' : 'Verify authenticator'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { void handleBackToPassword(); }}>
                  Back to password
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-foreground"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={handlePasswordReset} disabled={resetLoading}>
                {resetLoading ? 'Sending reset link...' : 'Forgot password?'}
              </Button>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default LoginPage;
