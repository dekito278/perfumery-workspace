// `node src/utils/stockReservationIsVisible.selfcheck.mjs`
//
// Stock is the scarcest thing in this shop. An unpaid order holds bottles out of the catalogue until it
// is paid or the reservation lapses, so "is this order still holding one, and until when" is a question
// with a real cost behind it.
//
// The desktop answered it on both its screens. The phone answered it on neither — not on the order list,
// not on the order detail — which on a shop run from a phone means the question had no answer where it
// is actually asked.
//
// And the desktop's two answers had already drifted apart, three ways, because each was an inline
// ternary written separately:
//
//   - the list guarded the expiry before printing "sampai X"; the detail did not, so an order with
//     nothing to count from read "Stok reserved sampai N/A"
//   - the detail showed "Batas reserved N jam" for an order holding no stock; the list showed nothing
//   - each chose its own colours
//
// The rule: one description of what is happening to an order's stock, and every order screen shows it.
// The decision is RUN here rather than read, and the screens are found on disk.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// orderWorkflow.js reaches supabase through orderService, so its imports are stripped — the multi-line
// form too — and the two things these functions lean on are stubbed.
const workflowSource = readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const stubs = `
const getBespokeItem = () => null;
const isBespokeOrder = () => false;
const PAYMENT_RESERVATION_TTL_HOURS = 24;
const getOrderReservationExpiresAt = (order) => order.__expiresAt || '';
`;
const { describeStockReservation, stockReservationLabel, stockReservationTone } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflowSource, 'utf8').toString('base64')}`
);

// --- 1. The three states, decided ------------------------------------------------------------------------
const holding = { inventoryDeducted: true, __expiresAt: '2026-09-26T10:00:00Z' };
assert.deepEqual(describeStockReservation(holding), { state: 'reserved', expiresAt: '2026-09-26T10:00:00Z' });
assert.deepEqual(describeStockReservation({ inventoryDeducted: true }), { state: 'reserved', expiresAt: '' },
  'holding stock with nothing to count from is still holding stock');
for (const dead of [{ paymentStatus: 'expired' }, { paymentStatus: 'failed' }, { paymentStatus: 'refunded' }, { status: 'cancelled' }]) {
  assert.equal(describeStockReservation(dead).state, 'released', `${JSON.stringify(dead)} has let its stock go`);
}
assert.equal(describeStockReservation({ paymentStatus: 'unpaid' }).state, 'pending',
  'an order holding nothing yet is neither reserved nor released');
assert.equal(describeStockReservation(null).state, 'pending', 'a missing order must not throw on a list');
// A paid order that still holds its deduction reads as reserved, not released — releasing is what
// cancelling does, and confusing the two would tell Dekito a sold parcel had given its bottle back.
assert.equal(describeStockReservation({ inventoryDeducted: true, paymentStatus: 'paid' }).state, 'reserved');

// --- 2. The wording, and the empty date that must never reach a formatter ---------------------------------
const boom = () => { throw new Error('formatted an empty date'); };
assert.equal(stockReservationLabel(describeStockReservation({ inventoryDeducted: true }), boom), 'Stok reserved',
  'with no expiry the label must not call the formatter at all — MobileOrdersPage formats with Intl and '
  + 'no empty guard, and Intl throws a RangeError on an invalid date');
assert.equal(stockReservationLabel(describeStockReservation({ status: 'cancelled' }), boom), 'Stok dilepas');
assert.match(stockReservationLabel(describeStockReservation({}), boom), /^Batas reserved \d+ jam$/);
assert.equal(
  stockReservationLabel(describeStockReservation(holding), (value) => `<${value}>`),
  'Stok reserved sampai <2026-09-26T10:00:00Z>',
  'and with an expiry it uses the caller\'s own date format',
);
assert.notEqual(stockReservationTone({ state: 'reserved' }), stockReservationTone({ state: 'released' }),
  'the two states a glance has to tell apart must not share a colour');

// --- 3. Every order screen shows it -----------------------------------------------------------------------
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) screens.push(full);
  }
};
walk(join(src, 'pages'));

const orderScreens = screens.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return /formatTotal\(order\.subtotal\)/.test(text) && /statusLabels\[order\.status\]/.test(text);
});
assert.ok(orderScreens.length >= 4,
  `expected the four Studio order screens, found ${orderScreens.length} — the scan is broken, not the code`);

for (const file of orderScreens) {
  const where = file.slice(src.length + 1);
  const text = readFileSync(file, 'utf8');
  // Two separate questions, because demanding one call SHAPE is how a guard ends up policing style:
  // OrderDetailPage holds the description in a local and passes it on, which is the same thing done
  // tidily, and an earlier version of this line rejected it.
  assert.match(text, /describeStockReservation\(/,
    `${where} never asks what is happening to this order's stock. On a shop that blends in small `
    + 'batches, an order nobody realises is still reserving a bottle takes it out of the catalogue '
    + 'silently');
  assert.match(text, /stockReservationLabel\(/,
    `${where} asks but writes its own sentence — that is how the desktop's two answers drifted three `
    + 'separate ways');
  // Decided by the helper, not re-derived beside it. Each inline copy is how the desktop's two answers
  // drifted three separate ways.
  assert.doesNotMatch(text, /inventoryDeducted \? \(/,
    `${where} works the state out inline again instead of asking once`);
}

console.log(`stockReservationIsVisible selfcheck OK (${orderScreens.length} order screens, one answer to `
  + 'what is happening to the stock)');
