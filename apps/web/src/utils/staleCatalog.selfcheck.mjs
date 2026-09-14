// `node src/utils/staleCatalog.selfcheck.mjs`
//
// Dekito opened his own shop through a VPN and read a product description that had been replaced two
// days earlier. The server no longer held that text anywhere — it came out of his own phone's storage,
// because the catalogue fetch failed and the app quietly served the last copy it had.
//
// The fallback is worth keeping: a stale shop beats a blank one on a bad connection. Being SILENT about
// it is not. A buyer reads prices that may have moved and adds them to a cart the order endpoint then
// prices properly at checkout, and nothing on the page hints that anything is old.
//
// This is the flag that says so, and the two transforms that must carry it to the screen.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { CATALOG_ARRAY_FLAGS, carryCatalogFlags } from './catalogArrayFlags.js';
import { attachMemberPrices } from './memberPriceNudge.js';
import { applyTierPrices } from './tierPricedCatalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The flags survive every transform between the hook and the screen --------------------------------
// Each transform rebuilds the array with .map, which drops properties hung off it. A flag that reaches
// the screen as undefined reads as "fresh", which is the exact failure this is meant to end.
assert.deepEqual(CATALOG_ARRAY_FLAGS, ['loading', 'stale']);

const products = [{ id: 'p1', slug: 'la-tulipe', priceNumber: 289000, variants: [{ id: '30-ml', priceNumber: 289000 }] }];
Object.defineProperty(products, 'loading', { configurable: true, enumerable: false, value: true });
Object.defineProperty(products, 'stale', { configurable: true, enumerable: false, value: true });

// The real index shape, as indexTierPrices builds it: slug -> variantId -> { tier: price }.
const memberIndex = { 'la-tulipe': { '30-ml': { member: 260000 } } };
const tiered = applyTierPrices(products, 'retail', memberIndex, String);
const nudged = attachMemberPrices(tiered, memberIndex);
assert.notEqual(nudged, products, 'the nudge really does rebuild the array — otherwise this proves nothing');
assert.equal(nudged.stale, true, 'stale reaches the screen through applyTierPrices + attachMemberPrices');
assert.equal(nudged.loading, true, 'and so does loading');

// A fresh catalogue must arrive as NOT stale, or one failure marks the shop stale for the whole session.
const fresh = [{ id: 'p1', slug: 'la-tulipe', priceNumber: 289000, variants: [{ id: '30-ml', priceNumber: 289000 }] }];
Object.defineProperty(fresh, 'stale', { configurable: true, enumerable: false, value: false });
assert.equal(attachMemberPrices(applyTierPrices(fresh, 'retail', memberIndex, String), memberIndex).stale,
  false, 'a fresh read clears the flag rather than leaving it undefined');

// --- 2. The helper itself -------------------------------------------------------------------------------
{
  const source = []; Object.defineProperty(source, 'stale', { value: true, configurable: true, enumerable: false });
  const next = carryCatalogFlags([1, 2], source);
  assert.equal(next.stale, true);
  assert.equal(next.loading, false, 'a flag the source never had reads as false, never undefined');
  assert.equal(Object.keys(next).length, 2, 'the flags stay non-enumerable — they must not land in a payload or a render');
  assert.equal(JSON.stringify(carryCatalogFlags([1], source)), '[1]', 'nor in JSON');
  assert.equal(carryCatalogFlags(source, source), source, 'carrying onto itself is a no-op, not a redefinition');
  assert.equal(carryCatalogFlags(null, source), null, 'no array, no crash');
}

// --- 3. The service marks both outcomes -----------------------------------------------------------------
const service = read('services', 'productCatalogService.js');
assert.match(service, /fetchMonitor\.finish\('fallback'[\s\S]{0,400}?return markStale\(products, true\);/,
  'the local fallback is marked stale');
assert.match(service, /fetchMonitor\.finish\('success'[\s\S]{0,300}?return markStale\(products, false\);/,
  'and a successful read clears it — otherwise one failure poisons the rest of the session');
assert.match(service, /Object\.defineProperty\(products, 'stale', \{ configurable: true, enumerable: false/,
  'non-enumerable, so it never reaches a payload');

// --- 4. The hook: false until a fetch has actually FAILED -------------------------------------------------
// The first render shows this browser's stored catalogue while the fetch is still in flight. Starting
// true would warn on every single page load, and a warning that always shows is one nobody reads.
const hook = read('hooks', 'useCatalogProducts.js');
assert.match(hook, /const \[stale, setStale\] = useState\(false\);/, 'starts false');
assert.match(hook, /setProducts\(Array\.isArray\(nextProducts\) \? nextProducts : \[\]\);\s*setStale\(Boolean\(nextProducts\?\.stale\)\);/,
  'a completed sync takes the flag from the data it just got');
assert.match(hook, /setProducts\(editableOnly \? \[\] : getCatalogProducts\(\)\);\s*setStale\(true\);/,
  'and the hook\'s own catch — a second silent fallback — marks it too');
assert.match(hook, /Object\.defineProperty\(products, 'stale', \{[\s\S]{0,120}?value: stale,/,
  'hung off the array the pages already read `loading` from');

// --- 5. Said out loud, on all four buyer-facing surfaces ---------------------------------------------------
// Desktop and mobile drifting apart is this repo's commonest defect, and a notice that appears on three
// screens out of four is worse than none: it teaches the buyer the other screen is trustworthy.
const notice = read('components', 'storefront', 'StaleCatalogNotice.jsx');
assert.match(notice, /if \(!stale\) return null;/, 'silent unless actually stale');
// The wording moved into the message file when the storefront learned English. Both languages have to
// carry the consequence, not just the cause: "we could not reach the server" alone reads as a spinner,
// while "these prices may be out of date" is the sentence that makes a buyer check.
assert.match(notice, /t\('stale\.body'\)/, 'and plain about what happened when it is');
assert.match(MESSAGES.id['stale.body'], /Koneksi ke server gagal/);
assert.match(MESSAGES.id['stale.body'], /bisa sudah tidak berlaku/, 'naming the consequence, not just the cause');
assert.match(MESSAGES.en['stale.body'], /out of date/i, 'and the English names it too');
assert.ok(MESSAGES.en['stale.retry'], 'with a way to retry in both languages');
assert.match(notice, /role="status"/, 'announced to a screen reader too');
assert.doesNotMatch(notice, /disabled|return null;\s*\}\s*$/m, 'it informs, it does not block the shop');

for (const [page, variable] of [
  [['pages', 'CatalogPage.jsx'], 'fetchedProducts'],
  [['pages', 'mobile', 'MobileCatalogPage.jsx'], 'catalogProducts'],
  [['pages', 'PublicProductDetailPage.jsx'], 'studioProducts'],
  [['pages', 'mobile', 'MobileProductDetailPage.jsx'], 'allProducts'],
]) {
  const source = read(...page);
  assert.match(source, new RegExp(`<StaleCatalogNotice stale=\\{${variable}\\.stale\\}`),
    `${page.join('/')} shows the notice, reading the flag off its own catalogue`);
}

console.log('staleCatalog selfcheck OK (a catalogue served from this device because the server could not be reached says so, on all four buyer-facing screens)');
