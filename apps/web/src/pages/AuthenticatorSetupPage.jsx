import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, KeyRound, ScanLine, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

const steps = [
  { icon: Smartphone, label: 'Open app', text: 'Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.' },
  { icon: ScanLine, label: 'Scan QR', text: 'Scan the setup QR or enter the manual key if your device cannot scan.' },
  { icon: CheckCircle2, label: 'Verify', text: 'Enter the 6 digit code once to enable two-step login.' },
];

const StepCard = ({ icon: Icon, label, text }) => (
  <article className="rounded-2xl border border-[#e5e7eb] bg-white p-3">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-[#1f2937]">{label}</h3>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">{text}</p>
      </div>
    </div>
  </article>
);

const SetupContent = ({ mobile = false }) => {
  const navigate = useNavigate();
  const {
    challengeAuthenticatorEnrollment,
    enrollAuthenticator,
    verifyAuthenticatorEnrollment,
  } = useAuth();
  const [factor, setFactor] = useState(null);
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    try {
      const enrollment = await enrollAuthenticator('Solivagant Studio');
      const challenge = await challengeAuthenticatorEnrollment(enrollment.id);
      setFactor(enrollment);
      setChallengeId(challenge.id);
      toast.success('Authenticator setup started');
    } catch (error) {
      toast.error(error.message || 'Failed to start authenticator setup');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async (event) => {
    event.preventDefault();
    if (!factor?.id || !challengeId) return;

    setVerifying(true);
    try {
      await verifyAuthenticatorEnrollment({
        factorId: factor.id,
        challengeId,
        code,
      });
      toast.success('Authenticator enabled');
      navigate(mobile ? '/mobile/studio' : '/studio', { replace: true });
    } catch (error) {
      toast.error(error.message || 'Invalid authenticator code');
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = async () => {
    if (!factor?.totp?.secret) return;
    await navigator.clipboard.writeText(factor.totp.secret);
    toast.success('Manual key copied');
  };

  const qrCode = factor?.totp?.qr_code;
  const secret = factor?.totp?.secret;
  const pageClassName = mobile ? 'mobile-page space-y-3' : 'mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8';
  const setupSectionClassName = mobile ? 'mobile-card p-4' : 'rounded-2xl border bg-white/95 p-5 shadow-sm';

  return (
    <main className={pageClassName}>
      {mobile ? (
        <MobileTopBar title="Authenticator" subtitle="Two-step login" onBack={() => navigate('/mobile/studio')} action={<ShieldCheck className="h-5 w-5 text-amber-700" />} />
      ) : (
        <section className="dashboard-hero mb-5">
          <div className="dashboard-hero-copy">
            <div className="dashboard-hero-eyebrow">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Account security
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Authenticator</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Add a 6 digit code step to studio login for stronger account protection.
            </p>
          </div>
          <div className="dashboard-hero-panel">
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Method</span>
              <strong>TOTP</strong>
            </div>
            <div className="dashboard-hero-stat">
              <span className="dashboard-hero-stat-label">Login</span>
              <strong>2-step</strong>
            </div>
          </div>
        </section>
      )}

      {mobile ? (
        <section className="mobile-soft-card p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-200">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold leading-tight text-[#1f2937]">Authenticator app</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
            Scan once, then use the rotating 6 digit code every time this account needs a stronger login check.
          </p>
        </section>
      ) : null}

      <section className={mobile ? 'grid gap-2' : 'grid gap-3 md:grid-cols-3'}>
        {steps.map((step) => <StepCard key={step.label} {...step} />)}
      </section>

      <section className={setupSectionClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase text-amber-700">Setup</div>
            <h2 className="mt-1 text-base font-bold text-[#1f2937]">Link your authenticator</h2>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
              Start setup, scan the QR, then verify the current code from your authenticator app.
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef2e8] text-[#263d27]">
            <ShieldCheck className="h-4 w-4" />
          </span>
        </div>

        {!factor ? (
          <Button type="button" onClick={startSetup} disabled={loading} className="mt-4 h-12 w-full rounded-2xl bg-[#f59e0b] text-white hover:bg-[#d97706]">
            {loading ? 'Preparing...' : 'Set up authenticator'}
          </Button>
        ) : (
          <form onSubmit={verifySetup} className="mt-4 grid gap-4">
            {qrCode ? (
              <div className="rounded-2xl border border-[#e5e7eb] bg-[#f8f7f4] p-4">
                <div className="mx-auto grid max-w-[236px] place-items-center rounded-2xl bg-white p-3 shadow-sm" dangerouslySetInnerHTML={{ __html: qrCode }} />
              </div>
            ) : null}

            {secret ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-amber-700">Manual key</div>
                    <div className="mt-1 break-all text-sm font-bold text-[#1f2937]">{secret}</div>
                  </div>
                  <Button type="button" size="icon" variant="outline" onClick={copySecret} className="h-10 w-10 shrink-0 rounded-xl bg-white" aria-label="Copy manual key">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="authenticator-setup-code">6 digit code</Label>
              <Input
                id="authenticator-setup-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                className="h-12 rounded-2xl bg-white text-center text-lg tracking-[0.35em]"
              />
            </div>
            <Button type="submit" disabled={verifying || code.length < 6} className="h-12 w-full rounded-2xl bg-[#f59e0b] text-white hover:bg-[#d97706]">
              {verifying ? 'Verifying...' : 'Enable authenticator'}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
};

const AuthenticatorSetupPage = ({ mobile = false }) => {
  if (mobile) {
    return (
      <MobileAuthenticatedLayout showFab={false}>
        <Helmet><title>Authenticator - Solivagant</title></Helmet>
        <SetupContent mobile />
      </MobileAuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Helmet><title>Authenticator - Solivagant</title></Helmet>
      <SetupContent />
    </AuthenticatedLayout>
  );
};

export default AuthenticatorSetupPage;
