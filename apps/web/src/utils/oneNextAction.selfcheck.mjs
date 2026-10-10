// `node src/utils/oneNextAction.selfcheck.mjs`
//
// Both Studio order screens draw a "what do I do with this order" card, and each worked the answer out
// itself. Read against the live table on 2026-10-10 (service role, 35 orders) they disagreed about real
// orders:
//
//   3 orders  status 'shipped', shipment_status still not_ready
//             desktop "Follow-up pengiriman" / phone "Mulai packing" — and the phone's big button
//             WRITES that status, so one tap moved a parcel already sent back into packing. Its
//             getFulfillmentStep read shipment_status alone; isShippedOrder, the rule the rest of the
//             app shares, reads the order status too.
//   1 order   completed, shipment_status not_ready
//             desktop "Lanjutkan produksi bespoke" / phone "Mulai packing", for an order the shop
//             considers finished and refuses to edit. Neither ladder asked isArchivedOrder.
//
// The rule: one ladder, and the words on the card may never contradict the write the button performs.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { BESPOKE_SOURCE } from './bespokeOrder.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// orderWorkflow reaches into the service layer for the bespoke test, which drags Supabase into node.
// The same shim readyToPack uses; the stub mirrors the real isBespokeOrder, constant injected rather
// than retyped.
const workflowSource = readFileSync(join(root, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const stubs = `
const BESPOKE_SOURCE = ${JSON.stringify(BESPOKE_SOURCE)};
const CLOSED_PAYMENT_STATUSES = ['expired', 'failed', 'refunded'];
const PAYMENT_RESERVATION_TTL_HOURS = 24;
const getOrderReservationExpiresAt = () => '';
const isBespokeOrder = (order = {}) => order?.source === BESPOKE_SOURCE || order?.requestType === BESPOKE_SOURCE
  || (Array.isArray(order?.items) && order.items.some((item) => item.type === BESPOKE_SOURCE));
const getBespokeItem = (order = {}) => (Array.isArray(order?.items) ? order.items.find((item) => item.type === BESPOKE_SOURCE) : null);
`;
const { ORDER_TASKS, isArchivedOrder, isShippedOrder, nextFulfillmentAction, nextOrderTask } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflowSource, 'utf8').toString('base64')}`
);

// ── 1. The orders that reported this ───────────────────────────────────────────────────────────────
const shippedByStatusOnly = { paymentStatus: 'paid', status: 'shipped', shipmentStatus: 'not_ready' };
assert.equal(nextOrderTask(shippedByStatusOnly), ORDER_TASKS.followUp,
  'an order the shop already considers shipped is not waiting to be packed');
assert.equal(nextFulfillmentAction(shippedByStatusOnly), null,
  'and no button may offer to move a parcel already sent back into packing');

const finished = { paymentStatus: 'paid', status: 'completed', shipmentStatus: 'not_ready', source: BESPOKE_SOURCE, bespokeProductionStatus: 'review_brief' };
assert.equal(nextOrderTask(finished), ORDER_TASKS.done, 'a finished order has nothing left to do');
assert.equal(nextFulfillmentAction(finished), null, 'and nothing left to write');

// ── 2. The card and the button may never contradict each other ─────────────────────────────────────
// The whole cross product of what the owner can set, plus the two flags the ladder reads.
const orderStatuses = ['draft', 'pending_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
const paymentStatuses = ['unpaid', 'pending', 'paid', 'failed', 'expired', 'refunded'];
const shipmentStatuses = ['not_ready', 'packing', 'shipped', 'delivered'];
const proofStatuses = ['missing', 'submitted', 'approved', 'rejected'];

// A write is only coherent with certain words. "Mulai packing" under "Follow-up pengiriman" is the bug.
const ALLOWED_WITH = new Map([
  [null, [ORDER_TASKS.review, ORDER_TASKS.done, ORDER_TASKS.proof, ORDER_TASKS.quote, ORDER_TASKS.payment, ORDER_TASKS.followUp]],
  ['packing', [ORDER_TASKS.pack, ORDER_TASKS.proof]],
  ['shipped', [ORDER_TASKS.ship, ORDER_TASKS.proof]],
]);

let checked = 0;
for (const status of orderStatuses) {
  for (const paymentStatus of paymentStatuses) {
    for (const shipmentStatus of shipmentStatuses) {
      for (const paymentProofStatus of proofStatuses) {
        for (const trackingNumber of ['', 'JX0001']) {
          const order = { status, paymentStatus, shipmentStatus, paymentProofStatus, trackingNumber };
          const task = nextOrderTask(order);
          const action = nextFulfillmentAction(order);
          checked += 1;

          assert.ok(
            Object.values(ORDER_TASKS).includes(task),
            `nextOrderTask invented a task for ${JSON.stringify(order)}`,
          );
          assert.ok(
            ALLOWED_WITH.get(action?.status ?? null).includes(task),
            `the card says "${task.title}" while the button would write ${action?.status ?? 'nothing'} — ${JSON.stringify(order)}`,
          );

          // A finished or cancelled order is never given work, and never a write.
          if (isArchivedOrder(order)) {
            assert.equal(task, ORDER_TASKS.done, `${JSON.stringify(order)} is archived but was given work`);
            assert.equal(action, null, `${JSON.stringify(order)} is archived but was offered a write`);
          }
          // Nothing moves until the money is in.
          if (paymentStatus !== 'paid') {
            assert.equal(action, null, `${JSON.stringify(order)} is unpaid but was offered a shipment write`);
          }
          // The parcel never goes backwards.
          if (isShippedOrder(order)) {
            assert.equal(action, null, `${JSON.stringify(order)} has shipped but was offered ${action?.status}`);
          }
          // And no task asks for a waybill at all: theShopDoesNotChaseAWaybill owns that rule.
          assert.ok(
            !/(?:lengkapi|isi|minta|scan|paste)[^'"]{0,24}resi|nomor resi/i.test(task.title),
            `the task ladder is asking for a waybill again: "${task.title}"`,
          );
        }
      }
    }
  }
}
assert.ok(checked >= 1000, `only ${checked} combinations exercised — the cross product collapsed`);

// ── 3. Neither screen keeps its own ladder ─────────────────────────────────────────────────────────
const SCREENS = {
  'pages/OrderDetailPage.jsx': /const nextOperationalTask = nextOrderTask\(order\);/,
  'pages/mobile/MobileOrderDetailPage.jsx': /const orderTask = nextOrderTask\(order\);/,
};
for (const [file, wiring] of Object.entries(SCREENS)) {
  const source = read(...file.split('/'));
  assert.match(source, wiring, `${file} must take its next task from the shared ladder`);
  assert.doesNotMatch(source, /const getNextO(perationalTask|rderTask) = /,
    `${file} has grown its own task ladder again`);
  assert.doesNotMatch(source, /const getFulfillmentStep = /,
    `${file} has grown its own fulfillment step again`);
}

// The phone's big button, and the same decision made again inside its section handler: both are the
// shared write, because the button is what actually moves the order.
const phone = read('pages', 'mobile', 'MobileOrderDetailPage.jsx');
assert.equal(
  (phone.match(/nextFulfillmentAction\(order\)/g) || []).length,
  2,
  "the phone decides the shipment write in two places — the button and its section handler — and both must be the shared one",
);
assert.match(phone, /quickShipmentUpdate\((?:step|fulfillmentStep)\.status\)/,
  'the write must still come from the shared action rather than a status typed at the call site');

console.log(`oneNextAction: ok — ${checked} order shapes, the card and the button agree on every one`);
