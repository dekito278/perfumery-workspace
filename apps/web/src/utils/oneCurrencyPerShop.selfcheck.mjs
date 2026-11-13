// `node src/utils/oneCurrencyPerShop.selfcheck.mjs`
//
// Dekito's brief, 14 Nov 2026 (P0): never show the two currencies side by side. The Indonesian retail price
// (Rp 479.000, about US$27) is below the international stockists' wholesale price (US$39), and a stockist
// reading the rupiah next to the dollar feels short-changed. The live site set them together in two places:
// the Indonesian product page ("Rp 479.000" and under it "Harga untuk pengiriman ke luar negeri: US$80"),
// and the English one ("US$80" and under it "Shopping from Indonesia? See Indonesian prices").
//
// The rule: the Indonesian shop prices in rupiah only, the English shop in dollars only. The header's
// ID/EN switch is the way between them. A bottle with no export price reads "Price on request" in English.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// --- 1. The source: no dollar line in the Indonesian shop, no rupiah fallback in the English one -----------
const pdp = read('pages', 'PublicProductDetailPage.jsx');
assert.ok(!existsSync(join(root, 'components', 'storefront', 'SwitchToIndonesiaHint.jsx')),
  'SwitchToIndonesiaHint is back — "See Indonesian prices" under the dollar price');
assert.match(pdp, /\) : isInternational \? \(\s*\/\/[^\n]*\n\s*<p className="m-0 font-ng-display text-\[40px\] leading-none">\{t\('price\.onRequest'\)\}<\/p>/,
  'the English product page falls back to the rupiah price when a bottle has no export price');
assert.match(pdp, /isInternational && !exportPrice \? t\('pdp\.addToCart'\)/, 'the English add-to-cart label names a rupiah price');
assert.match(pdp, /isInternational && !exportPrice \? t\('price\.onRequest'\) : quotedInternationalPrice/, 'the English sticky bar names a rupiah price');
const card = read('components', 'storefront', 'CardPrice.jsx');
assert.match(card, /if \(isInternational\) return <span className=\{className\}>\{t\('price\.onRequest'\)\}<\/span>;/,
  'an English card with no export price shows the rupiah price');

// --- 2. The built pages, when there is a build with products in it ----------------------------------------
const dist = join(root, '..', 'dist');
const pages = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'index.html')))
  .map((entry) => join(dir, entry.name, 'index.html')) : []);
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<meta[^>]*>/g, '');
let scanned = 0;
for (const file of pages(join(dist, 'catalog'))) {
  scanned += 1;
  assert.doesNotMatch(visible(readFileSync(file, 'utf8')), /US\$\s?\d/, `${file} (Indonesian) shows a dollar price`);
}
for (const file of pages(join(dist, 'en', 'catalog'))) {
  scanned += 1;
  const html = readFileSync(file, 'utf8');
  assert.doesNotMatch(visible(html), /\bRp\s?\d/, `${file} (English) shows a rupiah price`);
  assert.doesNotMatch(html, /"priceCurrency":"IDR"|product:price:currency" content="IDR"/, `${file} (English) tells search engines a rupiah price`);
}

console.log(`oneCurrencyPerShop selfcheck OK (rupiah in the Indonesian shop, dollars in the English one; ${scanned} built product pages scanned)`);
