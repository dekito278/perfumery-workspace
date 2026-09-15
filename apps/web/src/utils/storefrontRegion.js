// Which shop is this visitor looking at: the Indonesian one, or the international one.
//
// Until now this was decided entirely by guessing at the browser's timezone and language. The guess is a
// good one — a German customer has a German browser — but it is still a guess, and it cannot be argued
// with. Dekito could not see his own international shop from Indonesia, a VPN does not change it (a VPN
// moves the IP, not the clock or the language), and a visitor the guess reads wrong has no way to say so.
//
// So the visitor can now choose, and the choice wins. The guess stays as the DEFAULT, which is what keeps
// the German customer from having to choose anything at all.
//
// Import-free so the guard runs the rules.

export const REGION_ID = 'id';
export const REGION_EN = 'en';
export const REGION_STORAGE_KEY = 'solivagant.storefront.region.v1';
export const REGION_QUERY_KEY = 'lang';

const VALID = [REGION_ID, REGION_EN];

// The English shop has its own address. ?lang=en (below) made it shareable; a path makes it *previewable*,
// which is the half that was missing. One prerendered HTML file can only carry one title, one description
// and one og:image, so /catalog/hug-n-1?lang=en handed WhatsApp and Instagram the Indonesian card — the
// link Dekito sends abroad previewed in a language its reader does not read. /en/catalog/hug-n-1 is a
// second file, so it can say its own English words.
export const EN_PATH_PREFIX = '/en';


export const isValidRegion = (value) => VALID.includes(value);

/**
 * @param stored           what this browser chose last time, if anything
 * @param detectedOverseas what isLikelyOverseas() makes of the browser
 * @param fromUrl          ?lang= on the address that was opened, if anything
 *
 * Three sources, and the order is the point.
 *
 * ?lang wins over everything, INCLUDING a stored choice. That is the whole reason it exists: the link
 * is how Dekito hands an overseas buyer the English shop, and a browser that had once chosen Indonesian
 * would otherwise quietly override the link it was just sent.
 *
 * A stored choice wins over the guess, including a choice of Indonesia made by someone the detection
 * thinks is abroad — that is precisely the person the switch exists for, and second-guessing them would
 * make the switch a suggestion rather than a control.
 *
 * The guess is only the default, which is what keeps the German customer from having to choose at all.
 */
export const resolveRegion = (stored, detectedOverseas, fromUrl) => {
  if (isValidRegion(fromUrl)) return fromUrl;
  if (isValidRegion(stored)) return stored;
  return detectedOverseas ? REGION_EN : REGION_ID;
};

/** ?lang=en on the address the visitor opened. Null when absent, unreadable, or not a region we have. */
export const readRegionFromUrl = (search) => {
  try {
    const query = typeof search === 'string' ? search : window.location.search;
    const value = new URLSearchParams(query).get(REGION_QUERY_KEY);
    return isValidRegion(value) ? value : null;
  } catch {
    // No window (the prerender) or a search string URLSearchParams refuses. The stored choice and the
    // guess still decide, which is where a visitor with no link starts anyway.
    return null;
  }
};

/** The English shop's own address: /en, or anything under /en/. Null for the Indonesian shop. */
export const readRegionFromPath = (pathname) => {
  const path = typeof pathname === 'string'
    ? pathname
    : (typeof window === 'undefined' ? '' : window.location.pathname);
  return path === EN_PATH_PREFIX || path.startsWith(`${EN_PATH_PREFIX}/`) ? REGION_EN : null;
};

/**
 * window.location.pathname as the ROUTER sees it — with the English shop's prefix taken off.
 *
 * Anything asking "is this a /mobile page?" has to ask about the route, not the address: inside the
 * English shop the address is /en/mobile/home, and a bare startsWith('/mobile') answers no. That is how
 * the service worker resume check and the order's surface field would quietly go wrong for exactly the
 * overseas buyer on a phone this shop was built for.
 */
export const barePathname = (pathname) => {
  const path = typeof pathname === 'string'
    ? pathname
    : (typeof window === 'undefined' ? '/' : window.location.pathname);
  return path.replace(/^\/en(?=\/|$)/, '') || '/';
};

/**
 * What React Router must be told it is mounted under, so every `to="/catalog"` in the app keeps the
 * prefix without one of the 68 links having to know the shop exists in two languages.
 */
export const routerBasename = (pathname) => (readRegionFromPath(pathname) ? EN_PATH_PREFIX : '');

/**
 * This same page in the other shop, or null when it is already the address being shown.
 *
 * ?lang is dropped on the way: the path says which shop this is now, and leaving both would let a
 * copied address argue with itself.
 */
export const regionHref = (region, location) => {
  if (!isValidRegion(region)) return null;
  const from = location || (typeof window === 'undefined' ? null : window.location);
  if (!from) return null;
  const bare = String(from.pathname || '/').replace(/^\/en(?=\/|$)/, '') || '/';
  const path = region === REGION_EN ? `${EN_PATH_PREFIX}${bare === '/' ? '' : bare}` || EN_PATH_PREFIX : bare;
  let search = '';
  try {
    const params = new URLSearchParams(from.search || '');
    params.delete(REGION_QUERY_KEY);
    const rest = params.toString();
    search = rest ? `?${rest}` : '';
  } catch {
    search = '';
  }
  const next = `${path}${search}${from.hash || ''}`;
  return next === `${from.pathname}${from.search || ''}${from.hash || ''}` ? null : next;
};

export const readStoredRegion = () => {
  try {
    const value = window.localStorage.getItem(REGION_STORAGE_KEY);
    return isValidRegion(value) ? value : null;
  } catch {
    // Private windows and blocked storage throw on read. No stored choice, so the guess decides — the
    // same place a first-time visitor starts.
    return null;
  }
};

export const writeStoredRegion = (region) => {
  if (!isValidRegion(region)) return false;
  try {
    window.localStorage.setItem(REGION_STORAGE_KEY, region);
    return true;
  } catch {
    // Blocked storage must not break the switch: the choice still applies to this page view, it just
    // will not survive a reload. Returning false rather than throwing keeps that honest for the caller.
    return false;
  }
};
