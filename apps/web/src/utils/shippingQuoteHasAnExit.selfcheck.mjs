// `node src/utils/shippingQuoteHasAnExit.selfcheck.mjs`
//
// A state an order can enter must be a state an order can leave.
//
// Two places set payment_response.shippingQuotePending — the checkout, for a European destination, and
// the export calculator — and for three commits NOTHING anywhere cleared it. A buyer in Berlin ordered,
// was correctly shown no account and no total, appeared in Studio's "Menunggu ongkir dari kamu" queue,
// and stayed there permanently. The queue linked to a screen with no action on it. That order could
// never be paid by any path in the app, and every guard was green: each half was individually correct.
//
// Three things move together when the freight is finally sent, and getting any one wrong costs money:
//   * the total, which the shipping line is derived from;
//   * the dollar figure, re-totalled at the rate THE ORDER was written with, so the price of the bottles
//     does not move because the market moved while we were quoting;
//   * the clock, which isAwaitingShippingQuote had stopped. It runs from created_at, so an order quoted
//     three days later would be expired the instant it became payable — cancelled mid-transfer.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { usdPriceFor, USD_PRICE_RATE } from './usdPrice.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
// Comments stripped before anything is counted. The first version of this guard matched the phrase
// "a lingering `shippingQuotePending: false`" inside a comment explaining why the code does NOT write
// that — so deleting the only real exit left the guard green. A guard that reads prose as implementation
// is worse than none: it reports on the explanation instead of the thing explained.
const code = (...parts) => read(...parts)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const everySource = (...base) => {
  const found = [];
  const walk = (parts) => {
    for (const entry of readdirSync(join(root, ...parts), { withFileTypes: true })) {
      if (entry.isDirectory()) walk([...parts, entry.name]);
      else if (/\.(jsx|js)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) found.push([...parts, entry.name]);
    }
  };
  walk(base);
  return found;
};

// --- 1. Somebody sets it, and somebody clears it -------------------------------------------------------
// Counted across the whole tree rather than asserted about one named file: the exit may move, and it may
// one day be a different file that owns it. What may not happen is there being no exit at all.
// api/ as well as src/: the checkout endpoint is one of the two places that puts an order into this
// state, and a scan that stopped at src/ would have reported one way in when there are two.
const sources = [...everySource('pages'), ...everySource('services'), ...everySource('utils'),
  ...everySource('hooks'), ...everySource('..', 'api')];
const setters = sources.filter(([...f]) => /shippingQuotePending: true/.test(code(...f)));
const clearers = sources.filter(([...f]) => /delete [\w.]*\.?shippingQuotePending|shippingQuotePending: false/.test(code(...f)));
assert.ok(setters.length >= 1, 'nothing sets the waiting-for-freight flag any more — if that is deliberate, '
  + 'this guard and the queue that reads it should go too');
assert.ok(clearers.length >= 1,
  `${setters.length} place(s) put an order into "waiting for a shipping quote" and nothing takes it out `
  + 'again. That order can never be paid: the payment page withholds the account, the reservation sweep '
  + 'skips it, and Studio\'s queue links to a screen with nothing to press.');

// --- 2. The exit moves all three things together -------------------------------------------------------
const service = read('services', 'orderService.js');
const exitStart = service.indexOf('export const sendInternationalShippingQuote');
assert.ok(exitStart > 0, 'the exit must be a named, reusable operation rather than inline page code — two '
  + 'screens call it, and a second copy is a second set of rules');
const exit = service.slice(exitStart, service.indexOf('\nexport const', exitStart + 10));
// The ROW PATCH, not the whole function. The audit log written just below it records the same field
// names, so a check against the function as a whole passed while the actual write had been deleted —
// the guard was reading the receipt instead of the transaction.
const patchStart = exit.indexOf('updateOrderRow(orderId, {');
assert.ok(patchStart > 0, 'the exit must write the order row');
const patch = exit.slice(patchStart, exit.indexOf('\n  });', patchStart));

assert.match(patch, /subtotal: nextSubtotal/,
  'the freight must reach the total — getOrderShippingFee derives the shipping line by subtracting the '
  + 'items from it, so nothing else needs writing, but this does');
assert.match(patch, /usdPriceFor\(nextSubtotal, rate\)/,
  'the dollar figure must be re-totalled at the order\'s OWN rate; converting at today\'s rate moves the '
  + 'price of the bottles because the market moved after the buyer agreed to it');
assert.match(exit, /Number\(previous\.usdRate\) > 0 \? Number\(previous\.usdRate\) : USD_PRICE_RATE/,
  'and that rate must come from the order, falling back to the current one only when the order has none');
assert.match(patch, /payment_expires_at: expiresAt\.toISOString\(\)/,
  'clearing the flag restarts a clock that runs from created_at — an order quoted days later would be '
  + 'expired the moment it became payable, so an explicit window has to be set from now');
assert.match(exit, /isAwaitingShippingQuote\(order\)/,
  'the exit must refuse an order that was not waiting, or a second press adds the freight twice');

// --- 3. The arithmetic, run ----------------------------------------------------------------------------
// Re-totalling at a stored rate is the part that can be silently wrong: it still produces a plausible
// number. Goods Rp 1.260.000 at the order's own 16.500 is US$80; adding Rp 745.800 of freight to Germany
// must move it to US$125, and must NOT be recomputed at some other rate.
assert.equal(usdPriceFor(1260000, 16500), 80, 'the goods alone are US$80 at the order\'s rate');
assert.equal(usdPriceFor(1260000 + 745800, 16500), 125, 'goods plus the Germany freight come to US$125');
assert.notEqual(usdPriceFor(1260000 + 745800, 20000), usdPriceFor(1260000 + 745800, 16500),
  'the rate argument must actually change the answer, or "frozen at the order\'s rate" means nothing');
assert.equal(usdPriceFor(1260000, 0), usdPriceFor(1260000, USD_PRICE_RATE),
  'an order with no stored rate falls back to the current one rather than dividing by zero');

// --- 4. Both screens that show the queue can act on it -------------------------------------------------
// The fulfilment queue links to an order detail page. Whichever layout Dekito is on, the screen he lands
// on has to be able to finish the job — the phone one especially, which is where he works.
for (const page of [['pages', 'OrderDetailPage.jsx'], ['pages', 'mobile', 'MobileOrderDetailPage.jsx']]) {
  const source = read(...page);
  assert.match(source, /sendInternationalShippingQuote\(/,
    `${page.join('/')} is where the "menunggu ongkir" queue lands, and it cannot send the quote`);
  assert.match(source, /isAwaitingShippingQuote\(order\)\s*\?/,
    `${page.join('/')} must show that action only while the order is actually waiting`);
}

console.log(`shippingQuoteHasAnExit selfcheck OK (${setters.length} way in, ${clearers.length} way out, `
  + 'total, dollars and clock all moved together)');
