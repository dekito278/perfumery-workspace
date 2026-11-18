// Which shop a visitor gets, decided by the country their connection comes from (Dekito, 18 Nov 2026):
// "kalau dia akses luar ya udah pakai luar aja, kalau dia akses Indo ya udah Indo aja — jangan sampai orang
// luar bisa ngelihat harga Indonesia". So a visitor outside Indonesia who opens an Indonesian-shop address
// is sent to the same page in the English shop (US$, DHL), and a visitor in Indonesia who opens an
// English-shop address is sent to the Indonesian one. The ID/EN switch is gone from the pages; the country
// decides.
//
// Run by middleware.js at the edge, BEFORE any page is sent, so a visitor abroad never receives the
// rupiah prices that the Indonesian pages carry in their HTML. Import-free so a guard can run it.
//
// Four things it deliberately leaves alone:
//   1. Search and link-preview robots. Google crawls mostly from the US; sending it to /en would drop the
//      whole Indonesian shop from Indonesian search results, and a WhatsApp preview of an Indonesian link
//      would show the English page.
//   2. Pages that belong to an order already placed — payment, tracking and invoices. An Indonesian buyer
//      who travels with an unpaid order must still be able to pay it. (The account page itself does move:
//      the Indonesian one carries the member panel.)
//   3. Everything that is not a shop page: the Studio, login, files, the API.
//   4. A visitor whose country is unknown (no header): the page decides, as before.
//
// And one door for Dekito: `?toko=id` or `?toko=en` sets a cookie that turns the redirect off for that
// browser, so he can look at the other shop from Bogor. `?toko=auto` turns it back on. Not linked anywhere.

export const HOME_COUNTRY = 'ID';
export const PREVIEW_COOKIE = 'solivagant_toko';
export const PREVIEW_PARAM = 'toko';

// The shop pages each shop has, by first path segment. '' is the home page.
const SHOP_PAGES = new Set([
  '', 'home', 'catalog', 'products', 'articles', 'about', 'bespoke', 'journal', 'help', 'cart', 'checkout',
  'welcome', 'hug', 'chant-nocturne', 'jaipong', 'porte-vers-le-paradis', 'trace-daventure', 'customer',
]);
// Under a shop page but belonging to an order already placed: left alone (rule 2 above).
const ORDER_PAGES = /^\/customer\/invoice(\/|$)/;

const ROBOT = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|discord|preview|lighthouse|inspectiontool|googleother|bingpreview|embedly|vkshare|pinterest|skype|quora link/i;

export const isRobot = (userAgent = '') => ROBOT.test(String(userAgent || ''));

const firstSegment = (path) => String(path || '/').split('/').filter(Boolean)[0] || '';

/**
 * Where to send this request, or null to serve it as asked.
 *
 * @param url        the full request URL (string or URL)
 * @param country    two-letter country of the connection ('' when unknown)
 * @param userAgent  the User-Agent header
 * @param cookie     the Cookie header
 * @returns {{ location: string, setCookie?: string } | null}
 */
export const shopRedirect = ({ url, country = '', userAgent = '', cookie = '' }) => {
  let target;
  try { target = new URL(String(url)); } catch { return null; }

  // Dekito's door: set or clear the cookie, then land on the clean address.
  const preview = target.searchParams.get(PREVIEW_PARAM);
  if (preview !== null) {
    target.searchParams.delete(PREVIEW_PARAM);
    const on = preview === 'id' || preview === 'en';
    return {
      location: target.toString(),
      setCookie: on
        ? `${PREVIEW_COOKIE}=1; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
        : `${PREVIEW_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`,
    };
  }
  if (new RegExp(`(?:^|;\\s*)${PREVIEW_COOKIE}=1(?:;|$)`).test(String(cookie || ''))) return null;
  if (isRobot(userAgent)) return null;

  const code = String(country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;

  const path = target.pathname.replace(/\/+$/, '') || '/';
  const inEnglishShop = path === '/en' || path.startsWith('/en/');
  const rest = inEnglishShop ? (path.slice(3) || '/') : path;
  if (!SHOP_PAGES.has(firstSegment(rest)) || ORDER_PAGES.test(rest)) return null;

  const abroad = code !== HOME_COUNTRY;
  if (abroad && !inEnglishShop) {
    target.pathname = rest === '/' ? '/en' : `/en${rest}`;
    return { location: target.toString() };
  }
  if (!abroad && inEnglishShop) {
    target.pathname = rest;
    return { location: target.toString() };
  }
  return null;
};
