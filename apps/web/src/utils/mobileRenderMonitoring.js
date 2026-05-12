const MOBILE_RENDER_LOG_STORAGE_KEY = 'dekito.mobile.renderLogs.v1';
const MAX_MOBILE_RENDER_LOGS = 60;
const DEFAULT_THROTTLE_MS = 30000;
const throttleState = new Map();

const isMobileCommerceRoute = () => (
  typeof window !== 'undefined'
  && window.location?.pathname?.startsWith('/mobile')
);

const readStoredLogs = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(MOBILE_RENDER_LOG_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredLogs = (logs) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(MOBILE_RENDER_LOG_STORAGE_KEY, JSON.stringify(logs.slice(-MAX_MOBILE_RENDER_LOGS)));
  } catch {
    // Monitoring must never affect the customer flow.
  }
};

export const getMobileRenderLogs = () => {
  if (typeof window === 'undefined') return [];
  return Array.isArray(window.__dekitoMobileRenderLogs)
    ? window.__dekitoMobileRenderLogs
    : readStoredLogs();
};

export const logMobileRenderIssue = (type, details = {}, options = {}) => {
  if (!isMobileCommerceRoute()) return null;

  const {
    level = 'warn',
    throttleMs = DEFAULT_THROTTLE_MS,
    throttleKey = `${type}:${details.section || details.source || details.imageUrl || ''}`,
  } = options;
  const now = Date.now();
  const previousLogAt = throttleState.get(throttleKey) || 0;

  if (throttleMs > 0 && now - previousLogAt < throttleMs) {
    return null;
  }

  throttleState.set(throttleKey, now);

  const entry = {
    at: new Date(now).toISOString(),
    path: window.location.pathname,
    type,
    ...details,
  };
  const nextLogs = [...getMobileRenderLogs(), entry].slice(-MAX_MOBILE_RENDER_LOGS);

  window.__dekitoMobileRenderLogs = nextLogs;
  writeStoredLogs(nextLogs);
  window.dispatchEvent(new CustomEvent('dekito:mobile-render-log', { detail: entry }));

  const consoleMethod = level === 'error' ? 'error' : 'warn';
  if (window.console?.[consoleMethod]) {
    window.console[consoleMethod]('[mobile-render]', entry);
  }

  return entry;
};

export const beginMobileFetchMonitor = (source, options = {}) => {
  if (!isMobileCommerceRoute()) {
    return { finish: () => {} };
  }

  const startedAt = window.performance?.now?.() || Date.now();
  const {
    thresholdMs = 2500,
    metadata = {},
  } = options;
  let finished = false;
  const timeoutId = window.setTimeout(() => {
    if (finished) return;
    logMobileRenderIssue('slow-fetch', {
      source,
      elapsedMs: Math.round((window.performance?.now?.() || Date.now()) - startedAt),
      status: 'pending',
      ...metadata,
    }, {
      throttleKey: `slow-fetch:${source}`,
      throttleMs: 20000,
    });
  }, thresholdMs);

  return {
    finish: (status = 'success', details = {}) => {
      finished = true;
      window.clearTimeout(timeoutId);
      const elapsedMs = Math.round((window.performance?.now?.() || Date.now()) - startedAt);

      if (elapsedMs >= thresholdMs) {
        logMobileRenderIssue('slow-fetch', {
          source,
          elapsedMs,
          status,
          ...metadata,
          ...details,
        }, {
          throttleKey: `slow-fetch:${source}:${status}`,
          throttleMs: 20000,
        });
      }
    },
  };
};
