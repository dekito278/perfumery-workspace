const CACHE_VERSION = 'solivagant-v16';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
];

const isSameOrigin = (url) => url.origin === self.location.origin;
const isAssetRequest = (request) => ['script', 'style', 'worker', 'font', 'image'].includes(request.destination);
const isHtmlResponse = (response) => (response.headers.get('content-type') || '').includes('text/html');
const isLocalDev = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch((error) => {
          console.warn('Solivagant precache skipped:', url, error);
        }))
      ))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => (cacheName.startsWith('perfumer-studio-') || cacheName.startsWith('solivagant-')) && cacheName !== APP_SHELL_CACHE)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !isSameOrigin(url)) {
    return;
  }

  if (isLocalDev) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => (
          await caches.match(OFFLINE_URL)
          || new Response('Solivagant is offline. Reconnect and reload.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        ))
    );
    return;
  }

  if (isAssetRequest(request) || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache a real hit. Without this, a miss that the SPA catch-all answers
          // with 200 text/html gets stored under a .js URL, and every later load replays
          // the "expected a JavaScript module script, got text/html" failure from cache —
          // which is why a stale-chunk error after a deploy used to survive reloads.
          if (response.ok && !isHtmlResponse(response)) {
            const responseClone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
