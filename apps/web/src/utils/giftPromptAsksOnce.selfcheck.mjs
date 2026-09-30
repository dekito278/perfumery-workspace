// `node src/utils/giftPromptAsksOnce.selfcheck.mjs`
//
// The gift is offered at add-to-cart — Dekito's decision, 30 Sep 2026, reversing the 29 Sep one.
//
// The version dropped in September is this one, and the reason it was dropped is the thing this guard
// exists to protect: add-to-cart is the highest-friction moment in the shop. An offer there earns its
// place only by being cheap, so it must ask ONCE and then stay out of the way.
//
// The rule is one vial per ORDER, not per bottle. Asking again on the second bottle would be asking
// about a gift the buyer already has, and turns a thank-you into a toll on every tap.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FREE_VIAL_TAG, shouldOfferFreeVial } from './freeVial.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// --- when it may open, RUN rather than read -----------------------------------------------------------
const vial = { slug: 'vial-hadiah', tags: [FREE_VIAL_TAG], variants: [
  { id: 'hug-n-1', size: 'HUG N°1', priceNumber: 0, stock: 20 },
] };
const chosen = { tags: [FREE_VIAL_TAG], variantId: 'hug-n-1' };

assert.equal(shouldOfferFreeVial({ opened: true, vialProduct: vial }), true,
  'a bottle went in the basket, no aroma picked yet, and there is one in stock — this is the whole feature');
assert.equal(shouldOfferFreeVial({ opened: true, vialProduct: vial, gift: chosen }), false,
  'once an aroma is chosen it must never ask again: one vial per ORDER, not per bottle');
assert.equal(shouldOfferFreeVial({ opened: true, vialProduct: vial, isInternational: true }), false,
  'the English shop has no cart to add to');
assert.equal(shouldOfferFreeVial({ opened: true, vialProduct: null }), false,
  'no vial product, nothing to offer');
assert.equal(shouldOfferFreeVial({
  opened: true,
  vialProduct: { ...vial, variants: vial.variants.map((v) => ({ ...v, stock: 0 })) },
}), false, 'every aroma sold out means the shop cannot pack one — offering it would be a broken promise');
// The direction that keeps it from being dead code.
assert.equal(shouldOfferFreeVial({ opened: false, vialProduct: vial }), false,
  'and it stays shut until something is actually added');

// --- the offer is made from ONE place -----------------------------------------------------------------
// Counted, not listed: the buyer-facing add-to-cart screens are whichever call the cart hook's addItem.
// They are covered by the hook firing the event, so none of them has to remember the prompt — which is
// the whole point, four screens being four places to forget.
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (!/\.jsx$/.test(entry.name)) continue;
    const source = strip(readFileSync(join(src, rel), 'utf8'));
    if (/\baddItem\s*\(/.test(source)) screens.push(rel);
  }
};
walk('pages');
assert.ok(screens.length >= 4, `only ${screens.length} add-to-cart screen(s) found — the derivation broke`);

const cartHook = strip(readFileSync(join(src, 'hooks', 'useCart.js'), 'utf8'));
assert.match(cartHook, /addItem: \([\s\S]*?CART_ITEM_ADDED_EVENT/,
  'the cart hook no longer announces an add, so none of the add-to-cart screens can raise the prompt');

// The reorder is the one add that must stay SILENT: it adds several lines in a loop and then carries the
// buyer away to the cart. It calls the service writer directly, which is what keeps it quiet — so that
// writer must not fire the event itself.
const service = strip(readFileSync(join(src, 'services', 'cartService.js'), 'utf8'));
assert.doesNotMatch(service, /dispatchEvent\(new CustomEvent\(CART_ITEM_ADDED_EVENT/,
  'cartService fires the add event itself, so the portal\'s "Pesan lagi" now raises a gift prompt in the '
  + 'middle of a reorder it is already navigating away from');

// --- mounted exactly once ------------------------------------------------------------------------------
const app = strip(readFileSync(join(src, 'App.jsx'), 'utf8'));
assert.equal((app.match(/<FreeVialPrompt\b/g) || []).length, 1,
  'the gift prompt must be mounted exactly once for the whole app — none means the feature is off, two '
  + 'means two sheets over one basket');

// --- and one spelling of the aroma buttons -------------------------------------------------------------
// The panel on the cart page and this prompt both offer them; "tap to choose, tap another to swap, tap
// the same one to release" is one rule, and written twice it is a rule that holds once.
const builders = [];
const walkBuilders = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walkBuilders(rel); continue; }
    if (!/\.jsx$/.test(entry.name)) continue;
    const source = strip(readFileSync(join(src, rel), 'utf8'));
    if (/buildFreeVialCartItem\s*\(/.test(source)) builders.push(rel);
  }
};
walkBuilders('components'); walkBuilders('pages');
assert.deepEqual(builders, ['components/storefront/FreeVialChoices.jsx'],
  'more than one screen builds the gift cart line itself, so the choose/swap/release rule now lives in '
  + `more than one place:\n  ${builders.join('\n  ')}`);

console.log(`giftPromptAsksOnce selfcheck OK (${screens.length} add-to-cart screens, one prompt, one spelling)`);
