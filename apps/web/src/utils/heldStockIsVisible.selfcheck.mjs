// `node src/utils/heldStockIsVisible.selfcheck.mjs`
//
// Stopping the clock on an order awaiting a freight quote was right: cancelling it would punish the buyer
// for our delay, on the one route where shipping cannot be priced automatically.
//
// It also had a cost nobody was told about. Every catalog order reserves stock the moment it is written
// (api/orders/create.js calls storefront_deduct_inventory_for_order), and the reservation sweep skips
// exactly these orders — so their stock is held with no time limit and nothing ever gives it back. In a
// shop that blends in small batches, one European buyer who goes quiet takes a bottle out of the
// catalogue permanently. The only screen that knew these orders existed said nothing about it, and
// listed a six-day-old order and a six-hour-old one identically.
//
// The rule is not "free the stock" — that would break the thing the clock stop exists to protect. It is
// that a cost being carried silently must be named on the screen that can end it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const code = (...parts) => read(...parts).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// --- 1. The premise: the stock really is held, and really is not swept ---------------------------------
// Both halves are asserted, because the day either stops being true this whole guard is describing a
// problem that no longer exists and should be rewritten rather than left passing.
const endpoint = readFileSync(join(root, '..', 'api', 'orders', 'create.js'), 'utf8');
assert.match(endpoint, /deductInventory\(order\.id \|\| order\.order_number\)/,
  'a catalog order still reserves stock the moment it is written — if it stopped, the cost this guard '
  + 'makes visible is gone and the wording should go with it');
const sweep = readFileSync(join(root, '..', 'api', 'orders', 'expire-reservations.js'), 'utf8');
assert.match(sweep, /payment_response\?\.shippingQuotePending\) return false/,
  'the sweep still skips an order awaiting a quote — that is the deliberate part, and the reason the '
  + 'stock is never given back on its own');

// --- 2. The wait is measurable, and measured from when the buyer started waiting ------------------------
const workflow = code('utils', 'orderWorkflow.js').replace(/^import\b[^\n]*from '[^']+';\n/gm, '');
const { daysAwaitingQuote, isAwaitingShippingQuote } = await import(
  `data:text/javascript;base64,${Buffer.from(workflow, 'utf8').toString('base64')}`
);
const waitingFor = (days) => ({
  createdAt: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString(),
  paymentStatus: 'unpaid',
  paymentResponse: { currency: 'USD', amountUsd: 80, shippingQuotePending: true },
});
assert.equal(daysAwaitingQuote(waitingFor(6)), 6, 'six days waiting must read as six days');
// A FIXED now, and an order six hours old. Written with Date.now() on both sides, "placed this morning"
// came out as a zero-millisecond difference and the assertion passed no matter how the number was
// rounded — a test that agreed with itself rather than with the code. Six hours is under a day whichever
// way you round honestly, and only rounding UP turns it into "1 hari" on the queue.
const NOW = new Date('2026-09-25T18:00:00+07:00');
const sixHoursOld = {
  createdAt: new Date('2026-09-25T12:00:00+07:00').toISOString(),
  paymentStatus: 'unpaid',
  paymentResponse: { currency: 'USD', amountUsd: 80, shippingQuotePending: true },
};
assert.equal(daysAwaitingQuote(sixHoursOld, NOW), 0,
  'an order placed this morning is not a day old — the queue would read "1 hari" for something six hours '
  + 'old and the number would stop meaning anything');
assert.equal(daysAwaitingQuote({ ...waitingFor(6), paymentResponse: {} }), 0,
  'an order that is not waiting has no wait to report — the number must not leak onto ordinary orders');
// NaN is caught twice over: the isFinite check, and the `days > 0` at the end. Removing either alone
// changes nothing, which is why this asserts the RESULT rather than the presence of a check — a guard
// that demanded both lines would be describing the belt and the braces instead of the trousers.
const noDate = daysAwaitingQuote({ paymentResponse: { shippingQuotePending: true }, paymentStatus: 'unpaid' });
assert.equal(noDate, 0, 'an order with no created_at must not produce NaN days on a list screen');
assert.ok(Number.isFinite(noDate), 'and the number handed to the screen must be a number');
assert.equal(daysAwaitingQuote(null), 0, 'and a missing order must not throw');
// A paid order is no longer waiting, whatever the flag says.
assert.equal(isAwaitingShippingQuote({ ...waitingFor(6), paymentStatus: 'paid' }), false,
  'once paid the order is not waiting on us, so neither is its stock');

// --- 3. The screens that can end the wait say what it is costing ---------------------------------------
// The queue is the one place these orders are gathered, and the order screen is where the wait ends.
const queue = read('pages', 'mobile', 'MobileFulfillmentPage.jsx');
assert.match(queue, /daysAwaitingQuote\(order\)/,
  'the queue lists these orders without their age — six days and six hours look identical in a list, and '
  + 'the difference is a bottle that has been unbuyable for a week');
assert.match(queue, /[Ss]tok(nya)?\s+(sudah\s+)?dipotong|[Ss]tok(nya)? ditahan/,
  'the queue must say the stock is held: that is the cost of the clock being stopped, and it is carried '
  + 'silently otherwise');

const detail = read('pages', 'mobile', 'MobileOrderDetailPage.jsx');
assert.match(detail, /daysAwaitingQuote\(order\)/,
  'the screen that sends the quote must show how long the buyer — and the bottle — has been waiting');
assert.match(detail, /[Ss]tok(nya)? ditahan/,
  'and must name what the waiting costs, on the screen with the button that ends it');

console.log('heldStockIsVisible selfcheck OK (the clock stays stopped for the buyer, and the stock it '
  + 'holds is named and dated on both screens that can end the wait)');
