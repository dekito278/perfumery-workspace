// `node src/utils/fulfillmentRowStatus.selfcheck.mjs`
//
// The shipping screen's status chip answered the wrong question. It asked "can this row be packed?" and
// printed a BESPOKE PRODUCTION STAGE whenever the answer was no — defaulting to "Review brief" when the
// order had no stage at all, which a storefront order never does.
//
// Read on Dekito's own Studio, 2026-09-24:
//   * Dikirim queue, 10 shipped orders, every single row labelled "Review brief"
//   * DKT-MSWXQHFH-BP49DX — Vanille Planifolia, not bespoke — labelled "Review brief"
//   * DKT-MSSKNMSA-4LPJLX and DKT-MRMYUW9Q — NOT paid — each stamped "Sudah dibayar", because that chip
//     was a hardcoded string and only its colour changed with the real status
//
// So two rules, and the second is the one that bites: a chip may only name a bespoke stage for an order
// that is actually waiting on bespoke production, and a chip that names a payment status must read it
// from the data instead of asserting it.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

// orderWorkflow reaches into the service layer for the bespoke test, which drags Supabase into node.
// Same shim readyToPack uses, and the stub mirrors the real isBespokeOrder exactly — a stub that tests
// something else is how a guard comes back green while the rule is broken.
const workflowSource = readFileSync(join(srcRoot, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const stubs = `
const isBespokeOrder = (order) => order?.source === 'bespoke' || order?.requestType === 'bespoke'
  || (Array.isArray(order?.items) && order.items.some((item) => item.type === 'bespoke'));
const getBespokeItem = (order) => (Array.isArray(order?.items) ? order.items.find((item) => item.type === 'bespoke') : null);
`;
const { isBlockedByBespokeProduction, paymentStatusLabels } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflowSource, 'utf8').toString('base64')}`
);

const bespoke = (extra = {}) => ({
  paymentStatus: 'paid',
  items: [{ name: 'Bespoke perfume: After Rain', type: 'bespoke' }],
  bespokeProductionStatus: 'review_brief',
  ...extra,
});
const storefront = (extra = {}) => ({
  paymentStatus: 'paid',
  items: [{ name: 'Vanille Planifolia' }],
  ...extra,
});

// --- 1. Only a bespoke order still in production has a production stage to show -----------------------
assert.equal(isBlockedByBespokeProduction(bespoke()), true,
  'a bespoke order still at review brief is genuinely waiting on production');
assert.equal(isBlockedByBespokeProduction(bespoke({ bespokeProductionStatus: 'sample' })), true);

assert.equal(isBlockedByBespokeProduction(storefront()), false,
  'a storefront order has no production stage — it was being shown one');
assert.equal(isBlockedByBespokeProduction(storefront({ paymentStatus: 'unpaid' })), false,
  'an unpaid storefront order is not a bespoke brief under review');
assert.equal(isBlockedByBespokeProduction(storefront({ shipmentStatus: 'shipped' })), false);

// --- 2. Once the parcel is gone, the production stage is history --------------------------------------
assert.equal(isBlockedByBespokeProduction(bespoke({ shipmentStatus: 'shipped' })), false,
  'a shipped bespoke order must say where the parcel is, not what the formula was doing');
assert.equal(isBlockedByBespokeProduction(bespoke({ status: 'shipped' })), false,
  'shipped via order status counts the same as shipped via shipment status');
assert.equal(isBlockedByBespokeProduction(bespoke({ status: 'completed' })), false);
assert.equal(isBlockedByBespokeProduction(bespoke({ shipmentStatus: 'delivered' })), false);
assert.equal(isBlockedByBespokeProduction(bespoke({ bespokeProductionStatus: 'ready' })), false,
  'production finished is not production pending');

assert.equal(isBlockedByBespokeProduction(), false, 'no order at all is not a bespoke order');
assert.equal(isBlockedByBespokeProduction({}), false);

// --- 3. The shipping row reads the rule, and never hardcodes a payment claim ---------------------------
const fulfillment = read('pages', 'mobile', 'MobileFulfillmentPage.jsx');

assert.match(fulfillment, /isBlockedByBespokeProduction\(order\)/,
  'the row chip must decide from the shared rule, not from "cannot be packed"');
assert.doesNotMatch(fulfillment, />\s*Sudah dibayar\s*</,
  'a payment chip may not assert a payment status as a literal — two unpaid orders were labelled paid');
assert.match(fulfillment, /paymentStatusLabels\[order\.paymentStatus\]/,
  'it must read the label from the payment status the order actually has');

// The fallback matters too: an order with no shipment status yet is "Belum siap", never "Ready" — on a
// shipping screen "Ready" and "siap" are the same word to the person reading it.
assert.doesNotMatch(fulfillment, /shipmentStatusLabels\[order\.shipmentStatus\] \|\| 'Ready'/,
  'an unknown shipment status is not Ready');

// --- 4. No screen may PICK a bespoke stage from a condition that is not about bespoke ----------------
// The bug had an exact shape: `blocked ? bespokeProductionStatusLabels[...]`, where `blocked` meant
// "cannot be packed". So this reads the condition that chooses the stage and insists it is a question
// about bespoke production. A stage rendered inside an already bespoke-gated section is not this shape
// and is left alone — a guard that cries wolf on correct code gets switched off, and then it guards
// nothing.
const pages = readdirSync(join(srcRoot, 'pages'), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.jsx'))
  .map((entry) => join(entry.parentPath || entry.path, entry.name));

const bespokeGate = /bespoke/i;
let checkedChips = 0;

for (const file of pages) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const name = file.replace(srcRoot, 'src');

  for (const match of source.matchAll(/([A-Za-z_$][\w$.]*)\s*\?\s*bespokeProductionStatusLabels\[/g)) {
    checkedChips += 1;
    assert.match(match[1], bespokeGate,
      `${name} picks a bespoke production stage with "${match[1]}", which is not a question about bespoke production`);
  }
}

assert.ok(checkedChips >= 1,
  `expected to find the stage-picking ternary by scan, found ${checkedChips} — the scan is broken, not the code`);

// --- 5. The labels the chips read are the shared ones --------------------------------------------------
assert.equal(paymentStatusLabels.unpaid, 'Belum dibayar');
assert.equal(paymentStatusLabels.pending, 'Menunggu bayar');
assert.notEqual(paymentStatusLabels.unpaid, paymentStatusLabels.paid,
  'if these ever collapse to one string the chip is back to asserting the same thing for everyone');

console.log('fulfillmentRowStatus selfcheck OK (a row says where the parcel is, and whether it was paid)');
