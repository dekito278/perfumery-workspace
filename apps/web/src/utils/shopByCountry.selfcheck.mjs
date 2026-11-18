// `node src/utils/shopByCountry.selfcheck.mjs`
//
// Dekito, 18 Nov 2026: a visitor abroad gets the English shop and never sees rupiah prices; a visitor in
// Indonesia gets the Indonesian shop. middleware.js decides at the edge from the connection's country,
// before a page is sent. This RUNS the rule and checks the middleware still calls it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PREVIEW_COOKIE, isRobot, shopRedirect } from './shopByCountry.js';

const O = 'https://www.solivagantscent.com';
const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const go = (path, country, extra = {}) => shopRedirect({ url: O + path, country, userAgent: ua, ...extra })?.location?.replace(O, '') ?? null;

// Abroad on an Indonesian address → the same page in the English shop, query kept.
assert.equal(go('/', 'US'), '/en');
assert.equal(go('/catalog', 'SG'), '/en/catalog');
assert.equal(go('/catalog/samhain?utm_source=ig', 'MY'), '/en/catalog/samhain?utm_source=ig');
assert.equal(go('/cart', 'JP'), '/en/cart', 'abroad, the rupiah cart is not reachable either');
assert.equal(go('/checkout', 'AU'), '/en/checkout');
assert.equal(go('/customer', 'NL'), '/en/customer', 'the Indonesian account page carries the member panel');
assert.equal(go('/articles/kisah-jason-vorhees-32209a44', 'DE'), '/en/articles/kisah-jason-vorhees-32209a44');
// In Indonesia on an English address → the Indonesian shop.
assert.equal(go('/en', 'ID'), '/');
assert.equal(go('/en/catalog/samhain', 'ID'), '/catalog/samhain');
// Already in the right shop: served as asked.
for (const [path, country] of [['/catalog', 'ID'], ['/', 'id'], ['/en/catalog', 'US'], ['/en', 'SG']]) assert.equal(go(path, country), null, `${country} ${path}`);

// Left alone: an order already placed, the Studio and everything that is not a shop page.
for (const path of ['/payment?order=SOL-1', '/pay/abc', '/track/SOL-1', '/track-order', '/customer/invoice/SOL-1',
  '/studio', '/studio/orders', '/login', '/mobile/studio', '/batches/x', '/api/orders/create', '/assets/index.js', '/favicon.ico']) {
  assert.equal(go(path, 'US'), null, `abroad must still reach ${path}`);
}
// Unknown country: no evidence, no redirect.
for (const country of ['', 'XX1', undefined]) assert.equal(go('/', country), null);
// Robots and link previews: never moved (Google crawls from the US; a moved Indonesian page leaves Indonesian search).
for (const robot of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; bingbot/2.0)',
  'facebookexternalhit/1.1', 'WhatsApp/2.23.20.0 A', 'TelegramBot (like TwitterBot)', 'Twitterbot/1.0', 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)']) {
  assert.equal(isRobot(robot), true, robot);
  assert.equal(shopRedirect({ url: `${O}/catalog`, country: 'US', userAgent: robot }), null, robot);
}
assert.equal(isRobot(ua), false);
assert.equal(isRobot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'), false);

// Dekito's door: ?toko=en|id switches the redirect off for that browser; ?toko=auto back on.
const on = shopRedirect({ url: `${O}/en?toko=en`, country: 'ID', userAgent: ua });
assert.equal(on.location, `${O}/en`, 'the parameter is cleaned off the address');
assert.match(on.setCookie, new RegExp(`^${PREVIEW_COOKIE}=1; Path=/; Max-Age=\\d+; SameSite=Lax; Secure$`));
assert.equal(shopRedirect({ url: `${O}/en`, country: 'ID', userAgent: ua, cookie: `x=1; ${PREVIEW_COOKIE}=1` }), null, 'with the cookie, no redirect');
assert.match(shopRedirect({ url: `${O}/?toko=auto`, country: 'ID', userAgent: ua }).setCookie, /Max-Age=0/);

// The middleware calls this rule with the edge's country header, and only for shop pages.
const middleware = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'middleware.js'), 'utf8');
assert.match(middleware, /import \{ shopRedirect \} from '\.\/src\/utils\/shopByCountry\.js';/);
assert.match(middleware, /country: request\.headers\.get\('x-vercel-ip-country'\)/);
assert.match(middleware, /status: 307/, 'temporary: the same address answers differently by country');
assert.doesNotMatch(middleware, /studio|login|\/api/, 'the matcher never reaches the Studio, login or the API');
console.log('shopByCountry selfcheck OK (abroad → /en, Indonesia → /, orders/Studio/robots untouched, preview door)');
