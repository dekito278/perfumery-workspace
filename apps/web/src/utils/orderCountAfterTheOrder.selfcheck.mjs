// `node src/utils/orderCountAfterTheOrder.selfcheck.mjs`
//
// storefront_upsert_customer takes p_increment_order, and api/orders/create.js called it with true at
// step 5 — before the order row exists, before voucher quota is reserved, and before stock is held.
//
// All three of those still refuse, and each has its own handled failure path. So a checkout that ran out
// of stock, or hit a voucher whose quota had just gone, left the buyer's order_count one higher than the
// orders she has. Nothing ever gives it back.
//
// That is not a stray number on the customer screen. customerService derives two figures from it: repeat
// buyers are order_count > 1, and the orders total is the sum across customers. One failed checkout
// promotes a first-time buyer to a returning one and adds an order that never existed to the total.
//
// The rule: a count of orders is incremented after there IS an order. Checked by ORDER — where the
// increment sits relative to the insert and the stock reservation — because that is literally what the
// defect was.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const endpoint = readFileSync(join(src, '..', 'api', 'orders', 'create.js'), 'utf8');

// --- 1. The customer is still upserted before the order, and still without counting it ------------------
// The order needs the customer's code, so the upsert itself has to stay where it is. Only the counting
// moved.
const withoutCount = endpoint.indexOf('p_increment_order: false');
const withCount = endpoint.indexOf('p_increment_order: true');
assert.notEqual(withoutCount, -1,
  'the customer upsert before the order no longer says p_increment_order: false, so it is counting an '
  + 'order that does not exist yet');
assert.notEqual(withCount, -1, 'nothing increments the order count at all any more');
assert.ok(withoutCount < withCount, 'the counting call must be the later of the two');

// --- 2. And the counting happens after everything that can still refuse -----------------------------------
const anchors = {
  'the order insert': endpoint.indexOf("await fetch(`${restUrl}/storefront_orders`"),
  'the voucher quota reservation': endpoint.indexOf('storefront_record_voucher_usage'),
  'the stock reservation': endpoint.indexOf('await deductInventory('),
};
for (const [what, at] of Object.entries(anchors)) {
  assert.notEqual(at, -1, `${what} has moved; this guard no longer knows where the order becomes real`);
  assert.ok(withCount > at,
    `the order count is incremented before ${what}, which can still refuse — and when it does, the count `
    + 'is never given back');
}

// --- 3. A failed count must not cost the buyer her order --------------------------------------------------
// The order is already made by then. Throwing here would turn a metric into a 400 on a real order.
const countCall = endpoint.slice(withCount - 400, withCount + 400);
assert.match(countCall, /\.catch\(/,
  'the increment is awaited without a catch: the order exists, and a customer metric must never be the '
  + 'thing that fails it');

// --- 4. Both figures this feeds still read the column ------------------------------------------------------
// If they stop, the reason this was worth fixing is gone and the guard should be rewritten, not kept.
const customers = readFileSync(join(src, 'services', 'customerService.js'), 'utf8');
assert.match(customers, /repeat: customers\.filter\(\(customer\) => Number\(customer\.orderCount \|\| 0\) > 1\)/,
  'the repeat-buyer figure no longer counts order_count');
assert.match(customers, /orders: customers\.reduce/, 'the orders total no longer sums order_count');

console.log('orderCountAfterTheOrder selfcheck OK (the customer is upserted before the order and counted '
  + 'after it, and a failed count cannot fail the order)');
