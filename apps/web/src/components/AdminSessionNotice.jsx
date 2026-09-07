import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import supabase from '@/lib/supabaseClient.js';

// is_admin() requires the JWT to be aal2. An admin session that never verified a TOTP code is still let
// into the studio, and every is_admin()-gated table then answers 200 with zero rows — so orders, proofs and
// customers all look like "0 total" instead of "you can't see this". Ask Supabase what it thinks of the
// session and say so, in one place, instead of letting every page render an honest-looking empty state.
const AdminSessionNotice = ({ mobile = false }) => {
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, session, logout } = useAuth();
  const [assurance, setAssurance] = useState(null);

  useEffect(() => {
    if (!isAdmin || !isAuthenticated) return undefined;
    let active = true;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (active) setAssurance(data || null);
    });
    return () => { active = false; };
  }, [isAdmin, isAuthenticated, session?.access_token]);

  if (!isAdmin || !isAuthenticated || !assurance || assurance.currentLevel === 'aal2') return null;

  const needsEnrollment = assurance.nextLevel !== 'aal2';
  const prefix = mobile ? '/mobile' : '';
  const handleLogout = async () => {
    await logout();
    navigate(`${prefix}/login`, { replace: true });
  };

  return (
    <MobileStatePanel
      icon={ShieldAlert}
      tone="error"
      className="mb-4"
      eyebrow="Sesi belum terverifikasi"
      title="Data admin tidak akan tampil"
      description={needsEnrollment
        ? 'Akun ini belum punya authenticator. Order, bukti transfer, dan customer terlihat kosong sampai authenticator didaftarkan lalu login ulang.'
        : 'Sesi ini belum memasukkan kode authenticator. Order, bukti transfer, dan customer terlihat kosong sampai logout lalu login ulang dengan kode.'}
      action={needsEnrollment ? 'Daftarkan authenticator' : 'Logout & login ulang'}
      onAction={needsEnrollment ? () => navigate(`${prefix}/authenticator`) : handleLogout}
    />
  );
};

export default AdminSessionNotice;
