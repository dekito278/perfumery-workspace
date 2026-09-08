// Runnable check for the shared bespoke builders. `node src/utils/bespokeOrder.selfcheck.mjs`.
// Guards the invariants the shipping label + admin brief depend on after the extraction refactor.
import assert from 'node:assert/strict';
import { buildBespokeItem, buildBespokeNotes, buildBespokeCheckoutDraft } from './bespokeOrder.js';
import { parseOrderNoteRows } from './orderNotes.js';

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

console.log('bespokeOrder self-check OK');
