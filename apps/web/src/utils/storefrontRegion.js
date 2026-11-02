// Which shop is this visitor looking at: the Indonesian one, or the international one.
//
// Until now this was decided entirely by guessing at the browser's timezone and language. The guess is a
// good one — a German customer has a German browser — but it is still a guess, and it cannot be argued
// with. Dekito could not see his own international shop from Indonesia, a VPN does not change it (a VPN
// moves the IP, not the clock or the language), and a visitor the guess reads wrong has no way to say so.
//
// So the visitor could choose, and the choice won; the guess was the default. Since 2026-11-02 neither
// decides any more: THE ADDRESS DOES (see resolveRegion). The guess only offers the way to the other shop.
//
// Import-free so the guard runs the rules.

export const REGION_ID = 'id';
export const REGION_EN = 'en';
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
 * The address decides: /en/... is the English shop and every other address is the Indonesian one — for
 * every visitor and every crawler.
 *
 * A stored choice and a guess at the browser used to be able to turn an Indonesian address English. Google
 * crawls from the US without an Indonesian browser, so /catalog/l-iris could reach it in English at US$95,
 * carrying two canonicals (/catalog/l-iris and /en/catalog/l-iris) and two prices (Rp 429.000 and US$95) —
 * measured 2026-11-02. Google's own advice is one address per language, and Dekito chose it: "alamat =
 * bahasa". The guess survives only as SwitchToEnglishHint, an offer to go to the other address.
 */
export const resolveRegion = (pathname) => readRegionFromPath(pathname) || REGION_ID;

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
 * The shop prefix for a region — for a link handed to a buyer who is BEING SHOWN that region.
 *
 * routerBasename above answers from the PATH, which is right for the router: the address decides which
 * routes are mounted. Until 2026-11-02 the LANGUAGE did not come from the path: resolveRegion read ?lang, then the
 * stored choice, then the guess — so /catalog renders in English for anyone who has chosen the English
 * shop, and routerBasename() answers '' on that very page.
 *
 * Measured in the browser panel: localStorage solivagant.storefront.region.v1 = 'en' and the Indonesian
 * address /catalog served the English catalogue with US$ prices. Every raw absolute link built on that
 * page from routerBasename() therefore pointed back at the Indonesian shop, which is the wrong half of
 * the pair to take from the address.
 *
 * notificationTemplateService already has the twin of this for the other case — shopPrefix(order), the
 * shop the ORDER came from, for a link Dekito sends out of Studio. This is the one for the reader in
 * front of the page.
 */
export const shopPrefixForRegion = (region) => (region === REGION_EN ? EN_PATH_PREFIX : '');

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
