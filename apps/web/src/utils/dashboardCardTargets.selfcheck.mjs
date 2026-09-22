// `node src/utils/dashboardCardTargets.selfcheck.mjs`
//
// A priority card is a promise about another screen: a number, and a tap that opens the list it counted.
// Two of them were counting something else.
//
//   "Bukti transfer · N bukti perlu dicek"  →  /studio/orders?filter=proof_review
//      The card counted every submitted proof that was not finished; the tab hides orders whose label is
//      already printed or which have shipped. The number was larger than the list.
//
//   "Follow-up · 5 payment pending"  →  /mobile/studio/orders   (no filter at all)
//      The default tab is "Aktif", which deliberately leaves out orders that are only waiting on the
//      customer to pay. Tapping the card opened a list with none of the five in it.
//
// The rule: whatever a card counts, the screen it opens must show. Where a card names a filter, it must
// count with that filter.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Each counted card opens a list that shows what it counted -------------------------------------
// Scoped to the cards that show a NUMBER. A plain "open the orders screen" link elsewhere on the page is
// navigation, not a promise about a count, and the first version of this check wrongly flagged one.
const cardsOf = (source) => [...source.matchAll(/<PriorityCard[\s\S]*?\/>/g)].map((match) => match[0]);

for (const [name, file] of [
  ['the phone dashboard', ['pages', 'mobile', 'MobileDashboardPage.jsx']],
  ['the desktop dashboard', ['pages', 'DashboardPage.jsx']],
]) {
  const source = read(...file);
  const cards = cardsOf(source);
  if (!cards.length) continue; // the desktop page builds its cards from a list, checked in rule 2

  for (const card of cards) {
    const counted = card.match(/title=\{`\$\{(\w+)\.length\}/);
    const target = card.match(/navigate\('([^']+)'\)/);
    if (!counted || !target) continue;
    const [, variable] = counted;
    const [, path] = target;
    if (!path.includes('/orders')) continue; // a products or fulfillment card is checked by its own rule

    const filter = path.match(/\?filter=(\w+)/);
    assert.ok(filter,
      `${name}: "${variable}" is counted and then opens ${path} with no filter — the default tab hides orders waiting on the customer`);
    assert.ok(new RegExp(`const ${variable}[\\s\\S]{0,400}?matchesOrderFilter\\(order, '${filter[1]}'\\)`).test(source),
      `${name}: the card opens ?filter=${filter[1]} but "${variable}" is counted some other way`);
  }
}

// --- 2. The predicates are the shared ones, not re-derived ----------------------------------------------
for (const [name, file] of [
  ['the phone dashboard', ['pages', 'mobile', 'MobileDashboardPage.jsx']],
  ['the desktop dashboard', ['pages', 'DashboardPage.jsx']],
]) {
  const source = read(...file);
  assert.doesNotMatch(source, /paymentProofStatus === 'submitted' && !\['completed', 'cancelled'\]/,
    `${name} still derives its own proof-review rule beside the shared one`);
  assert.match(source, /from '@\/utils\/orderWorkflow\.js'/, `${name} must read the shared queue rules`);
}

// --- 3. The follow-up card says what it counts ----------------------------------------------------------
// It counts the whole follow-up queue now, so its title may not claim to be only the unpaid half.
const phone = read('pages', 'mobile', 'MobileDashboardPage.jsx');
assert.match(phone, /title=\{`\$\{followUpOrders\.length\} order perlu follow-up`\}/,
  'the card must be titled for what it counts');
assert.match(phone, /helper=\{`\$\{paymentFollowUps\.length\} belum dibayar/,
  'and the breakdown belongs in the helper, where it is not the number being tapped');


// --- 4. A breakdown under a number has to add up to it ------------------------------------------------
// Measured in Dekito's Studio, 2026-09-22: the card said "16 order perlu follow-up" and the line under it
// said "5 belum dibayar · 10 dikirim perlu dicek". One order was in the queue and in neither half of its
// own explanation — the shipped half read shipment_status alone, while the queue counts isShippedOrder,
// which also believes status 'shipped'. That is the same order the invoice was contradicting itself
// about this morning.
const workflowSource = readFileSync(join(root, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const stubs = `
const isBespokeOrder = (order = {}) => order?.source === 'bespoke';
const getBespokeItem = () => null;
`;
const { matchesOrderFilter, isShippedOrder } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflowSource, 'utf8').toString('base64')}`
);

const fixtures = [
  { name: 'unpaid', paymentStatus: 'unpaid', status: 'pending_payment' },
  { name: 'pending', paymentStatus: 'pending', status: 'pending_payment' },
  { name: 'shipped by shipment_status', paymentStatus: 'paid', status: 'paid', shipmentStatus: 'shipped' },
  { name: 'shipped by order status only', paymentStatus: 'paid', status: 'shipped', shipmentStatus: 'not_ready' },
  { name: 'packing', paymentStatus: 'paid', status: 'paid', shipmentStatus: 'packing' },
  { name: 'delivered', paymentStatus: 'paid', status: 'paid', shipmentStatus: 'delivered' },
  { name: 'cancelled', paymentStatus: 'expired', status: 'cancelled' },
];

const queue = fixtures.filter((order) => matchesOrderFilter(order, 'follow_up'));
const paymentHalf = fixtures.filter((order) => (
  matchesOrderFilter(order, 'follow_up') && ['unpaid', 'pending'].includes(order.paymentStatus)
));
const shippedHalf = fixtures.filter((order) => (
  matchesOrderFilter(order, 'follow_up')
  && !['unpaid', 'pending'].includes(order.paymentStatus)
  && isShippedOrder(order)
));
assert.equal(paymentHalf.length + shippedHalf.length, queue.length,
  `the halves add up to ${paymentHalf.length + shippedHalf.length} but the queue holds ${queue.length}`);
assert.ok(shippedHalf.some((order) => order.name === 'shipped by order status only'),
  'the order the shop calls shipped without a shipment_status is the one that used to fall between the halves');

// And the page computes its halves that way, not from shipment_status alone.
const phoneDash = read('pages', 'mobile', 'MobileDashboardPage.jsx');
assert.match(phoneDash, /const shippedFollowUps[\s\S]{0,320}?isShippedOrder\(order\)/,
  'the shipped half must use the same rule the queue uses');
assert.doesNotMatch(phoneDash, /const shippedFollowUps = useMemo\(\(\) => orders\.filter\(\(order\) => order\.shipmentStatus === 'shipped'/,
  'the shipment_status-only version must not come back');

console.log('dashboardCardTargets selfcheck OK (a card counts what its screen will show)');
