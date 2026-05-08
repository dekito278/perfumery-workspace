const MAX_STORED_ERRORS = 8;
const STORAGE_KEY = 'solivagant-mobile-runtime-errors';

export const isMobileLikeRuntime = () => {
  const userAgent = window.navigator.userAgent || '';
  const touchCapable = window.navigator.maxTouchPoints > 1;
  return /android|iphone|ipad|ipod/i.test(userAgent) || touchCapable || window.location.pathname.startsWith('/mobile');
};

export const getDeviceSummary = () => ({
  userAgent: window.navigator.userAgent || 'unknown',
  platform: window.navigator.platform || 'unknown',
  standalone: window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
  path: window.location.pathname,
  viewport: `${window.innerWidth}x${window.innerHeight}`,
});

export const getMobileCompatibilityReport = () => ({
  fileApi: typeof File !== 'undefined',
  fileReader: typeof FileReader !== 'undefined',
  blobArrayBuffer: typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer === 'function',
  promiseWithResolvers: typeof Promise.withResolvers === 'function',
  promiseAllSettled: typeof Promise.allSettled === 'function',
  dynamicImport: true,
  serviceWorker: 'serviceWorker' in navigator,
});

export const getMissingMobileCapabilities = () =>
  Object.entries(getMobileCompatibilityReport())
    .filter(([, supported]) => !supported)
    .map(([name]) => name);

export const describeError = (error) => {
  if (!error) {
    return 'Unknown runtime error';
  }

  if (typeof error === 'string') {
    return error;
  }

  return error.message || error.reason?.message || String(error);
};

const readStoredErrors = () => {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const recordMobileRuntimeError = (error, context = {}) => {
  if (!isMobileLikeRuntime()) {
    return null;
  }

  const entry = {
    at: new Date().toISOString(),
    message: describeError(error),
    stack: error?.stack || error?.reason?.stack || null,
    context,
    device: getDeviceSummary(),
    compatibility: getMobileCompatibilityReport(),
  };

  try {
    const nextErrors = [entry, ...readStoredErrors()].slice(0, MAX_STORED_ERRORS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextErrors));
  } catch {
    // Diagnostics should never block the app.
  }

  return entry;
};

export const getLatestMobileRuntimeError = () => readStoredErrors()[0] || null;

export const clearMobileRuntimeErrors = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const buildMobileImportErrorMessage = (error) => {
  const missingCapabilities = getMissingMobileCapabilities();
  const message = describeError(error);

  if (missingCapabilities.length) {
    return `Import gagal di browser mobile ini karena fitur ${missingCapabilities.join(', ')} belum tersedia. Coba update app/browser, lalu buka ulang. Detail: ${message}`;
  }

  if (/undefined is not (?:a )?function/i.test(message) || /withResolvers/i.test(message)) {
    return `Import gagal karena runtime mobile belum cocok dengan parser PDF. Tutup app lalu buka ulang agar bundle terbaru terpakai. Detail: ${message}`;
  }

  if (/Loading chunk|Failed to fetch dynamically imported module|import/i.test(message)) {
    return `Import parser belum berhasil dimuat. Coba refresh app sekali agar cache mobile mengambil versi terbaru. Detail: ${message}`;
  }

  return message || 'Failed to parse PDF';
};
