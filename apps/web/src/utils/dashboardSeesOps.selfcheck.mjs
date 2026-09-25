// `node src/utils/dashboardSeesOps.selfcheck.mjs`
//
// getOpsHealthSnapshot answers three questions nobody asks out loud: has a payment window lapsed, is a
// paid parcel sitting in packing with no waybill, and did an order never reach the server. All three
// are worth exactly as much as the chance of being noticed.
//
// The desktop dashboard puts them in a banner that turns red. The phone dashboard — which loads the
// same orders, and is the surface this shop is actually run from — asked none of them. It has a "Studio
// ops" section, which is why the gap is easy to miss: that section is four navigation tiles to Formula,
// Batch, Biaya and Validasi. Same words, different thing.
//
// The phone dashboard is not a thin copy either. Its cards carry comments about miscounts found in
// Dekito's own Studio and fixed. This was simply never carried across.
//
// The rule: a dashboard that loads orders asks the ops-health question. Both halves derived — the
// snapshot is RUN against orders built here, and the dashboards are found on disk.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// The service reaches supabase through orderService, so the pure snapshot is lifted out and the two
// things it leans on are stubbed: the sync queue (a localStorage read) and the reservation expiry.
// Multi-line imports too: stripping only the single-line form left `import {\n  a,\n  b,\n} from …`
// intact, and the stub below then collided with a name the surviving import had already bound.
const serviceSource = readFileSync(join(src, 'services', 'opsHealthService.js'), 'utf8')
  .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const stubs = `
const getOrderSyncQueue = () => globalThis.__syncQueue || [];
const getOrderReservationExpiresAt = (order) => order.reservationExpiresAt || '';
const retryOrderSyncQueue = async () => [];
const sweepExpiredOrderReservations = async () => ({ expiredOrders: [] });
const refreshDokuPaymentStatus = async () => ({});
const searchShippingDestinations = async () => [];
`;
const { getOpsHealthSnapshot } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + serviceSource, 'utf8').toString('base64')}`
);

// --- 1. The three questions, answered ------------------------------------------------------------------
globalThis.__syncQueue = [];
const lapsed = {
  paymentProvider: 'doku', paymentStatus: 'pending', status: 'processing',
  paymentExpiresAt: '2020-01-01T00:00:00Z',
};
const live = {
  paymentProvider: 'doku', paymentStatus: 'pending', status: 'processing',
  paymentExpiresAt: '2099-01-01T00:00:00Z',
};
const noWaybill = { paymentStatus: 'paid', shipmentStatus: 'packing', trackingNumber: '' };
const posted = { paymentStatus: 'paid', shipmentStatus: 'shipped', trackingNumber: 'JX123' };
const unsynced = { paymentStatus: 'paid', persistence: 'local' };

const snapshot = getOpsHealthSnapshot([lapsed, live, noWaybill, posted, unsynced]);
assert.equal(snapshot.expiredPaymentOrders.length, 1, 'a lapsed payment window is one, and a live one is not');
assert.equal(snapshot.pendingPaymentOrders.length, 2, 'both pending orders are pending; only one has lapsed');
assert.equal(snapshot.shipmentNeedsResi.length, 1,
  'a paid parcel in packing with no tracking number needs a waybill; one already posted does not');
assert.equal(snapshot.localOrders.length, 1, 'an order that never reached the server counts as one');
assert.equal(snapshot.hasCriticalIssues, true, 'a lapsed payment is critical');
assert.equal(getOpsHealthSnapshot([posted]).hasCriticalIssues, false,
  'and a clean shop must read clean, or the red banner means nothing');
assert.deepEqual(getOpsHealthSnapshot([]).expiredPaymentOrders, [], 'no orders is not an alarm');

// --- 2. Every dashboard that loads orders asks it -------------------------------------------------------
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) screens.push(full);
  }
};
walk(join(src, 'pages'));

const dashboards = screens.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return /Dashboard/.test(file) && /useOrders\(\)/.test(text);
});
assert.equal(dashboards.length, 2,
  `expected both dashboards, found ${dashboards.length} — the scan is broken, not the code`);
assert.ok(dashboards.some((file) => file.includes(join('pages', 'mobile'))),
  'the phone dashboard is the half that was not asking');

for (const file of dashboards) {
  const where = file.slice(src.length + 1);
  const text = readFileSync(file, 'utf8');
  assert.match(text, /getOpsHealthSnapshot\(/,
    `${where} loads every order and never asks whether any of them is stuck. The answer costs one pure `
    + 'call over data it already has');
  // Asked AND shown. A snapshot computed into a variable nobody renders is the shape this repo has
  // shipped before: the fix written, never wired up.
  for (const field of ['expiredPaymentOrders', 'shipmentNeedsResi', 'localOrders']) {
    assert.ok(text.includes(field),
      `${where} takes the snapshot but never mentions ${field} — the question is asked and the answer `
      + 'dropped');
  }
}

console.log('dashboardSeesOps selfcheck OK (both dashboards ask the ops-health question and show all '
  + 'three answers)');
