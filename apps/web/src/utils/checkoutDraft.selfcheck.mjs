// `node src/utils/checkoutDraft.selfcheck.mjs`
//
// buildCheckoutDraft is the text an admin copies with "Salin" and sends to the buyer. It lays out
// paragraphs with '' and used '' for optional lines too — the same value for two opposite meanings — so
// the filter that dropped unused lines dropped every paragraph break with them and the whole draft
// arrived as one block.
//
// Runs the REAL service: its source is loaded with the '@/' imports and import.meta.env stubbed. A copy
// of the logic here would pass while the shipped builder stayed broken.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'services', 'cartService.js'), 'utf8');

const runnable = 'const STUB_ENV = {};\nconst normalizeWhatsAppPhoneNumber = (v = "") => String(v).replace(/\\D/g, "");\n'
  + source.replace(/^(?:import|export)[\s\S]*?from '[^']+';\n/gm, '').replace(/import\.meta\.env/g, 'STUB_ENV');
const { buildCheckoutDraft, buildOrderNotes } = await import(
  `data:text/javascript;base64,${Buffer.from(runnable, 'utf8').toString('base64')}`
);

const base = {
  customerName: 'Ade',
  contact: '081234567890',
  deliveryAddress: 'Jl. Melati No. 12, Bandung',
  deliveryArea: 'COBLONG, BANDUNG',
  paymentMethod: 'Transfer manual BCA',
  shippingSummary: 'JNE REG - Rp 10.000',
  shippingFee: 10000,
  items: [
    { name: 'La Rose', size: '30 ml', quantity: 1, price: 'Rp 310.000', priceNumber: 310000 },
    { name: 'La Tulipe', size: '30 ml', quantity: 2, price: 'Rp 289.000', priceNumber: 289000 },
  ],
};

// --- the draft reads as blocks, not as one paragraph -------------------------------------------------
const draft = buildCheckoutDraft(base);
assert.ok(draft.includes('\n\n'), 'the draft has no paragraph breaks at all');
assert.match(draft, /^Solivagant order draft\n\nCustomer: Ade$/m, 'the title is glued to the customer line');
assert.match(draft, /Payment: Transfer manual BCA\n\nItems:/, 'the items list is glued to the payment line');
assert.match(draft, /x2: Rp 289\.000\n\nTotal items: 3/, 'the totals are glued to the last item');

// --- an optional line that does not apply leaves no hole ---------------------------------------------
const noExtras = buildCheckoutDraft({ ...base, shippingFee: 0, shippingSummary: '' });
assert.ok(!/\n\n\n/.test(noExtras), `an omitted optional line left a gap:\n${JSON.stringify(noExtras)}`);
assert.ok(!noExtras.includes('Shipping fee:'), 'a zero shipping fee was printed anyway');
assert.ok(!noExtras.includes('Customer code:'), 'an absent customer code was printed anyway');

// --- and one that does apply is printed ---------------------------------------------------------------
const withExtras = buildCheckoutDraft({ ...base, customerCode: 'SOLI89523', voucherCode: 'HEMAT50', voucherDiscount: 50000 });
assert.match(withExtras, /^Customer code: SOLI89523$/m, 'the customer code is missing');
assert.match(withExtras, /^Voucher HEMAT50: -Rp 50\.000$/m, 'the voucher line is missing');

// --- the money in the draft has to add up -------------------------------------------------------------
// 310.000 + 2x289.000 = 888.000, less a 50.000 voucher, plus 10.000 shipping.
assert.match(withExtras, /^Subtotal: Rp 888\.000$/m, 'subtotal is wrong');
assert.match(withExtras, /^Total: Rp 848\.000$/m, 'total does not equal subtotal - discount + shipping');
// A discount larger than the subtotal must not produce a negative total.
const overDiscount = buildCheckoutDraft({ ...base, voucherCode: 'GRATIS', voucherDiscount: 9999999 });
assert.match(overDiscount, /^Total: Rp 10\.000$/m, 'an oversized voucher should floor the goods at zero, leaving shipping');
// The printed discount must be clamped too. The total is floored twice over, so only this line holds the
// clamp on the discount itself — without it the buyer is told they were given Rp 9.999.999 off an order
// of Rp 888.000.
assert.match(overDiscount, /^Voucher GRATIS: -Rp 888\.000$/m, 'the printed discount exceeds the subtotal');

// --- buildOrderNotes stays free of holes too ----------------------------------------------------------
const notes = buildOrderNotes({ deliveryAddress: 'Jl. Melati 3', deliveryArea: 'Jakarta', paymentMethod: '', shippingSummary: '', notes: '' });
assert.equal(notes.split('\n').filter((line) => !line.trim()).length, 0, `order notes carry blank lines:\n${notes}`);

console.log('checkoutDraft selfcheck OK');
