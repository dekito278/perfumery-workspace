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

console.log('dashboardCardTargets selfcheck OK (a card counts what its screen will show)');
