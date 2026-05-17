import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { subscribeToConnectivity } from '@/utils/pwa.js';

const PwaOfflineBanner = () => {
  const [online, setOnline] = useState(() => (typeof window === 'undefined' ? true : window.navigator.onLine));

  useEffect(() => subscribeToConnectivity((event) => setOnline(event.detail.online)), []);

  if (online) {
    return null;
  }

  return (
    <div className="mobile-pwa-offline" role="status" aria-live="polite">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Kamu sedang offline. Data terbaru akan dimuat kembali saat koneksi pulih.</span>
    </div>
  );
};

export default PwaOfflineBanner;
