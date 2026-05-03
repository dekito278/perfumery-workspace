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
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('Perfumer Studio service worker registration failed:', error);
    });
  });
};
