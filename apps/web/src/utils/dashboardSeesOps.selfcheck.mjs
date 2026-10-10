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
//
// isOrderReservationExpired is LIFTED from orderService rather than approximated. It carries three
// exceptions, each with a reason written beside it, and a hand-written stub would quietly drop them —
// which is exactly the defect this chain now covers: opsHealthService had its own two-timestamp copy and
// called a protected order expired. A stub that re-implements the rule tests the stub, not the rule.
const orderSource = readFileSync(join(src, 'services', 'orderService.js'), 'utf8');
const lift = (needle, end = '\n};') => {
  const at = orderSource.indexOf(needle);
  if (at === -1) throw new Error(`orderService no longer defines ${needle} — update this chain`);
  const stop = orderSource.indexOf(end, at);
  return orderSource.slice(at, stop + end.length).replace(/^export /, '');
};
const reservationRule = [
  lift('export const PAYMENT_RESERVATION_TTL_HOURS', ';'),
  lift('const ACTIVE_RESERVATION_PAYMENT_STATUSES', ';'),
  lift('const getReservationExpiryDate'),
  lift('export const isOrderReservationExpired'),
].join('\n');

const stubs = `
const getOrderSyncQueue = () => globalThis.__syncQueue || [];
const retryOrderSyncQueue = async () => [];
const sweepExpiredOrderReservations = async () => ({ expiredOrders: [] });
const refreshDokuPaymentStatus = async () => ({});
const searchShippingDestinations = async () => [];
${reservationRule}
`;
const { getOpsHealthSnapshot } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + serviceSource, 'utf8').toString('base64')}`
);

// --- 1. The three questions, answered ------------------------------------------------------------------
globalThis.__syncQueue = [];
// inventoryDeducted is part of the rule, not decoration: with nothing held there is nothing to reclaim.
const lapsed = {
  paymentProvider: 'doku', paymentStatus: 'pending', status: 'processing',
  paymentExpiresAt: '2020-01-01T00:00:00Z', inventoryDeducted: true, paymentProofStatus: 'missing',
};
const live = {
  paymentProvider: 'doku', paymentStatus: 'pending', status: 'processing',
  paymentExpiresAt: '2099-01-01T00:00:00Z', inventoryDeducted: true, paymentProofStatus: 'missing',
};
const noWaybill = { paymentStatus: 'paid', shipmentStatus: 'packing', trackingNumber: '' };
const posted = { paymentStatus: 'paid', shipmentStatus: 'shipped', trackingNumber: 'JX123' };
const unsynced = { paymentStatus: 'paid', persistence: 'local' };

const snapshot = getOpsHealthSnapshot([lapsed, live, noWaybill, posted, unsynced]);
assert.equal(snapshot.dokuWindowLapsedOrders.length, 1, 'a lapsed payment window is one, and a live one is not');
assert.equal(snapshot.pendingPaymentOrders.length, 2, 'both pending orders are pending; only one has lapsed');
// --- 0. One name, one number, per screen ---------------------------------------------------------------
//
// DashboardPage rendered `expiredPaymentOrders.length` from its own useMemo in one card and
// `opsHealth.expiredPaymentOrders.length` in another, on the same page. Measured 2026-10-02 on the 33 live
// orders: 6 and 0, with ZERO orders in both lists — the page's own filter counted only cancelled orders,
// because the paymentStatus half let back in exactly what the isOrderReservationExpired half excludes.
//
// Derived: whatever the dashboards render as a count, taken off the page rather than named here.
{
  const screens = readdirSync(join(src, 'pages'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /Dashboard.*\.jsx$/.test(entry.name))
    .map((entry) => `pages/${entry.name}`)
    .concat(readdirSync(join(src, 'pages', 'mobile'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /Dashboard.*\.jsx$/.test(entry.name))
      .map((entry) => `pages/mobile/${entry.name}`));
  assert.ok(screens.length >= 2, `expected both dashboards; found ${screens.length}`);

  const collisions = [];
  for (const rel of screens) {
    const source = readFileSync(join(src, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
    const viaSnapshot = new Set([...source.matchAll(/opsHealth\.(\w+)\.length/g)].map((m) => m[1]));
    const viaOwn = new Set([...source.matchAll(/(?<!\.)\b(\w+)\.length/g)].map((m) => m[1]));
    for (const name of viaSnapshot) {
      if (viaOwn.has(name)) collisions.push(`${rel}: ${name}`);
    }
    console.log(`  ${rel}: ${viaSnapshot.size} counts from the snapshot, ${viaOwn.size} of its own`);
  }
  assert.deepEqual(collisions, [],
    'these screens render two different numbers under one name — one computed here, one by '
    + 'getOpsHealthSnapshot — so whichever the owner reads, the other contradicts it:\n  '
    + collisions.join('\n  '));
}

// --- 1b. The three exceptions the real rule carries, and opsHealthService used to walk straight past ---
//
// It compared paymentExpiresAt to now and stopped there. Each of these is a DOKU order whose window has
// lapsed, so the old copy counted all three — turning the dashboard red, and feeding the same list to the
// retry button, about orders that must not be treated as expired.
//
// Zero of them exist in production today (measured 2026-10-02: every order awaiting payment is
// manual_transfer_bca, which the DOKU filter already excludes), which is the only reason this never showed.
const base = {
  paymentProvider: 'doku', paymentStatus: 'pending', status: 'processing',
  paymentExpiresAt: '2020-01-01T00:00:00Z',
};
const protectedOrders = [
  ['nothing is held', { ...base, inventoryDeducted: false, paymentProofStatus: 'missing' }],
  ['the proof is in', { ...base, inventoryDeducted: true, paymentProofStatus: 'submitted' }],
  ['we owe them a shipping figure', {
    ...base, inventoryDeducted: true, paymentProofStatus: 'missing',
    paymentResponse: { shippingQuotePending: true },
  }],
];
for (const [why, order] of protectedOrders) {
  const guarded = getOpsHealthSnapshot([order]);
  assert.equal(guarded.dokuWindowLapsedOrders.length, 0,
    `an order whose window lapsed must not be called expired when ${why} — the rule in orderService says so, `
    + 'and the ops panel must not keep a second opinion');
  assert.equal(guarded.hasCriticalIssues, false,
    `nor may it turn the panel red: ${why}`);
}
// And the one that genuinely has lapsed still does, so the exceptions did not swallow the rule.
assert.equal(getOpsHealthSnapshot([lapsed]).dokuWindowLapsedOrders.length, 1);
assert.equal(getOpsHealthSnapshot([lapsed]).hasCriticalIssues, true);

// A paid parcel with no waybill USED to be counted here, and this assertion required it. It is gone:
// not one of the 35 orders on production carries a tracking_number, 13 of them shipped, and Dekito
// confirmed on 2026-10-10 that this is how he ships. The count could only ever be "all of them", on
// both dashboards, forever — an alarm that never stops is not an alarm. So the snapshot must NOT grow
// it back, and a shop whose parcels carry no number must read clean.
assert.ok(!('shipmentNeedsResi' in snapshot),
  'the ops snapshot is counting missing waybills again — this shop does not record them');
assert.equal(getOpsHealthSnapshot([noWaybill]).hasCriticalIssues, false,
  'a paid parcel with no waybill is not an ops problem in this shop');
assert.equal(snapshot.localOrders.length, 1, 'an order that never reached the server counts as one');
assert.equal(snapshot.hasCriticalIssues, true, 'a lapsed payment is critical');
assert.equal(getOpsHealthSnapshot([posted]).hasCriticalIssues, false,
  'and a clean shop must read clean, or the red banner means nothing');
assert.deepEqual(getOpsHealthSnapshot([]).dokuWindowLapsedOrders, [], 'no orders is not an alarm');

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
  // The fields are taken from the snapshot ITSELF, not listed. Written as a list, this broke the moment a
  // field was renamed — and a list is also how a NEW answer gets added to the service and shown nowhere.
  //
  // Two array fields are deliberately not cards: syncQueue drives the retry button, and
  // pendingPaymentOrders is the input the DOKU check walks. Each exception carries the reason it is one.
  const NOT_A_CARD = {
    syncQueue: 'drives the retry button, not a count',
    pendingPaymentOrders: 'the list the DOKU health check walks, shown as its own card on desktop only',
  };
  const answers = Object.entries(getOpsHealthSnapshot([]))
    .filter(([name, value]) => Array.isArray(value) && !NOT_A_CARD[name])
    .map(([name]) => name);
  // Two since the missing-waybill count was dropped (see above). The floor is here so a broken parse
  // cannot pass by finding nothing at all.
  assert.ok(answers.length >= 2, `expected the snapshot's answers to be derivable; found ${answers.join(', ')}`);
  // Mentioned is not shown. A sabotage that replaced the rendered number with a literal 0 passed a
  // file-wide includes(), because the field was still named in a useMemo above.
  //
  // Slicing "from the first return (" did not fix it either: on the phone dashboard that lands at line 62,
  // inside a small helper, so the slice was almost the whole file again. What distinguishes a rendered
  // number is the JSX around it — `>{…}` for a child, `={…}` or `={\`…\`}` for a prop — and that is what
  // this looks for, line by line. It cannot prove the element is reachable; it can tell a value that
  // reaches JSX from one that only reaches a variable.
  const renderedLines = text.split('\n').filter((line) => /[>=]\{|\{`/.test(line));
  assert.ok(renderedLines.length > 20, `${where}: no JSX lines found — update this chain`);
  const renderedText = renderedLines.join('\n');
  for (const field of answers) {
    assert.ok(renderedText.includes(field),
      `${where} takes the snapshot but never RENDERS ${field} — the question is asked and the answer `
      + 'dropped on the way to the screen');
  }
}

console.log('dashboardSeesOps selfcheck OK (both dashboards ask the ops-health question, show every answer '
  + 'the snapshot returns, and no number is rendered twice under one name)');
