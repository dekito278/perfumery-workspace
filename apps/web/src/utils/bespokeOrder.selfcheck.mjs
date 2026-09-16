// Runnable check for the shared bespoke builders. `node src/utils/bespokeOrder.selfcheck.mjs`.
// Guards the invariants the shipping label + admin brief depend on after the extraction refactor.
import assert from 'node:assert/strict';
import { buildBespokeItem, buildBespokeNotes, buildBespokeCheckoutDraft, cheapestEnabled } from './bespokeOrder.js';
import { parseOrderNoteRows } from './orderNotes.js';
import { readFileSync } from 'node:fs';

const req = {
  perfumeName: 'Rain Letter',
  scentDescription: 'Woody, hujan pertama',
  occasion: 'Daily',
  size: '30 ml', bottleType: 'Square premium bottle', capDesign: 'Cap batu', labelDesign: 'Minimal label',
  exoticMaterial: '', optionIds: { size: '30-ml', bottleType: 'square-premium' },
  deliveryAddress: 'Jl. Melati 3', deliveryArea: 'Jakarta Selatan',
  shippingSummary: 'JNE REG / Rp 20.000', shippingFee: 20000,
  itemPrice: 545000, totalPrice: 565000, preorderAcknowledged: true,
};

const item = buildBespokeItem(req);
assert.equal(item.type, 'bespoke_request');
assert.equal(item.name, 'Bespoke perfume: Rain Letter');
assert.equal(item.perfumeName, 'Rain Letter');           // admin brief reads this
assert.equal(item.priceNumber, 545000);
assert.deepEqual(item.optionIds, { size: '30-ml', bottleType: 'square-premium' });

const notes = buildBespokeNotes(req);
// The shipping-label PDF parses these exact prefixes — they must survive the refactor.
assert.match(notes, /^Address: Jl\. Melati 3$/m);
assert.match(notes, /^Area: Jakarta Selatan$/m);
assert.match(notes, /^Shipping: JNE REG \/ Rp 20\.000$/m);

const draft = buildBespokeCheckoutDraft(req);
assert.match(draft, /^Solivagant Bespoke Request$/m);
assert.match(draft, /^Perfume name: Rain Letter$/m);
assert.equal(buildBespokeCheckoutDraft({}).includes('Customer code'), false); // omitted when blank

// A pasted, multi-paragraph brief must come back as ONE 'Preferred aroma' row, and every other label as
// its own row — the parser used to know only the cart labels, so 'Area' swallowed the whole brief.
const aroma = 'TOP NOTES — FRESH\n* Kumquat — **dominant**\n* Bergamot\nHEART NOTES — GREEN\n* Jasmine';
const rows = parseOrderNoteRows(buildBespokeNotes({ ...req, scentDescription: aroma }));
const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
assert.equal(byLabel['Preferred aroma'], aroma);
assert.equal(byLabel.Area, 'Jakarta Selatan');
assert.equal(byLabel['Perfume name'], 'Rain Letter');
assert.equal(byLabel['Shipping fee'], 'Rp 20.000');
const labelsEmitted = buildBespokeNotes(req).split('\n').filter(Boolean).map((line) => line.split(':')[0]);
assert.deepEqual(rows.map((row) => row.label), labelsEmitted, 'every label buildBespokeNotes emits must be a parser key');

// A brief for an order without a voucher must not carry blank lines. Four of the rows are conditional
// and yielded '' when absent; joined unfiltered they opened a hole between the shipping fee and the
// total, which reads as a formatting fault rather than an absence.
const noVoucher = buildBespokeNotes({
  deliveryAddress: 'Jl. Melati 3', deliveryArea: 'Jakarta Selatan', perfumeName: 'Hujan Sore',
  scentDescription: 'Aroma hujan di tanah kering.', shippingSummary: 'JNE REG - Rp 10.000',
  shippingFee: 10000, totalPrice: 400000,
});
assert.equal(
  noVoucher.split('\n').filter((line) => line.trim() === '').length,
  0,
  `a brief without a voucher still has blank lines:\n${noVoucher}`,
);
// Every surviving row must still be a `Label: value` line — the shipping-label PDF and orderTotals read
// Address, Area and Shipping straight back out of this text.
for (const line of noVoucher.split('\n')) {
  assert.match(line, /^[A-Z][A-Za-z -]+: .+$/, `not a parseable row: ${JSON.stringify(line)}`);
}
assert.match(noVoucher, /^Shipping fee: Rp 10\.000\nEstimated total: Rp 400\.000$/m, 'the hole between fee and total is back');

// Fields the customer left blank are named once instead of costing a "Label: -" row each.
const sparse = buildBespokeNotes({
  deliveryAddress: 'Jl. Melati 3', deliveryArea: 'Jakarta Selatan', perfumeName: 'Hujan Sore',
  scentDescription: 'Aroma hujan di tanah kering.', shippingSummary: 'JNE REG - Rp 10.000',
  shippingFee: 10000, totalPrice: 400000,
});
assert.equal(sparse.split('\n').filter((line) => line.trim().endsWith(': -')).length, 0, `placeholder rows are back:\n${sparse}`);
assert.match(sparse, /^Tidak diisi: .+$/m, 'the blank fields are not named anywhere');
assert.match(sparse, /Tidak diisi:.*\bMood\b/, 'Mood was blank but is not listed');
// Voucher, fee and total are absent because the order had none — nobody declined to answer them.
assert.doesNotMatch(sparse, /Tidak diisi:.*Voucher/, 'an absent voucher is not an unanswered question');

// The summary must survive the parser as its own row. An unregistered label would be glued onto the
// previous value, which is how Area once carried an entire aroma brief.
const sparseRows = parseOrderNoteRows(sparse);
const summaryRow = sparseRows.find((row) => row.label === 'Tidak diisi');
assert.ok(summaryRow, 'Tidak diisi did not parse as its own row — is it in ORDER_NOTE_KEYS?');
assert.ok(summaryRow.value.includes('Story'), 'the summary lost its content in parsing');
assert.equal(sparseRows.find((row) => row.label === 'Pre-order acknowledgement')?.value.includes('Tidak diisi'), false, 'the summary was glued onto the row above it');

// A brief with nothing missing must not carry the line at all.
const complete = buildBespokeNotes({
  deliveryAddress: 'Jl. Melati 3', deliveryArea: 'Jakarta Selatan', perfumeName: 'Hujan Sore',
  mood: 'Tenang', occasion: 'Hadiah', budget: 'Rp 500.000', size: '50 ml', scentDescription: 'Hujan.',
  avoidedNotes: 'Vanila', story: 'Untuk ibu.', bottleType: 'Classic', capDesign: 'Basic',
  labelDesign: 'Tulis tangan', exoticMaterial: 'Oud', shippingSummary: 'JNE REG', shippingFee: 10000,
  totalPrice: 400000, preorderAcknowledged: true, referenceProductName: 'La Rose',
});
assert.doesNotMatch(complete, /Tidak diisi/, 'a complete brief should not mention missing fields');

// --- A default nobody chose must never be the expensive one ------------------------------------------
//
// The bespoke configurator pre-selects one option per group. It used to take whichever came FIRST, and
// first means sort_order, and sort_order is DISPLAY order — which option Dekito wants seen first, a
// different question from what someone should be charged for a decision they never made.
//
// Three groups agreed by luck. The cap group did not: "Cap custom Abstrak" (Rp 50.000) is shown first
// and "Cap Basic" (Rp 5.000) second, so a buyer who never opened the Cap tab paid Rp 45.000 extra. No
// option on that screen shows its price, so there was nothing to notice — measured on production, the
// subtotal simply started at Rp 300.000 instead of Rp 255.000.
{
  const page = readFileSync(new URL('../pages/BespokePage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /firstEnabled/,
    'no group may fall back to "whichever is listed first"');
  // Every group, not just the one that was wrong. Checking only for the old helper's name let a
  // sabotage past that simply wrote capDesignOptions[0] instead — same bug, different spelling.
  const defaults = [...page.matchAll(/const (default[A-Z]\w*) = ([^;]+);/g)];
  assert.ok(defaults.length >= 4, `the scan must find the group defaults, found ${defaults.length}`);
  for (const [, name, expression] of defaults) {
    assert.match(expression.trim(), /^cheapestEnabled\(/,
      `${name} is set to \`${expression.trim()}\` — every group default must come from cheapestEnabled, `
      + 'or that group silently pre-buys whatever happens to be listed first');
  }

  const caps = [
    { label: 'Cap custom Abstrak', price: 50000, enabled: true },
    { label: 'Cap Basic', price: 5000, enabled: true },
  ];
  assert.equal(cheapestEnabled(caps).label, 'Cap Basic', 'the untouched cap is the cheap one');

  // Ties keep display order, so a group where everything is free starts where it always did.
  const labels = [
    { label: 'Tulis tangan', price: 0, enabled: true },
    { label: 'Custom name label', price: 75000, enabled: true },
    { label: 'None', price: 0, enabled: true },
  ];
  assert.equal(cheapestEnabled(labels).label, 'Tulis tangan', 'a tie at zero keeps the order Dekito set');

  // A disabled option is not on offer, however cheap.
  assert.equal(
    cheapestEnabled([
      { label: 'Retired', price: 1, enabled: false },
      { label: 'Live', price: 99000, enabled: true },
    ]).label,
    'Live',
    'a disabled option cannot become the default by being cheap',
  );
  assert.deepEqual(cheapestEnabled([]), {}, 'an empty group is not a crash');
}

console.log('bespokeOrder self-check OK');
