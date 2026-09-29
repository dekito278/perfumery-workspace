import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';

/**
 * Signing out, once, for every screen that offers it.
 *
 * AuthContext.logout throws when Supabase refuses the sign-out, and it throws BEFORE it clears anything —
 * the session object, the remembered MFA and the sb-* token in localStorage all survive. So a caller that
 * does not wait for it, or waits and ignores the throw, leaves the owner looking at a login screen on a
 * session that is still perfectly valid. Press Keluar on a flaky connection, walk away from a borrowed
 * laptop, and the next person presses Back.
 *
 * Three screens offered it and they disagreed: the phone awaited, caught, told the truth and stayed put;
 * the MFA notice awaited and swallowed the rejection; the Studio sidebar — the one Dekito actually uses —
 * did neither, and navigated to /login unconditionally, on a promise it never looked at.
 *
 * The rule is the phone's, because the phone's was right: navigate only after the sign-out actually
 * succeeded, and say so out loud when it did not.
 */
/**
 * @param redirectTo where to go once the sign-out actually succeeded, or `null` to stay put — which is
 *   what the buyer-facing links want: a shopper who signs out mid-checkout should keep their cart and
 *   their place on the page, not be thrown at a login screen they never asked for.
 */
export const useSignOut = (redirectTo = '/login') => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      toast.success('Berhasil keluar');
      if (redirectTo) navigate(redirectTo, { replace: true });
    } catch (error) {
      // Deliberately NOT navigating: the session is still live, and a login screen over a live session
      // is the one outcome this must never produce.
      toast.error(error?.message || 'Gagal keluar');
      setSigningOut(false);
    }
  };

  return { signOut, signingOut };
};

export default useSignOut;
