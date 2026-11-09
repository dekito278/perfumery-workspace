import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { confirmAction } from '@/utils/confirmAction.js';

/**
 * While there is work that has not been saved, leaving asks first — every way out, not just the page's
 * own back button.
 *
 * Two halves. Closing the tab or reloading gets the browser's own "leave site?" prompt (beforeunload);
 * the text of that one is ignored by every modern browser. Moving inside the app — the sidebar, the
 * phone's bottom nav, a "Batal" button, the phone's back gesture — is held by the router (useBlocker,
 * which is why App.jsx mounts a data router) and asked through confirmAction.
 *
 * Until 2026-11-10 only the first half existed, plus a confirm on each page's own back button. The
 * sidebar went straight through, and so did the back gesture and the formula editors' "Batal", which
 * had no confirm at all: an hour of composition was one tap from gone.
 *
 * Pages call navigate() freely, including after a save. A save clears the dirty flag in the same batch
 * that navigates, but the router asks the blocker before that render lands, so a held navigation whose
 * page is clean by the time it renders is simply let through rather than asked about.
 */
export const useUnsavedChangesWarning = (enabled, message = 'Ada perubahan yang belum disimpan. Tinggalkan halaman ini dan buang perubahannya?') => {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      // Chrome needs returnValue set; the text itself is ignored by every modern browser.
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);

  // Only a change of page: a form that writes its own tab or filter into the query string is not leaving.
  const blocker = useBlocker(useCallback(
    ({ currentLocation, nextLocation }) => enabled && currentLocation.pathname !== nextLocation.pathname,
    [enabled],
  ));

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (!enabled) {
      blocker.proceed();
      return;
    }
    (async () => {
      const leave = await confirmAction({ title: 'Buang perubahan?', message, confirmText: 'Buang', destructive: true });
      if (leave) blocker.proceed();
      else blocker.reset();
    })();
  }, [blocker, enabled, message]);
};

export default useUnsavedChangesWarning;
