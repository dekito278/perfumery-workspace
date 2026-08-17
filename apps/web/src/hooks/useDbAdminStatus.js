import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabaseClient.js';

// Studio access is gated twice, by two lists that nothing keeps in sync:
//
//   - the app gate, VITE_ADMIN_EMAILS, decided in the browser at build time
//   - the data gate, public.is_admin(), reading storefront_admins in the database
//
// When an account is on the first list but not the second, the studio opens completely
// normally and every admin query comes back empty — RLS *filters rows*, it does not
// raise — so there is no error to show and nothing to explain the empty screens.
// Public tables like products keep loading, which makes it look like a bug in one page
// rather than a permissions gap.
//
// 'unknown' is the safe answer whenever the check itself fails: this only ever drives a
// warning, never access, so a failed probe must not accuse a legitimate admin.
export const useDbAdminStatus = (enabled) => {
  const [status, setStatus] = useState('unknown');

  useEffect(() => {
    if (!enabled) {
      setStatus('unknown');
      return undefined;
    }

    let active = true;
    supabaseClient
      .rpc('is_admin')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStatus('unknown');
          return;
        }
        setStatus(data === true ? 'admin' : 'missing');
      })
      .catch(() => {
        if (active) setStatus('unknown');
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  return status;
};

export default useDbAdminStatus;
