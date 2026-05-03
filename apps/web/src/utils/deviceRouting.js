const MOBILE_PATH_PREFIX = '/mobile';

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

const DESKTOP_TO_MOBILE_PATHS = [
  [/^\/$/, '/mobile'],
  [/^\/home$/, '/mobile/dashboard'],
  [/^\/login$/, '/mobile/login'],
  [/^\/dashboard$/, '/mobile/dashboard'],
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
  [/^\/batches$/, '/mobile/formulas'],
  [/^\/batches\/([^/]+)$/, '/mobile/formulas'],
  [/^\/production-costing$/, '/mobile/formulas'],
];

export const isMobileBrowser = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator?.userAgent || '';
  const hasMobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(userAgent);
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const hasMobileWidth = window.matchMedia?.('(max-width: 767px)').matches;
  const hasTabletWidth = window.matchMedia?.('(max-width: 1024px)').matches;
  const hasPortraitAppViewport = window.matchMedia?.('(orientation: portrait) and (max-width: 900px)').matches;
  const isStandaloneApp = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

  return hasMobileUserAgent || isStandaloneApp || hasMobileWidth || (hasCoarsePointer && hasTabletWidth) || hasPortraitAppViewport;
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
