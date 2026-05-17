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
const SERVICE_WORKER_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || 'local';
const UPDATE_AVAILABLE_EVENT = 'solivagant:pwa-update-available';
const OFFLINE_STATE_EVENT = 'solivagant:pwa-connectivity-change';
const STALE_SHELL_RECOVERY_KEY = 'solivagant.pwa.stale-shell-recovered';
const STALE_CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\w-]+ failed/i,
  /Unable to preload CSS/i,
];

export const applyStandaloneClass = () => {
  document.documentElement.classList.toggle('pwa-standalone', isStandaloneDisplayMode());
};

export const installConnectivityEvents = () => {
  const dispatchConnectivity = () => {
    window.dispatchEvent(new CustomEvent(OFFLINE_STATE_EVENT, {
      detail: { online: window.navigator.onLine },
    }));
  };

  window.addEventListener('online', dispatchConnectivity);
  window.addEventListener('offline', dispatchConnectivity);
  dispatchConnectivity();
};

export const subscribeToPwaUpdates = (listener) => {
  window.addEventListener(UPDATE_AVAILABLE_EVENT, listener);
  return () => window.removeEventListener(UPDATE_AVAILABLE_EVENT, listener);
};

export const subscribeToConnectivity = (listener) => {
  window.addEventListener(OFFLINE_STATE_EVENT, listener);
  return () => window.removeEventListener(OFFLINE_STATE_EVENT, listener);
};

export const activateWaitingServiceWorker = async () => {
  const registration = await navigator.serviceWorker?.getRegistration?.('/');
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
};

const isStaleShellError = (error) => {
  const message = String(error?.message || error?.reason?.message || error?.reason || error || '');
  return STALE_CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

const clearAppCaches = async () => {
  if (!('caches' in window)) {
    return;
  }

  const cacheNames = await window.caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith('perfumer-studio-') || cacheName.startsWith('solivagant-'))
      .map((cacheName) => window.caches.delete(cacheName))
  );
};

const reloadWithoutStaleShell = () => {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('pwa-recover', Date.now().toString(36));
  window.location.replace(nextUrl.toString());
};

const recoverFromStaleShell = async (error) => {
  if (!isStaleShellError(error) || !window.navigator.onLine) {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(STALE_SHELL_RECOVERY_KEY) === SERVICE_WORKER_BUILD_ID) {
      return false;
    }
    window.sessionStorage.setItem(STALE_SHELL_RECOVERY_KEY, SERVICE_WORKER_BUILD_ID);
  } catch {
    // Session storage is only used to avoid reload loops.
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((registrations || []).map((registration) => registration.unregister()));
    await clearAppCaches();
  } catch (recoveryError) {
    console.warn('Solivagant stale shell recovery failed:', recoveryError);
  }

  console.warn('Solivagant is reloading after a stale app bundle error:', error);
  reloadWithoutStaleShell();
  return true;
};

export const installStaleShellRecovery = () => {
  window.addEventListener('error', (event) => {
    recoverFromStaleShell(event.error || event.message);
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    recoverFromStaleShell(event.reason);
  });
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

    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(SERVICE_WORKER_BUILD_ID)}`, { scope: '/' })
      .then((registration) => {
        const checkForUpdate = () => {
          const updatePromise = registration.update?.();
          updatePromise?.catch?.((error) => {
            console.warn('Solivagant service worker update check failed:', error);
          });
        };

        checkForUpdate();

        const notifyUpdateAvailable = () => {
          window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
        };

        registration.addEventListener('updatefound', () => {
          const nextWorker = registration.installing;
          if (!nextWorker) {
            return;
          }

          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdateAvailable();
            }
          });
        });

        if (registration.waiting) {
          notifyUpdateAvailable();
        }
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

