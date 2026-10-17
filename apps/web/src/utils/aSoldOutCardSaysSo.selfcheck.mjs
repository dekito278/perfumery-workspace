// `node src/utils/aSoldOutCardSaysSo.selfcheck.mjs`
//
// Three bottles were out of stock, listed, and indistinguishable from the rest of the grid. Keeping them
// listed is Dekito's decision (17 Okt 2026) — saying nothing on the card was not a decision, it was the
// absence of one. The only "Stok habis" a card carried was the desktop quick-add pill, and that pill is
// `opacity: 0` until the pointer hovers it; the phone grids have no pill at all.
//
// So the rule is: a product card whose product is not Available must print it, and the ONLY way out is a
// surface that already says it in its own words. The subject is derived from the binding — every
// `<ProductVisual` a buyer can reach — never from a list of pages, because a list is what let the phone
// grids sit unmarked for months while the desktop one looked handled.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { showsSoldOutBadge } from './soldOutBadge.js';
import { buyerSurfaces } from './buyerSurfaces.mjs';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(file, 'utf8');

// --- 1. The predicate, run ------------------------------------------------------------------------------
// Production shapes, not invented ones: the public mapper sets publicStatus, the Studio mapper sets a raw
// stock, cartService stores maxStock.
assert.equal(showsSoldOutBadge({ publicStatus: 'Made to order' }), true, 'a sold-out catalogue card says so');
assert.equal(showsSoldOutBadge({ publicStatus: 'Available' }), false, 'an available card stays clean');
assert.equal(showsSoldOutBadge({ publicStatus: 'Made to order' }, false), false, 'a surface may opt out');
assert.equal(showsSoldOutBadge({ stock: 0, name: 'Studio row' }), false, 'a Studio row has no publicStatus — never badged');
assert.equal(showsSoldOutBadge({ maxStock: 0, name: 'Cart line' }), false, 'a cart line has no publicStatus — never badged');
assert.equal(showsSoldOutBadge(null), false);
assert.equal(showsSoldOutBadge(undefined), false);
// The trap this function exists to avoid: `undefined !== 'Available'` is true, so a missing field must be
// checked for presence FIRST or every Studio product is stamped sold out.
assert.equal(showsSoldOutBadge({}), false, 'a missing publicStatus is not a sold-out product');

// --- 2. The badge is on by default ----------------------------------------------------------------------
// A new grid must inherit the badge without anyone remembering to ask for it. `soldOut = false` as the
// default would make every one of these assertions pass while no card said anything.
const visual = read(join(src, 'components', 'storefront', 'ProductVisual.jsx'));
assert.match(visual, /soldOut = true,/, 'ProductVisual badges by default');
assert.match(visual, /showsSoldOutBadge\(product, soldOut\)/, 'ProductVisual asks the shared predicate');
assert.match(visual, /showSoldOut \?[\s\S]{0,400}catalog\.soldOutShort/,
  'the badge renders the sold-out message, not a hardcoded word');
// A div here is swallowed by `.catalog-card__visual > div` / `.m-editorial-product-card__visual > div`,
// which size the image layers to 100% x 100% — the badge was stretched across the whole photo, and it
// still LOOKED like a badge in the DOM. Only the measured width gave it away.
assert.match(visual, /showSoldOut \?\s*\(\s*<span/,
  'the sold-out badge is a <span>: a <div> child of the visual is stretched to fill it by both card stylesheets');

// --- 3. Opting out is only allowed where the surface says it another way ---------------------------------
// Derived subject: every ProductVisual a buyer can reach. A file may pass soldOut={false} only if it
// states the state itself — the product page's disabled button says pdp.soldOut, the catalogue's disabled
// pill says catalog.soldOutShort.
// A COMPONENT cannot be judged on its own source: ProductGallery is the product page's hero and prints
// nothing, while the page that renders it prints pdp.soldOut right under it. So the question for a
// component is asked of its renderers — all of them, or the exemption is a hole.
const SAYS_IT_ANOTHER_WAY = /pdp\.soldOut|catalog\.soldOutShort/;
const surfaces = buyerSurfaces({ src });
const sources = new Map(surfaces.files.map((file) => [file, read(file)]));
const rendersComponent = (component) => [...sources]
  .filter(([, source]) => new RegExp(`<${component}\\b`).test(source))
  .map(([file]) => file);

let seen = 0;
let optedOut = 0;
for (const [file, source] of sources) {
  const name = relative(src, file);
  const component = name.replace(/.*\//, '').replace(/\.jsx$/, '');
  for (const tag of source.match(/<ProductVisual\b[\s\S]*?\/>/g) || []) {
    seen += 1;
    if (!/soldOut=\{false\}/.test(tag)) continue;
    optedOut += 1;
    if (SAYS_IT_ANOTHER_WAY.test(source)) continue;
    const renderers = rendersComponent(component);
    assert.ok(renderers.length,
      `${name} silences the sold-out badge but never prints the state itself — drop soldOut={false} or `
      + 'say "Stok habis" on that screen');
    for (const renderer of renderers) {
      assert.match(sources.get(renderer), SAYS_IT_ANOTHER_WAY,
        `${relative(src, renderer)} renders ${component}, which silences the sold-out badge, and neither `
        + 'of them ever prints the state — drop soldOut={false} or say "Stok habis" on that screen');
    }
  }
}
assert.ok(seen >= 8, `the sweep found ${seen} buyer ProductVisual tags — it used to find 11, so it has gone blind`);
assert.ok(optedOut >= 1 && optedOut < seen,
  `${optedOut} of ${seen} tags opt out — all of them opting out means no card says anything`);

// --- 4. The message exists in both languages, and says stock ---------------------------------------------
assert.match(MESSAGES.id['catalog.soldOutShort'], /habis/i, 'the Indonesian badge names the stock state');
assert.match(MESSAGES.en['catalog.soldOutShort'], /sold out/i, 'the English badge names the stock state');

// --- 5. The desktop pill does not wait for a hover ------------------------------------------------------
// The pill IS the catalogue's statement (section 3 lets it opt the badge out), so it has to be on screen
// without a pointer. This is the original defect, written as an assertion.
const css = read(join(src, 'styles', 'storefront.css'));
assert.match(css, /\.catalog-card__quick-add:disabled\s*\{[^}]*opacity:\s*1/,
  'the disabled quick-add pill must stay visible — it carries the only "Stok habis" on a desktop card');

// --- 6. Not Available is what the public mapper produces for an empty shelf ------------------------------
// The badge is worth nothing if the field it reads never turns. Source-level because the mapper imports
// through the '@/' alias, which plain node does not resolve.
const mapper = read(join(src, 'data', 'publicStorefront.js'));
assert.ok(/publicStatus = getProductStockTotal\([\s\S]{0,80}?\) > 0 \? 'Available' :/.test(mapper),
  'publicStatus still comes from the variant stock total, with zero stock falling to the other branch');

console.log('aSoldOutCardSaysSo: ok');
