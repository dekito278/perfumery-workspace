import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { activateWaitingServiceWorker, subscribeToPwaUpdates } from '@/utils/pwa.js';

// Dismissal is remembered for the session: the "update available" event fires again on every page load
// while a new worker is waiting, so without this the card came back on every navigation. It also stays
// out of the way while someone is paying — a reload prompt mid-checkout is the wrong moment.
// Only admins see it: a stale studio can mis-save, but a shopper simply gets the new build next visit —
// and on a phone the card sat over the sticky add-to-cart / "Lanjut" bars of every storefront page.
const DISMISS_KEY = 'solivagant.pwa.update-dismissed';

const PwaUpdatePrompt = () => {
  const { isAdmin } = useAuth();
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => subscribeToPwaUpdates(() => {
    try { if (window.sessionStorage.getItem(DISMISS_KEY)) return; } catch { /* storage blocked: just show it */ }
    setVisible(true);
  }), []);

  const dismiss = () => {
    setVisible(false);
    try { window.sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const updateNow = async () => {
    setUpdating(true);
    await activateWaitingServiceWorker();
  };

  if (!visible || !isAdmin) {
    return null;
  }

  return (
    <div className="mobile-pwa-update" role="status" aria-live="polite">
      <button type="button" className="mobile-pwa-install-close" onClick={dismiss} aria-label="Tutup">
        <X className="h-4 w-4" />
      </button>
      <div className="mobile-pwa-update-mark">
        <RefreshCw className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-[#1f2937]">Update tersedia</div>
        <p className="mt-1 text-xs font-medium leading-snug text-[#6b7280]">
          Versi baru sudah siap. Perbarui kapan saja, atau tutup dan lanjutkan dulu.
        </p>
        <div className="mt-3">
          <Button type="button" onClick={updateNow} className="h-9 rounded-xl px-3 text-xs" disabled={updating}>
            {updating ? 'Memperbarui...' : 'Update sekarang'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PwaUpdatePrompt;
