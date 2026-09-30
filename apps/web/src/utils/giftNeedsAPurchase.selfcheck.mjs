// `node src/utils/giftNeedsAPurchase.selfcheck.mjs`
//
// A gift with nothing to accompany is not a gift, and a cart holding only one is a trap.
//
// Observed on a real browser while testing the add-to-cart prompt: pick an aroma, take the bottles out,
// and the vial line stays. Nothing shows it afterwards — the picker hides itself when nothing is bought,
// both cart pages render their empty state, and the badge counts bought items only — so it cannot be
// seen and cannot be removed.
//
// The cost is not the stray row. shouldOfferFreeVial then reads "an aroma is already chosen", so the
// prompt never opens again: the next time that buyer adds a bottle they silently receive an aroma they
// picked weeks ago and are never offered the choice. The feature is gone for that browser, permanently,
// and nothing anywhere says so.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FREE_VIAL_TAG, dropOrphanedGift, shouldOfferFreeVial } from './freeVial.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const bottle = { slug: 'l-iris', name: 'L’iris', quantity: 1, priceNumber: 429000 };
const gift = { slug: 'vial-hadiah-hug-n-1', name: 'Vial hadiah — HUG N°1', quantity: 1, priceNumber: 0, tags: [FREE_VIAL_TAG], variantId: 'hug-n-1' };

// --- the rule itself ----------------------------------------------------------------------------------
assert.deepEqual(dropOrphanedGift([bottle, gift]), [bottle, gift],
  'a gift alongside a purchase is the whole feature and must survive untouched');
assert.deepEqual(dropOrphanedGift([gift]), [],
  'a cart holding only the gift has nothing to give it with — that line can never become an order');
assert.deepEqual(dropOrphanedGift([bottle]), [bottle], 'a cart with no gift is left exactly as it was');
assert.deepEqual(dropOrphanedGift([]), [], 'and an empty cart stays empty');
assert.deepEqual(dropOrphanedGift(), [], 'called with nothing, no crash');
// Order is not the rule: the gift is dropped for being alone, not for being last.
assert.deepEqual(dropOrphanedGift([gift, bottle]), [gift, bottle],
  'the gift may sit anywhere in the list — it is dropped for being ALONE, never for its position');

// --- and dropping it is what gives the buyer the choice back -------------------------------------------
// The two rules meet here: the orphan is exactly the thing that silences the prompt for ever.
assert.equal(shouldOfferFreeVial({ opened: true, vialProduct: { variants: [{ id: 'a', size: 'A', stock: 5 }] }, gift }), false,
  'with a gift in hand the prompt stays shut — correct, and the reason an orphan is so expensive');
assert.equal(shouldOfferFreeVial({
  opened: true,
  vialProduct: { variants: [{ id: 'a', size: 'A', stock: 5 }] },
  gift: dropOrphanedGift([gift])[0] || null,
}), true, 'once the orphan is dropped the buyer is offered the choice again, which is the point');

// --- applied where every path meets: the cart's single reader ------------------------------------------
// Sliced to readCart's own body. cartService names the helper in prose and imports it at the top, so a
// whole-file search would stay green with the reader not applying it at all.
const service = strip(readFileSync(join(src, 'services', 'cartService.js'), 'utf8'));
const readerAt = service.indexOf('const readCart = ');
assert.ok(readerAt > 0, 'readCart is gone from cartService — update this guard, not the service');
const reader = service.slice(readerAt, service.indexOf('\n};', readerAt));
assert.match(reader, /dropOrphanedGift\(/,
  'the cart reader no longer drops an orphaned gift, so a browser already holding one keeps it for ever '
  + 'and the prompt never opens for that buyer again');

// Every writer must build from that reader rather than touching storage itself — that is what makes one
// rule in one place cover all of them. Counted, not listed.
const writers = [...service.matchAll(/export const (\w+) = \([^)]*\) => \{[\s\S]*?\n\};/g)]
  .filter((match) => /writeCart\(/.test(match[0]));
assert.ok(writers.length >= 3, `only ${writers.length} cart writer(s) found — the derivation broke`);
const goRound = writers
  .filter((match) => !/readCart\(\)/.test(match[0]) && !/writeCart\(\[\]\)/.test(match[0]))
  .map((match) => match[1]);
assert.deepEqual(goRound, [],
  'these cart writers build their next cart without reading through readCart, so the orphan rule does '
  + `not reach them:\n  ${goRound.join('\n  ')}`);

console.log(`giftNeedsAPurchase selfcheck OK (${writers.length} cart writers, one reader, one rule)`);
