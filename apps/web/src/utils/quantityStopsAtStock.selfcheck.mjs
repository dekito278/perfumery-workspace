// `node src/utils/quantityStopsAtStock.selfcheck.mjs`
//
// The + button may not ask for a bottle that does not exist, and may not go quiet about it.
//
// MEASURED ON PRODUCTION, 2026-10-23. Jason Voorhees, two bottles in stock. Three presses of + in the
// cart wrote quantity 3 to localStorage. Nothing was oversold — reconcileCartLines caps the quantity
// again when the cart is read, so the page showed 2 and the subtotal stayed Rp 718.000, and the order
// endpoint checks stock as well. What the buyer got was a button that did nothing, said nothing, and
// gave no reason, on the last screen before paying.
//
// THE CAP EXISTED AND WAS DEAD. cartService.updateCartQuantity clamps with
//   item.maxStock > 0 ? Math.min(nextQuantity, Number(item.maxStock)) : nextQuantity
// reading maxStock off the line in localStorage, where it is 0: public product rows carry no stock, so
// that is what add-to-cart stored, and reconcile writes the live number only onto the line it RETURNS.
// `0 > 0` is false, so the clamp never ran. A guard on that file would have called it correct.
//
// The live number exists only on the reconciled line the page renders, so the rule has to be applied
// there — once, in cartQuantity.js, rather than four times in four steppers.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { atStockCap, nextQuantityUp, quantityOf } from './cartQuantity.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// --- 1. The rule itself, run ---------------------------------------------------------------------
assert.equal(nextQuantityUp({ quantity: 1, maxStock: 2 }), 2, 'one below the cap still goes up');
assert.equal(nextQuantityUp({ quantity: 2, maxStock: 2 }), 2, 'at the cap it stays put');
assert.equal(nextQuantityUp({ quantity: 5, maxStock: 2 }), 2, 'above the cap it comes back down');
assert.equal(atStockCap({ quantity: 2, maxStock: 2 }), true, 'and the control is told to say so');
assert.equal(atStockCap({ quantity: 1, maxStock: 2 }), false);

// No cap known is NOT a cap of zero. The international lines do not carry stock, and a cart that
// refused to go past one bottle there would be a worse bug than the one this fixes.
assert.equal(nextQuantityUp({ quantity: 9, maxStock: 0 }), 10, 'an unknown cap must not stop the buyer');
assert.equal(atStockCap({ quantity: 9, maxStock: 0 }), false);
assert.equal(nextQuantityUp({ quantity: 3 }), 4, 'nor must a missing one');
assert.equal(quantityOf({ quantity: 0 }), 1, 'a line is at least one bottle');
assert.equal(quantityOf({}), 1);

// --- 2. Every stepper uses it ---------------------------------------------------------------------
// The steppers are found, not listed: a fifth cart page added next month is covered by this on the day
// it is written.
const pages = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx$/.test(entry.name)) pages.push(rel);
  }
};
walk('pages');

// The subject is pages that RAISE a quantity. A page that only lowers one cannot ask for stock that is
// not there, and demanding the cap of it would be the guard inventing work. Written as "raises it the
// old way OR already uses the helper" so a page cannot leave the subject by being fixed.
const steppers = pages
  .map((rel) => [rel, readFileSync(join(src, rel), 'utf8')])
  .filter(([, body]) => /updateQuantity\([^)]*\.quantity \+ 1\)/.test(body) || /nextQuantityUp\(/.test(body));
assert.ok(steppers.length >= 5,
  `only ${steppers.length} pages raise a cart quantity; the search has stopped matching. `
  + 'There were five on 2026-10-23: two carts, two international carts, and the phone checkout — which '
  + 'this guard found on its first run, after four had been fixed by hand.');

const raw = [];
for (const [rel, body] of steppers) {
  for (const match of body.matchAll(/updateQuantity\([^)]*\.quantity \+ 1\)/g)) raw.push(`${rel}: ${match[0]}`);
  assert.match(body, /nextQuantityUp\(/, `${rel} steps a quantity without the shared cap`);
  assert.match(body, /disabled=\{atStockCap\(/, `${rel} leaves + clickable at the cap, so a press does nothing and says nothing`);
}
assert.deepEqual(raw, [],
  `these raise a quantity without asking the stock:\n  ${raw.join('\n  ')}`);

console.log(`quantityStopsAtStock OK (${steppers.length} steppers, all capped and all able to say when they are)`);
