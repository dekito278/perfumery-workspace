// Page-view counting for the shop (18 Nov 2026), so "which page do buyers leave from" can be answered with
// numbers instead of guesses. Vercel Web Analytics: no cookies, no fingerprint, nothing that names a person.
//
// It counts BUYER pages only. The Studio is one person's workplace and would drown the shop's numbers, so
// anything that is not a storefront address is dropped. Addresses that carry an order number, an invoice
// or a payment token are folded to one name each, and every query string and hash is cut: an order number
// in a URL is a buyer's order, and it has no business in a traffic report.
//
// Nothing happens until the Analytics switch is on for this project in Vercel; before that the script
// simply is not served and the queue below is never read.

const BUYER_PREFIXES = [
  '/home', '/catalog', '/products', '/articles', '/about', '/bespoke', '/journal', '/help', '/cart',
  '/checkout', '/payment', '/customer', '/welcome', '/track', '/track-order',
];

const FOLD = [
  [/^\/(track|track-order)\/[^/]+$/, '/$1/:order'],
  [/^\/customer\/invoice\/[^/]+$/, '/customer/invoice/:order'],
  [/^\/pay\/[^/]+$/, '/pay/:token'],
];

/** The address to report for `href`, or null when this page is not counted. */
export const analyticsUrl = (href) => {
  let url;
  try { url = new URL(href); } catch { return null; }
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const shop = path === '/en' || path.startsWith('/en/') ? '/en' : '';
  const rest = shop ? (path.slice(3) || '/') : path;
  const isBuyerPage = rest === '/' || BUYER_PREFIXES.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`))
    || /^\/pay\/[^/]+$/.test(rest);
  if (!isBuyerPage) return null;
  const folded = FOLD.reduce((value, [pattern, name]) => value.replace(pattern, name), rest);
  return `${url.origin}${shop}${folded === '/' && shop ? '' : folded}`;
};

const PRODUCTION_HOSTS = new Set(['www.solivagantscent.com', 'solivagantscent.com']);

export const installPageAnalytics = () => {
  if (typeof window === 'undefined' || !PRODUCTION_HOSTS.has(window.location.hostname)) return;
  if (window.va) return;
  window.va = function va(...params) { (window.vaq = window.vaq || []).push(params); };
  window.va('beforeSend', (event) => {
    const url = analyticsUrl(event?.url || '');
    return url ? { ...event, url } : null;
  });
  const script = document.createElement('script');
  script.src = '/_vercel/insights/script.js';
  script.defer = true;
  script.dataset.sdkn = '@vercel/analytics';
  document.head.appendChild(script);
};
