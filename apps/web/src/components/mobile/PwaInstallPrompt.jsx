import React, { useEffect, useMemo, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { isAndroidDevice, isIosDevice, isStandaloneDisplayMode } from '@/utils/pwa.js';

const DISMISS_KEY = 'perfumer-pwa-install-dismissed-v1';

const shouldShowPrompt = () => {
  if (typeof window === 'undefined') return false;
  if (isStandaloneDisplayMode()) return false;
  return window.localStorage.getItem(DISMISS_KEY) !== 'true';
};

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const platform = useMemo(() => {
    if (typeof window === 'undefined') return 'other';
    if (isIosDevice()) return 'ios';
    if (isAndroidDevice()) return 'android';
    return 'other';
  }, []);

  useEffect(() => {
    if (!shouldShowPrompt()) {
      return undefined;
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };
    const handleInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      window.localStorage.setItem(DISMISS_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (platform === 'ios') {
      const timer = window.setTimeout(() => setVisible(shouldShowPrompt()), 1200);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [platform]);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (!visible || platform === 'other') {
    return null;
  }

  const ios = platform === 'ios';

  return (
    <div className="mobile-pwa-install" role="dialog" aria-label="Install Perfumer Studio">
      <button type="button" className="mobile-pwa-install-close" onClick={dismiss} aria-label="Dismiss install prompt">
        <X className="h-4 w-4" />
      </button>
      <div className="mobile-pwa-install-mark">PS</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-[#1f2937]">
          {ios ? 'Add Perfumer Studio to Home Screen' : 'Install Perfumer Studio Lite'}
        </div>
        <p className="mt-1 text-xs font-medium leading-snug text-[#6b7280]">
          {ios
            ? 'Tap Share, then Add to Home Screen for a standalone iOS app view.'
            : 'Install the lightweight app for fullscreen mobile access.'}
        </p>
        <div className="mt-3 flex gap-2">
          {ios ? (
            <div className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              <Share className="h-4 w-4" />
              Share {'->'} Add to Home Screen
            </div>
          ) : (
            <Button type="button" onClick={install} className="h-9 rounded-xl px-3 text-xs" disabled={!deferredPrompt}>
              <Download className="mr-1 h-4 w-4" />
              Install
            </Button>
          )}
          <Button type="button" variant="outline" onClick={dismiss} className="h-9 rounded-xl bg-white px-3 text-xs">
            Later
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
