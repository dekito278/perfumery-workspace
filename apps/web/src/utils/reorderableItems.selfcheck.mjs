// `node src/utils/reorderableItems.selfcheck.mjs`
//
// Two of an order's line types are written by the shop, not bought by the buyer: the voucher discount and
// the bespoke brief. They are priced and they belong on the invoice — and neither can go back in a cart.
//
// "Pesan lagi" counted them. A bespoke brief carries slug 'bespoke-perfume-request', which no product
// has, so the button offered itself on every bespoke order, filled the cart with a line
// reconcileCartLines could only mark unavailable, and left the buyer emptying a basket the shop had put
// there. Measured on the live shop the day this was written: seventeen of thirty-three orders are
// bespoke, every one of them bespoke-only, and all thirty-three carry a customer code, so every one is
// openable in the portal where that button lives.
//
// The list of shop-written types is DERIVED from the deduction RPC, which has always had to know it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  getOrderProductItems,
  getReorderableItems,
  isStockOrderItem,
} from './orderTotals.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');

// --- the list itself comes from the RPC, not from this guard -------------------------------------------
// Newest definition wins: redefining a function silently replaces its body, and this repository has been
// caught by that before.
const migrations = join(root, 'supabase', 'migrations');
const deductFiles = readdirSync(migrations)
  .filter((name) => /\.sql$/.test(name))
  .filter((name) => readFileSync(join(migrations, name), 'utf8').includes('function public.storefront_deduct_inventory_for_order'))
  .sort();
assert.ok(deductFiles.length >= 1, 'no migration defines the deduction RPC — the derivation broke');
const newestDeduct = readFileSync(join(migrations, deductFiles[deductFiles.length - 1]), 'utf8');
const skipClause = newestDeduct.match(/line_item->>'type' in \(([^)]*)\)/);
assert.ok(skipClause, `${deductFiles[deductFiles.length - 1]} no longer skips line types before deducting — update this guard, not the RPC`);
const shopWrittenTypes = [...skipClause[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
assert.ok(shopWrittenTypes.length >= 2, `only ${shopWrittenTypes.length} shop-written type(s) lifted from the RPC`);

for (const type of shopWrittenTypes) {
  assert.equal(isStockOrderItem({ type }), false,
    `the deduction RPC refuses to touch stock for a '${type}' line, so the cart must not accept one either`);
}
// The direction that matters just as much: a real product line must survive.
assert.equal(isStockOrderItem({}), true, 'a line with no type at all is an ordinary product — every live order line is one');
assert.equal(isStockOrderItem({ type: 'catalog' }), true, 'an unknown type is a product, not a synthetic line');

// --- and one list, in one place ------------------------------------------------------------------------
// A second spelling is how the cart and the RPC drift apart. Counted across the app source.
const spellings = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(here, '..', dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    const source = readFileSync(join(here, '..', rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    if (shopWrittenTypes.every((type) => source.includes(`'${type}'`))) spellings.push(rel);
  }
};
walk('utils'); walk('services'); walk('pages'); walk('components'); walk('hooks');
assert.deepEqual(spellings, ['utils/orderTotals.js'],
  'the shop-written line types are spelled out in more than one place, so the cart and the deduction RPC '
  + `can drift apart:\n  ${spellings.join('\n  ')}`);

// --- what the two questions answer ----------------------------------------------------------------------
const bespokeOnly = { items: [{ type: 'bespoke_request', slug: 'bespoke-perfume-request', priceNumber: 900000, quantity: 1 }] };
const mixed = {
  items: [
    { type: 'bespoke_request', slug: 'bespoke-perfume-request', priceNumber: 900000, quantity: 1 },
    { slug: 'hug-n-1', priceNumber: 359000, quantity: 2 },
    { type: 'voucher_discount', slug: 'voucher-x', priceNumber: -50000, quantity: 1 },
  ],
};
const plain = { items: [{ slug: 'hug-n-1', priceNumber: 359000, quantity: 1 }, { slug: 'sudra', priceNumber: 650000, quantity: 1 }] };

assert.deepEqual(getReorderableItems(bespokeOnly), [],
  'a bespoke-only order has nothing to put back in a cart, so the button must not offer itself');
assert.deepEqual(getReorderableItems(mixed).map((item) => item.slug), ['hug-n-1'],
  'a mixed order reorders the bottles and leaves the brief behind');
assert.deepEqual(getReorderableItems(plain).map((item) => item.slug), ['hug-n-1', 'sudra'],
  'an ordinary order reorders everything — this must not become a filter that quietly drops products');

// The opposite direction, and the one that costs money: the MONEY list is a different question and must
// still carry the brief. A bespoke order's whole value is that line.
assert.equal(getOrderProductItems(bespokeOnly).length, 1,
  'the bespoke brief must stay in the money/display list — it is priced, it is on the invoice, and it is '
  + 'the entire subtotal of seventeen of this shop\'s orders');
assert.equal(getOrderProductItems(mixed).length, 2, 'and the voucher line is still the only thing that list drops');

// --- the button and the action must ask the same question ------------------------------------------------
// Offering the button off one list and acting off another is how it came to offer itself and then fail.
const portal = readFileSync(join(here, '..', 'pages', 'CustomerPortalPage.jsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const enables = portal.match(/const canReorder = [^;]+;/);
assert.ok(enables, 'could not find the reorder button\'s enabling condition — update this guard');
assert.match(enables[0], /getReorderableItems\(/,
  'the reorder button is enabled off a different list than the reorder uses, so it offers itself on '
  + 'orders it cannot fill a cart from');
const action = portal.slice(portal.indexOf('const handleReorder'));
assert.match(action.slice(0, action.indexOf('};')), /getReorderableItems\(/,
  'the reorder action no longer reads the reorderable list');

console.log('reorderableItems selfcheck OK');
