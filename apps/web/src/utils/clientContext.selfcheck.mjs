// `node src/utils/clientContext.selfcheck.mjs`
// The client hint is attacker-controlled — anyone can POST to /api/orders/create with any body — so the
// only thing standing between that and a row in the orders table is this whitelist. Pin its shape.
import assert from 'node:assert/strict';
import { sanitizeClientContext, getClientContext, formatClientContext } from './clientContext.js';

assert.deepEqual(sanitizeClientContext({ surface: 'mobile', viewportWidth: 393 }), { surface: 'mobile', viewport_width: 393 });
assert.deepEqual(sanitizeClientContext({ surface: 'desktop', viewportWidth: 1440 }), { surface: 'desktop', viewport_width: 1440 });
assert.deepEqual(sanitizeClientContext({ viewportWidth: '1280' }), { viewport_width: 1280 }, 'numeric strings are fine');

// The shop the order was placed in. It decides the language of every message the buyer receives
// afterwards (notificationLanguage.selfcheck), so it has to survive the whitelist — and only these two
// values may, because anything else would land in the templates as a key that matches nothing.
assert.deepEqual(sanitizeClientContext({ shop: 'en' }), { shop: 'en' });
assert.deepEqual(sanitizeClientContext({ shop: 'id' }), { shop: 'id' });
assert.deepEqual(sanitizeClientContext({ shop: 'EN' }), {}, 'exact match only, here too');
assert.deepEqual(sanitizeClientContext({ shop: 'fr' }), {}, 'a shop we do not have is not stored');
assert.deepEqual(sanitizeClientContext({ surface: 'mobile', shop: 'en', viewportWidth: 393 }),
  { surface: 'mobile', shop: 'en', viewport_width: 393 }, 'all three travel together');

// Anything the caller invents is dropped, not stored.
assert.deepEqual(sanitizeClientContext({ surface: '<script>alert(1)</script>' }), {});
assert.deepEqual(sanitizeClientContext({ surface: 'MOBILE' }), {}, 'exact match only');
assert.deepEqual(sanitizeClientContext({ surface: 'mobile', evil: 'DROP TABLE', userAgent: 'x' }), { surface: 'mobile' },
  'extra keys never survive — the column must stay narrow');
assert.deepEqual(sanitizeClientContext({ viewportWidth: -5 }), {});
assert.deepEqual(sanitizeClientContext({ viewportWidth: 999999 }), {}, 'absurd widths are refused');
assert.deepEqual(sanitizeClientContext({ viewportWidth: NaN }), {});
assert.deepEqual(sanitizeClientContext({}), {});
assert.deepEqual(sanitizeClientContext(), {});
assert.deepEqual(sanitizeClientContext(null), {});

// Collecting outside a browser must not throw — the module is imported by the serverless endpoint.
assert.deepEqual(getClientContext(), {}, 'no window, no context, no crash');

// --- and inside one, it actually records the shop ----------------------------------------------------
// The whitelist above is worthless if the browser never sends the field. This stands a fake browser up
// and reads what the collector produces, rather than reading the source and hoping.
const inBrowser = (pathname, lang) => {
  globalThis.window = { location: { pathname, search: '' }, innerWidth: 393 };
  globalThis.document = { documentElement: { lang } };
  try { return getClientContext(); } finally { delete globalThis.window; delete globalThis.document; }
};
assert.equal(inBrowser('/en/mobile/checkout', 'en').shop, 'en', 'an order placed in the English shop was not marked as one');
assert.equal(inBrowser('/mobile/checkout', 'id').shop, 'id');
// The page's language, not the path: a visitor sent a ?lang=en link checks out at a bare /checkout and
// is still reading English, and that is the buyer these messages exist for.
assert.equal(inBrowser('/checkout', 'en').shop, 'en', 'the English shop was missed because the path had no prefix');
assert.equal(inBrowser('/en/mobile/checkout', 'en').surface, 'mobile', 'the /en prefix swallowed the surface');

// Studio reads this back as one line under the order. The English shop is the only value worth a word:
// every other order is Indonesian, and printing that on all of them would bury the one that is not.
assert.equal(formatClientContext({ surface: 'mobile', viewport_width: 393, shop: 'en' }), 'Mobile · 393px · Toko EN');
assert.equal(formatClientContext({ surface: 'mobile', viewport_width: 393, shop: 'id' }), 'Mobile · 393px');
assert.equal(formatClientContext({ surface: 'mobile', viewport_width: 393 }), 'Mobile · 393px');

console.log('clientContext selfcheck OK');
