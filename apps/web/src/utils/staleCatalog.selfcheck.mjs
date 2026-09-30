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
import { readdirSync, readFileSync } from 'node:fs';
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

// --- and no page escapes by REPLACING one of those ------------------------------------------------------
// The four above are written by hand, and a hand-written list cannot see a page that stands in for one.
// Both product pages `return <ImmersiveProductPage …>` as soon as a product has a story — before they
// reach their own notice — so for the shop's immersive product the warning never rendered at all. That
// is the page where the buyer adds to cart, reading a price that may be days old.
//
// So the subject is derived: a page that renders the shared product visual is a page showing a product
// to a buyer, and the ones where the buyer ACTS on the price have to admit when it might be stale.
const pagesRoot = join(root, 'pages');
const walkPages = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walkPages(join(dir, entry.name)) : [join(dir, entry.name)]
));
// Exempt for what each IS, not for its name.
const NOT_WHERE_A_PRICE_IS_ACTED_ON = new Map([
  ['ProductListPage.jsx', 'Studio: the catalogue is the thing being edited, and a failed fetch there already fails loudly'],
  ['MobileProductListPage.jsx', 'Studio, same'],
  ['CartPage.jsx', 'lines already chosen; cartPriceChange is the guard that reprices them against the live catalogue'],
  ['MobileCartPage.jsx', 'same'],
  ['CheckoutPage.jsx', 'same, and the order endpoint prices the order itself'],
  ['MobileCheckoutPage.jsx', 'same'],
  ['HomePage.jsx', 'a doorway: every card leads to the catalogue or the product page, which carry the notice'],
  ['MobileStorefrontPage.jsx', 'same doorway'],
]);
const showsAProduct = walkPages(pagesRoot)
  .filter((file) => file.endsWith('.jsx'))
  .map((file) => [file.slice(pagesRoot.length + 1), readFileSync(file, 'utf8')])
  .filter(([, source]) => /<ProductVisual/.test(source));
assert.ok(showsAProduct.length >= 10,
  `only ${showsAProduct.length} pages render the product visual — the scan is broken, not the code`);

let actingSurfaces = 0;
for (const [name, source] of showsAProduct) {
  if (NOT_WHERE_A_PRICE_IS_ACTED_ON.has(name.split('/').pop())) continue;
  assert.match(source, /<StaleCatalogNotice stale=\{/,
    `${name} shows a buyer a price without admitting the catalogue may have come from their own device. `
    + 'That is the VPN incident this guard was written for, on a page it could not see.');
  actingSurfaces += 1;
}
assert.ok(actingSurfaces >= 5,
  `only ${actingSurfaces} surfaces checked — the exemptions swallowed them`);

// The notice on a stand-in page is only as alive as the flag it is handed. A page that renders one of
// these and forgets the prop leaves a component that can never fire — silent in exactly the way this
// guard exists to prevent, and green to every check above.
const standIns = walkPages(pagesRoot)
  .filter((file) => file.endsWith('.jsx'))
  .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/<(\w*ProductPage)\b([^>]*)>/g)]
    .filter(([, name]) => name !== 'ProductPage')
    .map(([, name, props]) => [file.slice(pagesRoot.length + 1), name, props]));
assert.ok(standIns.length >= 2, `only ${standIns.length} pages render a stand-in product page — the scan is broken`);
for (const [where, name, props] of standIns) {
  // A spread forwards it: the immersive page's own shell renders itself as `<ImmersiveProductPage
  // {...props} />`, which passes the flag along rather than dropping it.
  assert.match(props, /stale=\{|\{\.\.\.props\}/,
    `${where} renders <${name}> without handing it the staleness of its own catalogue, so the notice `
    + 'inside it can never fire');
}

// --- Every screen where a buyer acts on a price -------------------------------------------------------
// This file's own closing line has always claimed that, and nothing checked it. The flag reached four
// screens — the two catalogues and the two product pages — and stopped there. The CART did not have it,
// which is the one that matters most: the cart reprices its lines from this very catalogue, so a stale
// one shows a subtotal the order endpoint will not honour, and the buyer meets the real number after
// pressing pay. The home pages, which open on prices, were silent too.
//
// Counted, not listed: useStorefrontProducts is the BUYER's hook by its own definition ("The catalog as
// this visitor may buy it. Every buyer-facing surface reads this"), so its callers ARE the subject. The
// exceptions carry a reason and are checked for staleness, or an exemption outlives the file it excused.
// Each exception now carries the CONDITION that makes its reason true, not just the sentence — the
// comment above always promised they were checked for staleness and they were not, so an exemption could
// outlive the thing it excused. The rule this guard is really about is PRICES: a buyer shown a number
// from a catalogue that came off this device has to be told.
const showsAPrice = (source) => /CardPrice|InternationalPrice|OverseasPriceNote|formatRupiah\s*\(/.test(source);
const NOT_A_SCREEN = {
  'hooks/useCart.js': {
    why: 'a hook renders nothing; the pages that use it carry the notice',
    stillTrue: (source) => !/<[A-Z]\w*/.test(source),
  },
  'pages/JournalEditorPage.jsx': {
    why: 'Studio: picks a related product to attach to an article, sells nothing',
    stillTrue: (source) => !showsAPrice(source),
  },
  'components/journal/JournalRelatedProduct.jsx': {
    // This one DOES print a price, and its excuse was never about prices: it is a card embedded in an
    // article, with no page of its own to put a banner on. So the condition is the one its reason
    // actually names — it stops being true the day this grows into a page.
    why: 'one card inside an article, not a page that can warn',
    stillTrue: (source) => !/<main\b/.test(source),
  },
  'components/storefront/FreeVialPrompt.jsx': {
    why: 'offers aroma NAMES for a gift and quotes no number at all; a stale list can only offer an '
      + 'aroma that is gone, which reconcileCartLines drops and the order endpoint refuses',
    stillTrue: (source) => !showsAPrice(source),
  },
};

const buyerScreens = [];
const silent = [];
const walkBuyer = (dir) => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walkBuyer(rel); continue; }
    if (!/\.(jsx|js)$/.test(entry.name) || entry.name.includes('.selfcheck.')) continue;
    if (rel === 'hooks/useStorefrontProducts.js') continue;
    const source = read(...rel.split('/'));
    if (!/useStorefrontProducts\s*\(/.test(source)) continue;
    buyerScreens.push(rel);
    if (NOT_A_SCREEN[rel]) {
      assert.ok(NOT_A_SCREEN[rel].stillTrue(source),
        `${rel} is excused from the stale-catalogue notice because "${NOT_A_SCREEN[rel].why}" — and that `
        + 'is no longer true, so either restore it or render the notice');
      continue;
    }
    if (!/<StaleCatalogNotice\b/.test(source)) silent.push(rel);
  }
};
for (const dir of ['pages', 'components', 'hooks']) walkBuyer(dir);

assert.ok(buyerScreens.length >= 8,
  `only ${buyerScreens.length} buyer surfaces read the catalogue — the derivation broke`);
assert.deepEqual(silent, [],
  'these screens show a buyer catalogue prices and cannot tell them the catalogue came from this device '
  + `because the server could not be reached:\n  ${silent.join('\n  ')}`);

// An exemption that no longer names a caller is worse than none: it would quietly excuse a file that
// was renamed into the gap.
const staleExemptions = Object.keys(NOT_A_SCREEN).filter((key) => !buyerScreens.includes(key));
assert.deepEqual(staleExemptions, [],
  `these exemptions no longer read the catalogue — delete them:\n  ${staleExemptions.join('\n  ')}`);

console.log('staleCatalog selfcheck OK (a catalogue served from this device because the server could not be reached says so, on every screen where a buyer acts on a price)');
