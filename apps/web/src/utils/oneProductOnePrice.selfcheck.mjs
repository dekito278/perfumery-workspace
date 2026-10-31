// `node src/utils/oneProductOnePrice.selfcheck.mjs`
//
// What the product page tells GOOGLE has to be what it tells the buyer.
//
// buildProductJsonLd emitted priceCurrency IDR and the rupiah figure to every visitor on earth,
// /en/catalog/<slug> included: structured data saying the bottle costs Rp 359.000 while the page in
// front of the buyer said US$80. Google runs the JavaScript, so the rich result is built from the one
// that is wrong. It is the same leak as the rupiah in the crawler snapshot, one layer in — and the
// brief names it: "jangan sampai JSON-LD memuat IDR untuk pengunjung luar".
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { buildProductJsonLd } from './seo.js';
import { usdPriceFor } from './usdPrice.js';

const src = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://www.solivagantscent.com';
// La Tulipe as the live tables hold it: domestic 359.000, overseas tier 1.260.000 -> US$80.
const product = {
  slug: 'la-tulipe', name: 'La Tulipe', priceNumber: 359000, publicStatus: 'Available',
  description: 'A tribute to the tulip.', category: 'Floral',
};
const EXPORT_IDR = 1260000;

// --- 1. The Indonesian shop still says rupiah --------------------------------------------------------
const domestic = buildProductJsonLd(product, { origin: ORIGIN });
assert.equal(domestic.offers.priceCurrency, 'IDR', 'the domestic page is unchanged');
assert.equal(domestic.offers.price, 359000);

// --- 2. The English shop says dollars, and the SAME dollars the page shows ---------------------------
const usd = usdPriceFor(EXPORT_IDR);
assert.equal(usd, 80, 'the shop rounds 1.260.000 to US$80 — this is the number on the page');
const international = buildProductJsonLd(product, {
  origin: ORIGIN, offer: { currency: 'USD', price: usd },
});
assert.equal(international.offers.priceCurrency, 'USD', 'the English page states its own currency');
assert.equal(international.offers.price, 80, 'and its own figure, not the rupiah one');
// The whole point, as a property rather than a value: no rupiah may survive anywhere in the document.
const asText = JSON.stringify(international);
assert.ok(!asText.includes('IDR'), 'no IDR anywhere in the international offer');
assert.ok(!asText.includes('359000'), 'and not the domestic number either');
assert.ok(asText.includes('"price":80'), 'the dollar figure is the one a crawler reads');

// A zero or missing export price must not blank the offer — it falls back to the domestic one rather
// than emitting a Product with no price, which Google reads as unavailable.
for (const bad of [null, { currency: 'USD', price: 0 }, { currency: 'USD' }]) {
  const fallback = buildProductJsonLd(product, { origin: ORIGIN, offer: bad });
  assert.equal(fallback.offers.priceCurrency, 'IDR', `offer ${JSON.stringify(bad)} falls back, not blank`);
  assert.equal(fallback.offers.price, 359000);
}

// --- 3. Both product pages pass it, and from the same hook ------------------------------------------
// Two pages render a product — the standard one and the immersive one that REPLACES it when a product
// has a story. A fix on one of them is a fix on half the catalogue, which is how the immersive page has
// slipped past guards before.
for (const page of ['PublicProductDetailPage.jsx', 'ImmersiveProductPage.jsx']) {
  const source = readFileSync(join(src, '..', 'pages', page), 'utf8');
  assert.match(source, /offer: exportPrice \? \{ currency: 'USD', price: usdPriceFor\(exportPrice\) \} : null/,
    `${page} must state the export price to Google, converted the way the page displays it`);
  assert.match(source, /pdp\.syntheticAccords/,
    `${page} must carry the customs line — a US shipment was held over the word oud`);
  assert.match(source, /exportPrice \? <p className="pdp-synthetic-accords[^"]*"/,
    `${page} shows that line only where it is quoting internationally`);
}

// --- 4. The customs line says the three things it exists to say -------------------------------------
for (const language of ['id', 'en']) {
  const text = MESSAGES[language]['pdp.syntheticAccords'];
  assert.ok(text, `${language} has the line`);
  assert.match(text, /sintetis|synthetic/i, `${language}: names the accords synthetic`);
  assert.match(text, /CITES/, `${language}: names CITES, which is what a reviewer searches for`);
  assert.match(text, /hewan|animal/i, `${language}: and says nothing comes from an animal`);
}
assert.notEqual(MESSAGES.id['pdp.syntheticAccords'], MESSAGES.en['pdp.syntheticAccords'],
  'and it is translated, not copied');

console.log('oneProductOnePrice: ok (IDR for the Indonesian shop, US$80 for the English one and no IDR '
  + 'left in it, both product pages, customs line on each)');
