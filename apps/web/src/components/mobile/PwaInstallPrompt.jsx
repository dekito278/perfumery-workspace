import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import { isAndroidDevice, isIosDevice, isStandaloneDisplayMode } from '@/utils/pwa.js';
import { INSTALL_PROMPT_SCROLL_PX, recordVisit, shouldSurfaceInstallPrompt } from '@/utils/mobileFirstScreen.js';

const DISMISS_KEY = 'solivagant-pwa-install-dismissed-v2';
const IOS_PROMPT_DELAY_MS = 9000;

// The gate is one pure rule (mobileFirstScreen.js): not dismissed, not already installed, and EITHER a
// second visit OR a real scroll on this one. A prompt on first paint spends the only ask.
const readDismissed = () => {
  try { return window.localStorage.getItem(DISMISS_KEY) === 'true'; } catch { return false; }
};
const shouldShowPrompt = (visits, scrolledPx) => {
  if (typeof window === 'undefined') return false;
  return shouldSurfaceInstallPrompt({
    dismissed: readDismissed(),
    standalone: isStandaloneDisplayMode(),
    visits,
    scrolledPx,
  });
};

const PwaInstallPrompt = () => {
  const location = useLocation();
  // This card mounts outside <Routes>, so it lands on whatever the visitor is reading — and the storefront
  // home it is gated to (/mobile/dashboard) exists in both shops. It was written in Indonesian and stayed
  // that way in /en, where it was the only Indonesian left on the page.
  const { t } = useTranslate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const platform = useMemo(() => {
    if (typeof window === 'undefined') return 'other';
    if (isIosDevice()) return 'ios';
    if (isAndroidDevice()) return 'android';
    return 'other';
  }, []);
  const canSurfacePrompt = location.pathname === '/mobile/dashboard';
  const [visits] = useState(() => (
    typeof window === 'undefined' ? 0 : recordVisit(window.localStorage, window.sessionStorage)
  ));
  const [scrolledPx, setScrolledPx] = useState(0);

  // Track how far this visit has scrolled; the gate reads it. Passive, and it stops listening once the
  // threshold is crossed — there is nothing more to learn after that.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    // Distance travelled SINCE MOUNT, not the absolute position. Browsers restore scroll on a revisit
    // (history.scrollRestoration = 'auto', bfcache, tab restore) and fire a scroll event for it — seen live:
    // a first visit with scrollY already at 800 opened the gate for a scroll nobody made.
    const startY = window.scrollY || 0;
    const onScroll = () => {
      const travelled = Math.max(0, (window.scrollY || 0) - startY);
      setScrolledPx(travelled);
      if (travelled >= INSTALL_PROMPT_SCROLL_PX) window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (readDismissed() || isStandaloneDisplayMode()) {
      return undefined;
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(canSurfacePrompt && shouldShowPrompt(visits, scrolledPx));
    };
    const handleInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      window.localStorage.setItem(DISMISS_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (platform === 'ios') {
      const timer = window.setTimeout(() => setVisible(canSurfacePrompt && shouldShowPrompt(visits, scrolledPx)), IOS_PROMPT_DELAY_MS);
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
  }, [canSurfacePrompt, platform, visits, scrolledPx]);

  useEffect(() => {
    if (!canSurfacePrompt) {
      setVisible(false);
      return;
    }

    if (platform === 'android' && deferredPrompt && shouldShowPrompt(visits, scrolledPx)) {
      setVisible(true);
    }
    // visits and scrolledPx belong here: the gate READS them, so leaving them out froze this effect on
    // the values it saw the first time it ran. On Android beforeinstallprompt fires early, while the gate
    // is still false — and without scrolledPx in the deps it never ran again, so scrolling past the
    // threshold never surfaced the prompt. The scroll path was dead on Android; only a second visit worked.
  }, [canSurfacePrompt, deferredPrompt, platform, visits, scrolledPx]);

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
    <div className="mobile-pwa-install" role="dialog" aria-label={t('pwa.installTitle')}>
      <button type="button" className="mobile-pwa-install-close" onClick={dismiss} aria-label={t('pwa.closeInstall')}>
        <X className="h-4 w-4" />
      </button>
      <div className="mobile-pwa-install-mark">S</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-[#1f2937]">
          {t(ios ? 'pwa.installTitleIos' : 'pwa.installTitle')}
        </div>
        <p className="mt-1 text-xs font-medium leading-snug text-[#6b7280]">
          {t(ios ? 'pwa.installBodyIos' : 'pwa.installBody')}
        </p>
        <div className="mt-3 flex gap-2">
          {ios ? (
            <div className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              <Share className="h-4 w-4" />
              {t('pwa.iosShare')}
            </div>
          ) : (
            <Button type="button" onClick={install} className="h-9 rounded-xl px-3 text-xs" disabled={!deferredPrompt}>
              <Download className="mr-1 h-4 w-4" />
              {t('pwa.install')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={dismiss} className="h-9 rounded-xl bg-white px-3 text-xs">
            {t('pwa.later')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;

