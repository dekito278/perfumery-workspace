// What kind of screen placed this order.
//
// The app serves two separate UIs — /mobile/* and the desktop routes — so the path the buyer checked
// out from is a truer answer than sniffing the user agent, and it needs no library. Viewport width is
// kept alongside it because "desktop" spans a 1024px laptop and a 2560px monitor.
//
// Deliberately nothing else. No user agent, no device id, no fingerprint: this exists to answer "how
// many sales come from desktop", not to recognise anyone. The server whitelists these fields again.
export const getClientContext = () => {
  if (typeof window === 'undefined') return {};
  try {
    return {
      surface: window.location.pathname.startsWith('/mobile') ? 'mobile' : 'desktop',
      viewportWidth: Math.round(window.innerWidth) || null,
    };
  } catch {
    return {};
  }
};

export default getClientContext;

// The server's half of the pair. The browser sends a hint; this decides what is allowed to be stored.
// Kept beside the collector so the two can never drift, and importable from api/orders/create.js —
// no browser globals run at module load, only inside getClientContext().
export const sanitizeClientContext = (hint = {}) => {
  const surface = ['mobile', 'desktop'].includes(hint?.surface) ? hint.surface : null;
  const width = Math.round(Number(hint?.viewportWidth));
  const viewportWidth = Number.isFinite(width) && width > 0 && width <= 10000 ? width : null;

  const out = {};
  if (surface) out.surface = surface;
  if (viewportWidth) out.viewport_width = viewportWidth;
  return out;
};

// Reads back as one short line in the studio. Empty for every order placed before the column existed,
// which is most of them — so callers render nothing rather than a dash.
export const formatClientContext = (context) => {
  if (!context || typeof context !== 'object') return '';
  const surface = context.surface === 'mobile' ? 'Mobile' : context.surface === 'desktop' ? 'Desktop' : '';
  const width = Number(context.viewport_width) > 0 ? `${Math.round(Number(context.viewport_width))}px` : '';
  return [surface, width].filter(Boolean).join(' · ');
};
