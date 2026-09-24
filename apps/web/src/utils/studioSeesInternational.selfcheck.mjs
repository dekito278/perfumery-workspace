// `node src/utils/studioSeesInternational.selfcheck.mjs`
//
// An order that left the country is priced in one currency and displayed in another. The buyer is asked
// to transfer US$95, frozen at the rate the order was written with; Studio showed Rp 1.510.000 and said
// nothing else. On the desktop list it printed "Respons checkout tersimpan" — it knew the column held
// something and told Dekito nothing that was in it. On the phone, where he actually works, it printed
// nothing at all: an order to Berlin looked exactly like one to Bekasi.
//
// The cost is concrete and it is his money. When a dollar deposit lands in Jenius there has to be a
// figure on the screen for it to be checked against, and when a European order is waiting on a freight
// quote the screen has to say so — that order cannot be paid and its clock is stopped, so nothing moves
// it along on its own.
//
// The rule: one helper answers "is this international, and what are its facts", and every Studio screen
// that shows an order's payment state asks it rather than reading the blob itself. The screens are
// derived, not listed — a page that shows payment state and sits behind the authenticated layout IS a
// Studio order screen, and a guard that names its files can only catch the files someone remembered.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// --- 1. The helper, run rather than read --------------------------------------------------------------
// orderWorkflow.js imports through the '@/' alias, which node cannot resolve; strip the imports and give
// it nothing, because the part under test touches none of them. One line at a time: a pattern that is
// lazy across newlines swallows whole declarations, which has already broken one guard in this repo.
const workflow = read('utils', 'orderWorkflow.js')
  .replace(/^import\b[^\n]*from '[^']+';\n/gm, '');
const { internationalOrderSummary } = await import(
  `data:text/javascript;base64,${Buffer.from(workflow, 'utf8').toString('base64')}`
);

assert.equal(internationalOrderSummary({ paymentResponse: {} }), null,
  'a domestic order must come back null so a caller can render nothing without asking twice');
assert.equal(internationalOrderSummary({ paymentResponse: { amountUsd: 95 } }), null,
  'USD is what makes an order international here — an amount alone could be anything');
assert.equal(internationalOrderSummary({}), null, 'an order with no payment response at all is domestic');
assert.equal(internationalOrderSummary(null), null, 'and a missing order must not throw on a list screen');

const berlin = internationalOrderSummary({
  payment_response: { currency: 'USD', amountUsd: 95, destinationCountry: 'de', bankName: 'Jenius', shippingQuotePending: true },
});
assert.equal(berlin.country, 'DE', 'the country is a code, upper-cased — it is read at a glance beside an order number');
assert.equal(berlin.amountLabel, 'US$95', 'the dollar figure is what a Jenius deposit gets checked against');
assert.equal(berlin.awaitingQuote, true, 'an order waiting on freight must say so — nothing else moves it');
// snake_case as well as camelCase, for the same reason isAwaitingShippingQuote reads both.
assert.ok(internationalOrderSummary({ paymentResponse: { currency: 'USD', amountUsd: 80 } }),
  'the client normalises to paymentResponse; the server-side sweeps read raw rows');
// A frozen rate that did not survive the round trip must not be printed as "US$0".
assert.equal(internationalOrderSummary({ paymentResponse: { currency: 'USD' } }).amountLabel, '',
  'no amount means no label — "US$0" on a paid order is worse than an empty space');

// --- 2. Every Studio order screen asks it -------------------------------------------------------------
const pages = [];
const walk = (parts) => {
  for (const entry of readdirSync(join(root, ...parts), { withFileTypes: true })) {
    if (entry.isDirectory()) walk([...parts, entry.name]);
    else if (entry.name.endsWith('.jsx')) pages.push([...parts, entry.name]);
  }
};
walk(['pages']);

const studioOrderScreens = pages.filter((file) => {
  const source = read(...file);
  return source.includes('paymentStatusLabels') && /AuthenticatedLayout/.test(source);
});
assert.ok(studioOrderScreens.length >= 5,
  `expected the Studio order screens to still be findable this way, found ${studioOrderScreens.length}`);

for (const file of studioOrderScreens) {
  const source = read(...file);
  // The call must DECIDE something, not merely appear. A sabotage replaced the render's condition with
  // `{false ? (` and left the helper calls inside the dead branch; a "does it appear?" check passed while
  // the chip could never render again. So the call has to sit where a decision is made — gating a render
  // (`helper(order) ?`, `helper(order) &&`) or being read through `?.` — which is the same shape in all
  // five screens and none of them the wording of any of it.
  assert.match(source, /internationalOrderSummary\([^)]*\)\s*(?:\?|&&)/,
    `${file.join('/')} shows an order's payment state but nothing it renders DEPENDS on whether that `
    + 'order left the country — so it shows rupiah for a transfer made in dollars, and says nothing '
    + 'about an order waiting on a freight quote it cannot be paid without');
  // Reading the blob directly is how the second answer to the same question gets written.
  assert.doesNotMatch(source, /payment_?[Rr]esponse\??\.\s*(?:destinationCountry|amountUsd|shippingQuotePending)/,
    `${file.join('/')} reads the international facts straight out of payment_response instead of through `
    + 'the one helper — two readers of the same column is how they start disagreeing');
}

// --- 3. And the desktop list no longer answers with the existence of an answer -------------------------
const list = read('pages', 'OrdersPage.jsx');
const generic = list.indexOf('Respons checkout tersimpan');
assert.ok(generic > 0, 'the generic chip is still the right fallback for a DOKU response — it should exist');
const gate = list.search(/\{internationalOrderSummary\(order\) \? \(/);
assert.ok(gate > 0 && gate < generic,
  'the international facts must GATE the chip and be checked BEFORE falling back to "a response is '
  + 'stored" — otherwise an order to Berlin gets the chip that says nothing');

console.log(`studioSeesInternational selfcheck OK (${studioOrderScreens.length} Studio order screens, all `
  + 'reading the destination and the dollar figure from one rule)');
