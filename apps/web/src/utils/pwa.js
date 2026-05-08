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

export const applyStandaloneClass = () => {
  document.documentElement.classList.toggle('pwa-standalone', isStandaloneDisplayMode());
};

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.update?.();

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
      })
      .catch((error) => {
        console.warn('Solivagant service worker registration failed:', error);
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

