import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { subscribeToConnectivity } from '@/utils/pwa.js';
import { useTranslate } from '@/hooks/useTranslate.js';

const PwaOfflineBanner = () => {
  // Mounted outside <Routes>, so it appears over any page in either shop the moment the connection drops.
  const { t } = useTranslate();
  const [online, setOnline] = useState(() => (typeof window === 'undefined' ? true : window.navigator.onLine));

  useEffect(() => subscribeToConnectivity((event) => setOnline(event.detail.online)), []);

  if (online) {
    return null;
  }

  return (
    <div className="mobile-pwa-offline" role="status" aria-live="polite">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{t('pwa.offline')}</span>
    </div>
  );
};

export default PwaOfflineBanner;
