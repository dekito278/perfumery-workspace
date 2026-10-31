const MOBILE_PATH_PREFIX = '/mobile';

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

// The STUDIO's phone screens only. The storefront had a phone twin of every page until 2026-10-31; the
// redesign made the shop one responsive set of pages, so a phone stays on the address it asked for.
const DESKTOP_TO_MOBILE_PATHS = [
  // No entries for /track or /track-order on purpose. Round 9 pointed them at /mobile/customer?code=,
  // but that page's ?code= is the CUSTOMER code (SOLI-...), not the order number — so every tracking
  // link we send (WhatsApp message and the QR printed on the parcel carry /track/<orderNumber>) opened
  // on a phone answered "that customer code was not found". PublicTrackingPage already reads fine at
  // phone width, so a phone stays on it. See trackingLink.selfcheck.mjs.
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

// The other direction, for the storefront phone addresses that were retired. They are still linked from
// places this code does not control — WhatsApp messages already sent, the QR printed on parcels, home-screen
// icons installed from the old manifest, bookmarks — so they answer with the page they always meant rather
// than a 404. Search and hash are the caller's to carry; this maps the path.
const RETIRED_MOBILE_STOREFRONT = [
  [/^\/mobile\/?$/, '/home'],
  [/^\/mobile\/(home|dashboard)$/, '/home'],
  [/^\/mobile\/catalog$/, '/catalog'],
  [/^\/mobile\/articles$/, '/journal'],
  [/^\/mobile\/products\/([^/]+)$/, '/catalog/$1'],
  [/^\/mobile\/articles\/([^/]+)$/, '/articles/$1'],
  [/^\/mobile\/(about|bespoke|cart|checkout|payment|welcome|customer)$/, '/$1'],
  [/^\/mobile\/customer\/invoice\/([^/]+)$/, '/customer/invoice/$1'],
];

export const fromRetiredMobileStorefront = (pathname) => {
  const match = RETIRED_MOBILE_STOREFRONT.find(([pattern]) => pattern.test(pathname || ''));
  return match ? pathname.replace(match[0], match[1]) : null;
};
