const MOBILE_PATH_PREFIX = '/mobile';

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

const DESKTOP_TO_MOBILE_PATHS = [
  [/^\/$/, '/mobile'],
  [/^\/home$/, '/mobile/dashboard'],
  [/^\/catalog$/, '/mobile/catalog'],
  [/^\/products\/([^/]+)$/, '/mobile/products/$1'],
  [/^\/articles$/, '/mobile/articles'],
  [/^\/articles\/([^/]+)$/, '/mobile/articles/$1'],
  [/^\/catalog\/([^/]+)$/, '/mobile/products/$1'],
  [/^\/track-order\/([^/]+)$/, '/mobile/customer?code=$1'],
  [/^\/track-order$/, '/mobile/customer'],
  // publicTrackingService builds the links we hand buyers as /track/:code, so this pair has to exist or
  // every shared tracking link opens the desktop page on a phone (audit round 9).
  [/^\/track\/([^/]+)$/, '/mobile/customer?code=$1'],
  [/^\/track$/, '/mobile/customer'],
  [/^\/bespoke$/, '/mobile/bespoke'],
  [/^\/cart$/, '/mobile/cart'],
  [/^\/checkout$/, '/mobile/checkout'],
  [/^\/payment$/, '/mobile/payment'],
  [/^\/customer$/, '/mobile/customer'],
  [/^\/customer\/invoice\/([^/]+)$/, '/mobile/customer/invoice/$1'],
  [/^\/login$/, '/mobile/login'],
  [/^\/reset-password$/, '/mobile/reset-password'],
  [/^\/authenticator$/, '/mobile/authenticator'],
  [/^\/studio$/, '/mobile/studio'],
  [/^\/studio\/products$/, '/mobile/studio/products'],
  [/^\/studio\/products\/new$/, '/mobile/studio/products/new'],
  [/^\/studio\/products\/([^/]+)\/edit$/, '/mobile/studio/products/$1/edit'],
  [/^\/studio\/product-categories$/, '/mobile/studio/product-categories'],
  // No entries for /studio/products/inventory or /studio/stories on purpose: neither has a mobile page
  // yet, so a phone stays on the desktop one rather than being sent to a 404.

  [/^\/studio\/vouchers$/, '/mobile/studio/vouchers'],
  [/^\/studio\/shipping$/, '/mobile/studio/shipping'],
  [/^\/studio\/orders$/, '/mobile/studio/orders'],
  [/^\/studio\/orders\/([^/]+)$/, '/mobile/studio/orders/$1'],
  [/^\/studio\/customers$/, '/mobile/studio/customers'],
  [/^\/studio\/site-images$/, '/mobile/studio/site-images'],
  [/^\/studio\/shipments$/, '/mobile/studio/fulfillment'],
  [/^\/dashboard$/, '/mobile/studio'],
  // Public journal index → public mobile articles tab (NOT the protected studio journal).
  [/^\/journal$/, '/mobile/articles'],
  [/^\/journal\/new$/, '/mobile/journal/new'],
  [/^\/journal\/([^/]+)\/edit$/, '/mobile/journal/$1/edit'],
  [/^\/journal\/([^/]+)$/, '/mobile/journal/$1'],
  [/^\/raw-materials$/, '/mobile/raw-materials'],
  [/^\/raw-material-audit$/, '/mobile/raw-material-audit'],
  [/^\/raw-material\/([^/]+)$/, '/mobile/raw-material/$1'],
  [/^\/categories$/, '/mobile/categories'],
  [/^\/formulas$/, '/mobile/formulas'],
  [/^\/formulas\/new$/, '/mobile/formulas/new'],
  [/^\/formulas\/([^/]+)\/edit$/, '/mobile/formulas/$1/edit'],
  [/^\/formulas\/([^/]+)$/, '/mobile/formulas/$1'],
  [/^\/validation$/, '/mobile/validation'],
  [/^\/accords$/, '/mobile/formulas'],
  [/^\/accords\/new$/, '/mobile/formulas/new'],
  [/^\/accords\/([^/]+)$/, '/mobile/formulas'],
  [/^\/accord\/([^/]+)$/, '/mobile/formulas'],
  [/^\/batches$/, '/mobile/batches'],
  [/^\/batches\/([^/]+)$/, '/mobile/batches/$1'],
  [/^\/production-costing$/, '/mobile/production-costing'],
];

export const isMobileBrowser = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator?.userAgent || '';
  const hasMobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(userAgent);
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const hasTabletWidth = window.matchMedia?.('(max-width: 1024px)').matches;
  const isStandaloneApp = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const hasCompactTouchViewport = Boolean(hasCoarsePointer && hasTabletWidth);

  return Boolean(hasMobileUserAgent || isStandaloneApp || hasCompactTouchViewport);
};

export const toMobilePath = (pathname) => {
  if (!pathname || pathname.startsWith(`${MOBILE_PATH_PREFIX}/`) || pathname === MOBILE_PATH_PREFIX) {
    return null;
  }

  const match = DESKTOP_TO_MOBILE_PATHS.find(([pattern]) => pattern.test(pathname));

  if (!match) {
    return null;
  }

  const [pattern, replacement] = match;
  return pathname.replace(pattern, replacement);
};
