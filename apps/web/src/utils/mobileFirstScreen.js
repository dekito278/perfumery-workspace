// The first screen a phone sees, and when it may be asked to install.
//
// The greeting card in every parcel points at this site, and most of those visits open on a phone. The
// first thing they saw was "APP INITIALIZATION — Loading workspace… Menyiapkan halaman dan data mobile."
// — studio jargon aimed at the owner, shown to a customer — and then, nine seconds in, a sheet asking
// them to add the app to their home screen before the page had given them one reason to.
//
// Import-free so the guard runs the rules rather than reads them.

// The mobile STOREFRONT. Everything else under /mobile is the studio (or login), which keeps its own
// loading state — "Loading workspace" is honest there. Derived from the route table in App.jsx.
export const MOBILE_COMMERCE_PREFIXES = [
  '/mobile/home', '/mobile/dashboard', '/mobile/catalog', '/mobile/articles', '/mobile/products',
  '/mobile/bespoke', '/mobile/cart', '/mobile/checkout', '/mobile/payment', '/mobile/customer',
];

export const isMobileCommercePath = (pathname = '') => {
  const path = String(pathname || '');
  if (path === '/mobile' || path === '/mobile/') return true;
  return MOBILE_COMMERCE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

// Ask to install only once the visitor has shown they want to be here: a second visit, or having
// scrolled a real distance on this one. A prompt on first paint is furniture that gets dismissed, and
// the dismissal is remembered — so an early ask does not just fail, it spends the only ask.
export const INSTALL_PROMPT_MIN_VISITS = 2;
export const INSTALL_PROMPT_SCROLL_PX = 600;

export const shouldSurfaceInstallPrompt = ({ dismissed = false, standalone = false, visits = 0, scrolledPx = 0 } = {}) => {
  if (dismissed || standalone) return false;
  const visitCount = Number(visits) || 0;
  const scrolled = Number(scrolledPx) || 0;
  return visitCount >= INSTALL_PROMPT_MIN_VISITS || scrolled >= INSTALL_PROMPT_SCROLL_PX;
};

// One visit per browser SESSION, counted across sessions in localStorage. Both storages are passed in so
// the rule is testable without a window, and so a browser that blocks storage degrades to "first visit"
// rather than throwing on first paint.
export const VISIT_COUNT_KEY = 'solivagant-storefront-visits-v1';
export const VISIT_SESSION_KEY = 'solivagant-storefront-visit-counted-v1';

export const recordVisit = (local, session) => {
  try {
    const previous = Number(local?.getItem(VISIT_COUNT_KEY)) || 0;
    if (session?.getItem(VISIT_SESSION_KEY) === 'true') return previous;
    const next = previous + 1;
    local?.setItem(VISIT_COUNT_KEY, String(next));
    session?.setItem(VISIT_SESSION_KEY, 'true');
    return next;
  } catch {
    return 0;
  }
};
