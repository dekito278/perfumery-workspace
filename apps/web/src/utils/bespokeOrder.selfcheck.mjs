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

console.log('bespokeOrder self-check OK');
