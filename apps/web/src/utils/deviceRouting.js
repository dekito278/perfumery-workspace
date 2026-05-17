const MOBILE_PATH_PREFIX = '/mobile';

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

const DESKTOP_TO_MOBILE_PATHS = [
  [/^\/$/, '/mobile'],
  [/^\/home$/, '/mobile/dashboard'],
  [/^\/catalog$/, '/mobile/catalog'],
  [/^\/products\/([^/]+)$/, '/mobile/products/$1'],
  [/^\/bespoke$/, '/mobile/bespoke'],
  [/^\/cart$/, '/mobile/cart'],
  [/^\/customer$/, '/mobile/customer'],
  [/^\/login$/, '/mobile/login'],
  [/^\/studio$/, '/mobile/studio'],
  [/^\/dashboard$/, '/mobile/studio'],
  [/^\/briefs$/, '/mobile/briefs'],
  [/^\/briefs\/new$/, '/mobile/briefs/new'],
  [/^\/briefs\/([^/]+)\/edit$/, '/mobile/briefs/$1/edit'],
  [/^\/briefs\/([^/]+)$/, '/mobile/briefs/$1'],
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
