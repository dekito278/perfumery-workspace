// `node src/utils/readyToPack.selfcheck.mjs`
//
// Opened Dekito's own Studio on the phone, 2026-09-21, and read two screens in a row:
//
//   Dashboard  →  "SIAP PACKING · 3 order siap packing · Isi resi lalu tandai dikirim"
//   the screen it opens  →  "1 SIAP"
//
// Same errand, same moment, two numbers. The dashboards counted it themselves — paid, not shipped, not
// finished — while the fulfillment screen also holds back a bespoke order whose production is not Ready
// and treats status 'shipped' as gone.
//
// A card that promises what another screen will show has to count with that screen's rule. So there is
// one rule now, and this file is what keeps the three surfaces on it.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// orderWorkflow reaches into the service layer for the bespoke test, which drags Supabase into node.
// Same shim the notification guard uses: strip the imports, stub what they provided. The multi-line form
// has to be handled too — a single-line-only strip once left `Cannot find package '@/services'`.
const workflowSource = readFileSync(join(root, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const stubs = `
const isBespokeOrder = (order = {}) => order?.source === 'bespoke' || order?.requestType === 'bespoke'
  || (Array.isArray(order?.items) && order.items.some((item) => item.type === 'bespoke'));
const getBespokeItem = (order = {}) => (Array.isArray(order?.items) ? order.items.find((item) => item.type === 'bespoke') : null);
`;
const { isReadyToPack } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflowSource, 'utf8').toString('base64')}`
);

// --- 1. The cases that made the two numbers differ ----------------------------------------------------
const plainPaid = { paymentStatus: 'paid', status: 'processing', shipmentStatus: 'not_ready' };
assert.equal(isReadyToPack(plainPaid), true, 'a paid storefront order waiting to be packed is ready');

const bespokeInProduction = { paymentStatus: 'paid', status: 'processing', source: 'bespoke', bespokeProductionStatus: 'in_progress' };
assert.equal(isReadyToPack(bespokeInProduction), false,
  'a bespoke order still in production is NOT packable — the fulfillment screen has always held it back');
assert.equal(isReadyToPack({ ...bespokeInProduction, bespokeProductionStatus: 'ready' }), true,
  'and it becomes packable the moment production says Ready');

assert.equal(isReadyToPack({ paymentStatus: 'paid', status: 'shipped', shipmentStatus: 'not_ready' }), false,
  'an order the shop already calls shipped is gone from the queue, whatever the shipment column says');

// --- 2. The states that were never in doubt ------------------------------------------------------------
assert.equal(isReadyToPack({ paymentStatus: 'pending', status: 'processing' }), false, 'unpaid is not packable');
assert.equal(isReadyToPack({ paymentStatus: 'paid', status: 'cancelled' }), false, 'cancelled is not packable');
assert.equal(isReadyToPack({ paymentStatus: 'paid', status: 'completed' }), false);
assert.equal(isReadyToPack({ paymentStatus: 'paid', shipmentStatus: 'delivered' }), false);
assert.equal(isReadyToPack({ paymentStatus: 'paid', shipmentStatus: 'packing' }), true,
  'a printed label does not remove it from the queue — the resi still has to be filled in');
assert.equal(isReadyToPack({}), false);
assert.equal(isReadyToPack(null), false, 'never throws on nothing');

// --- 3. Every screen that says "siap packing" counts with that rule ------------------------------------
for (const [name, file] of [
  ['the phone dashboard', ['pages', 'mobile', 'MobileDashboardPage.jsx']],
  ['the desktop dashboard', ['pages', 'DashboardPage.jsx']],
  ['the phone fulfillment screen', ['pages', 'mobile', 'MobileFulfillmentPage.jsx']],
]) {
  const source = read(...file);
  assert.match(source, /isReadyToPack/, `${name} must count with the shared rule`);
  assert.doesNotMatch(source, /paymentStatus === 'paid' && !\['shipped', 'delivered'\]\.includes\(order\.shipmentStatus\)/,
    `${name} still derives its own "ready" rule — that is how the two numbers drifted apart`);
  // Importing the rule and then not using it is the same drift with an extra step: the fulfillment
  // screen went back to composing isPaid && isOpenShipment && isBespokeReady while still importing.
  assert.doesNotMatch(source, /isPaid\(order\) && isOpenShipment\(order\)/,
    `${name} composes its own ready rule beside the shared one`);
}

console.log('readyToPack selfcheck OK (the card and the screen it opens count the same orders)');
