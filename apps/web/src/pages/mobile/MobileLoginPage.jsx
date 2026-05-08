import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Beaker } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

const MobileLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      toast.success('Login successful');
      const redirectTo = location.state?.from?.pathname || '/mobile/studio';
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      const message = loginError.message || 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-app min-h-screen px-4 py-6">
      <Helmet>
        <title>Mobile Login - Solivagant</title>
      </Helmet>
      <div className="mobile-page flex min-h-[calc(100vh-48px)] flex-col justify-center">
        <div className="mobile-soft-card p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-200">
            <Beaker className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold leading-tight text-[#1f2937]">Solivagant</h1>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div> : null}
            <div className="space-y-2">
              <Label htmlFor="mobile-email">Email</Label>
              <Input id="mobile-email" type="text" inputMode="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-12 rounded-2xl bg-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-password">Password</Label>
              <Input id="mobile-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 rounded-2xl bg-white" />
            </div>
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-[#f59e0b] text-white hover:bg-[#d97706]">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MobileLoginPage;

