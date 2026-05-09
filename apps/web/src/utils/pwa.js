export const isStandaloneDisplayMode = () => (
  window.matchMedia?.('(display-mode: standalone)').matches
  || window.navigator.standalone === true
);

export const isIosDevice = () => {
  const userAgent = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const touchCapableMac = platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(userAgent) || touchCapableMac;
};

export const isAndroidDevice = () => /android/i.test(window.navigator.userAgent || '');

const isLocalDevelopmentHost = () => ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export const applyStandaloneClass = () => {
  document.documentElement.classList.toggle('pwa-standalone', isStandaloneDisplayMode());
};

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (isLocalDevelopmentHost()) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.warn('Solivagant service worker cleanup failed:', error);
        });
    });
    return;
  }

  window.addEventListener('load', () => {
    let updateIntervalId = null;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        const checkForUpdate = () => {
          const updatePromise = registration.update?.();
          updatePromise?.catch?.((error) => {
            console.warn('Solivagant service worker update check failed:', error);
          });
        };

        checkForUpdate();

        const activateWaitingWorker = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        };

        registration.addEventListener('updatefound', () => {
          const nextWorker = registration.installing;
          if (!nextWorker) {
            return;
          }

          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              nextWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        activateWaitingWorker();
        window.addEventListener('focus', checkForUpdate);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            checkForUpdate();
          }
        });
        updateIntervalId = window.setInterval(checkForUpdate, 30 * 60 * 1000);
      })
      .catch((error) => {
        console.warn('Solivagant service worker registration failed:', error);
        if (updateIntervalId) {
          window.clearInterval(updateIntervalId);
        }
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) {
        return;
      }
      refreshing = true;
      window.location.reload();
    });
  });
};

