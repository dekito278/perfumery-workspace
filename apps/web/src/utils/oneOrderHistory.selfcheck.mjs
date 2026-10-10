// `node src/utils/oneOrderHistory.selfcheck.mjs`
//
// Three Studio screens read the order audit log. Measured against the live log on 2026-10-11 — 568 rows,
// 176 of them for the 35 orders that still exist — they read it three different ways:
//
//   order detail (desktop)  the full before/after list, and a line naming the row's values when nothing
//                           changed
//   dashboard               its own copy of the same three helpers, and for that case a developer's
//                           sentence: "Tidak ada diff field terdeteksi." Half the log is that case.
//                           Its "which keys matter" list had also drifted from the order detail's: the
//                           dashboard held paymentProofStatus, the order detail did not, so the 24 rows
//                           recording a proof approved or rejected were highlighted on the dashboard
//                           and plain on the screen where a disputed payment is read.
//   the phone               FETCHED the whole log, twice, and rendered none of it — spent entirely on
//                           the proof timeline. Its history showed status_timeline instead: 45 entries
//                           across all 35 orders against the log's 176, and 14 of those orders have an
//                           empty status_timeline, so the list was synthesised with one timestamp.
//
// The rule: one reading of an audit row, and a screen that FETCHES the log has to SHOW it.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AUDIT_KEYS_THAT_MATTER,
  auditChanges,
  auditRowIsImportant,
  auditRowOpensAnOrder,
  formatAuditLabel,
  summariseAuditValues,
} from './orderAuditChanges.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// orderWorkflow reaches into the service layer, which drags Supabase into node, so its action list is
// parsed out of the module that owns it rather than imported.
const workflow = readFileSync(join(root, 'utils', 'orderWorkflow.js'), 'utf8');
const labelBlock = workflow.match(/export const ORDER_AUDIT_LABELS = \{([\s\S]*?)\n\};/);
assert.ok(labelBlock, "could not find ORDER_AUDIT_LABELS — this guard's parse is broken, not the map");
const proofBlock = workflow.match(/export const PAYMENT_PROOF_AUDIT_LABELS = \{([\s\S]*?)\n\};/);
assert.ok(proofBlock, "could not find PAYMENT_PROOF_AUDIT_LABELS — this guard's parse is broken");
const auditActions = [
  ...[...proofBlock[1].matchAll(/^\s*(\w+):/gm)].map((match) => match[1]),
  ...[...labelBlock[1].matchAll(/^\s*(\w+):/gm)].map((match) => match[1]),
];
assert.ok(auditActions.length >= 9, `only ${auditActions.length} audit actions parsed — the parse is broken`);

// ── 1. The shapes the live log actually holds ─────────────────────────────────────────────────────
// The seven actions in the log today, and the value keys the busiest of them carry.
const liveRow = (action, previousValues, nextValues) => ({ id: action, action, previousValues, nextValues });

// A write that recorded the value it already held. 295 of 568 rows.
const noChange = liveRow('payment_status_updated', { status: 'cancelled', paymentStatus: 'expired' }, { status: 'cancelled', paymentStatus: 'expired' });
assert.deepEqual(auditChanges(noChange.previousValues, noChange.nextValues), [],
  'a row whose values did not change has no changes to list');
assert.equal(summariseAuditValues(noChange.nextValues), 'status: cancelled / paymentStatus: expired',
  'and it must say what it HOLDS — the row happened, and the feed is read to find out what the order looked like then');
assert.notEqual(summariseAuditValues(noChange.nextValues), '-', 'a row with values must not summarise as nothing');

// A proof approved. 24 rows carry paymentProofStatus, and they must matter on EVERY screen.
const proof = auditChanges({ paymentProofStatus: 'submitted' }, { paymentProofStatus: 'approved' });
assert.equal(proof.length, 1);
assert.equal(auditRowIsImportant(proof), true,
  'a payment proof being approved or rejected is important — this is the key the two lists disagreed about');
for (const key of ['paymentStatus', 'payment_status', 'status', 'paymentProofStatus', 'payment_proof_status', 'shipmentStatus', 'shipment_status']) {
  assert.ok(AUDIT_KEYS_THAT_MATTER.includes(key), `${key} must still be one of the keys that matter`);
}

// Both spellings, because the three /api endpoints write raw snake_case rows.
assert.equal(auditRowIsImportant(auditChanges({ payment_status: 'unpaid' }, { payment_status: 'paid' })), true,
  'a snake_case row records the same change and must read the same');

// An order that no longer exists. 63 rows, one per deleted order.
assert.equal(auditRowOpensAnOrder(liveRow('order_deleted', { status: 'paid' }, { deleted: true })), false,
  'a row about a deleted order must not be a link to it');
for (const action of auditActions.filter((name) => name !== 'order_deleted')) {
  assert.equal(auditRowOpensAnOrder({ action }), true, `${action} happens to an order that still exists`);
}

// Labels are derived, so a key nobody listed still reads as words.
assert.equal(formatAuditLabel('bespokeProductionStatus'), 'Bespoke Production Status');
assert.equal(formatAuditLabel('payment_proof_url'), 'Payment proof url');

// ── 2. Nobody keeps a private copy ───────────────────────────────────────────────────────────────
const SCREENS = ['pages/DashboardPage.jsx', 'pages/OrderDetailPage.jsx', 'pages/mobile/MobileOrderDetailPage.jsx'];
for (const file of SCREENS) {
  const source = read(...file.split('/'));
  assert.match(source, /from '@\/utils\/orderAuditChanges\.js'/, `${file} must read an audit row the shared way`);
  for (const dead of ['const getAuditChanges', 'const formatAuditValue', 'const formatAuditLabel', 'const importantAuditKeys', 'const formatAuditValues']) {
    assert.ok(!source.includes(dead), `${file} has grown its own audit-row reading again (${dead})`);
  }
}

// ── 3. A screen that FETCHES the log SHOWS it ────────────────────────────────────────────────────
// The phone's was the whole bug: two fetches, spent on the proof timeline, and a history tab built from
// a different and thinner column. The subject is read from the code — whoever calls for the log.
const ALL = ['pages/DashboardPage.jsx', 'pages/OrderDetailPage.jsx', 'pages/mobile/MobileOrderDetailPage.jsx',
  'pages/OrdersPage.jsx', 'pages/mobile/MobileOrdersPage.jsx', 'pages/ShipmentsPage.jsx', 'pages/mobile/MobileFulfillmentPage.jsx',
  'pages/mobile/MobileDashboardPage.jsx'];
let fetchers = 0;
for (const file of ALL) {
  const source = read(...file.split('/'));
  if (!/get(?:All)?OrderAuditLogs\(/.test(source)) continue;
  fetchers += 1;
  assert.match(
    source,
    /auditChanges\(log\.previousValues, log\.nextValues\)/,
    `${file} loads the order audit log and never renders a row of it — the proof timeline is not the history`,
  );
  assert.match(
    source,
    /ORDER_AUDIT_LABELS\[log\.action\]|auditActionLabels\[log\.action\]/,
    `${file} renders audit rows without naming the action in words`,
  );
}
assert.equal(fetchers, 3, `expected the three screens that load the audit log, found ${fetchers} — the scan is broken, not the code`);

// And the phone names the log for what it is, beside the thinner timeline it used to show alone.
const phone = read('pages', 'mobile', 'MobileOrderDetailPage.jsx');
assert.match(phone, /Riwayat perubahan/, "the phone's history tab must name the audit log it now shows");
assert.match(phone, /Status timeline/, 'and keep the status timeline beside it');

console.log(`oneOrderHistory: ok — ${SCREENS.length} screens on one reading, ${fetchers} of them fetch the log and all ${fetchers} render it`);
