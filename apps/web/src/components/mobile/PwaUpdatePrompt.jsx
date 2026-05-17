import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { activateWaitingServiceWorker, subscribeToPwaUpdates } from '@/utils/pwa.js';

const PwaUpdatePrompt = () => {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => subscribeToPwaUpdates(() => setVisible(true)), []);

  const updateNow = async () => {
    setUpdating(true);
    await activateWaitingServiceWorker();
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="mobile-pwa-update" role="status" aria-live="polite">
      <button type="button" className="mobile-pwa-install-close" onClick={() => setVisible(false)} aria-label="Dismiss update prompt">
        <X className="h-4 w-4" />
      </button>
      <div className="mobile-pwa-update-mark">
        <RefreshCw className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-[#1f2937]">Update tersedia</div>
        <p className="mt-1 text-xs font-medium leading-snug text-[#6b7280]">
          Versi baru sudah siap. Perbarui sekarang agar aplikasi tetap paling stabil.
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
