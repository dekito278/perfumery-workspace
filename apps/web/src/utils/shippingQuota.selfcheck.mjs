// `node src/utils/shippingQuota.selfcheck.mjs`
//
// Fifth visitor audit, 13 Nov 2026: RajaOngkir's daily quota ran out and every area search answered 429
// "Daily limit exceeded". The checkout showed "Gagal menghitung ongkir. Coba pakai nama kecamatan atau
// kota." — the buyer retyped a correct address while no Indonesian order could be finished at all.
// What has to stay true:
//   1. the quota is spent once per question — area searches are cached at the edge, rates in memory;
//   2. an exhausted quota is reported as such ('shipping_quota'), never as a bad address;
//   3. checkout and bespoke say the calculator is unavailable today and offer WhatsApp.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const api = read('..', 'api', 'shipping', 'rates.js');
assert.match(api, /const QUOTA = \{ code: 'shipping_quota'/);
assert.equal((api.match(/if \(isQuotaAnswer\(rajaResponse\.status, data\)\) \{\s*return jsonResponse\(response, 503, QUOTA\);/g) || []).length, 2,
  'both the area search and the rate quote report the quota as such');
assert.equal((api.match(/response\.setHeader\('Cache-Control', CACHE_AREA_SEARCH\);/g) || []).length, 2, 'area searches (found or not) are kept at the edge');
assert.match(api, /s-maxage=\d{5,}/, 'for days, not seconds');
assert.match(api, /const known = cachedRates\(cacheKey\);\s*if \(known\) return jsonResponse\(response, 200, \{ rates: known \}\);/, 'a rate already asked is not asked again');

const service = read('services', 'shippingService.js');
assert.match(service, /error\.code = data\.code \|\| '';/, 'the code travels with the error');

const flow = read('hooks', 'useCheckoutFlow.js');
assert.match(flow, /if \(error\?\.code === 'shipping_quota'\) return SHIPPING_QUOTA_MESSAGE;/);
const checkout = read('pages', 'CheckoutPage.jsx');
assert.match(checkout, /\{shippingError === SHIPPING_QUOTA_MESSAGE \? \(\s*<AskAtelierButton[\s\S]{0,200}draftKey="checkout\.waShippingDraft"/, 'checkout offers WhatsApp with the basket');
const bespoke = read('pages', 'BespokePage.jsx');
assert.match(bespoke, /if \(error\?\.code === 'shipping_quota'\) return 'bsp\.shippingQuota';/);
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['checkout.waShippingDraft'], /\{items\}/, `${language}: the WhatsApp draft names the basket`);
  assert.match(MESSAGES[language]['bsp.shippingQuota'], /WhatsApp/, `${language}: bespoke points to WhatsApp`);
}

console.log('shippingQuota selfcheck OK (the courier quota is spent once per question, and running out is said as such)');
