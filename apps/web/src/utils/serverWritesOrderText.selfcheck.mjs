// `node src/utils/serverWritesOrderText.selfcheck.mjs`
//
// Ninth visitor audit, 13 Nov 2026 (17 intercepted checkouts). api/orders/create.js re-prices every line,
// the courier rate and the voucher, charges ITS total — and then stored the browser's own notes and
// "order draft" text as they arrived, subtotal, shipping fee and total included. Studio shows that draft
// and the "Salin" button copies it to the buyer. Whenever the browser's figures and the server's differed
// (a courier rate that moved between quote and submit, a crafted request), staff read and sent a total
// nobody was charged. The item lines were also stored with the cart's own bookkeeping on them.
//
// The rule: on a cart order, the stored notes and draft are written by the server from what it charges;
// the buyer's own note is the only text taken from the request. The layout stays the one the browser
// writes, because Studio's parser and staff's habits both read it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildServerOrderText, buyerNoteFrom, paymentLabelFor } from './orderText.js';
import { parseOrderNoteRows } from './orderNotes.js';

const here = dirname(fileURLToPath(import.meta.url));
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// --- 1. Same layout as the browser's builder, with the server's numbers --------------------------------
const cartSource = readFileSync(join(here, '..', 'services', 'cartService.js'), 'utf8');
const freeVialUrl = new URL('./freeVial.js', import.meta.url).href;
const runnable = `import { isFreeVialLine } from '${freeVialUrl}';\n`
  + 'const STUB_ENV = {};\nconst normalizeWhatsAppPhoneNumber = (v = "") => String(v).replace(/\\D/g, "");\n'
  + cartSource.replace(/^(?:import|export)[\s\S]*?from '[^']+';\n/gm, '').replace(/import\.meta\.env/g, 'STUB_ENV');
const { buildCheckoutDraft, buildOrderNotes } = await import(
  `data:text/javascript;base64,${Buffer.from(runnable, 'utf8').toString('base64')}`
);

const lines = [
  { name: "L'iris", size: '30 ml', quantity: 2, price: 'Rp 279.000', priceNumber: 279000 },
  { name: 'Wongka', size: '50 ml', quantity: 1, price: 'Rp 389.000', priceNumber: 389000 },
];
const note = 'Tolong bungkus kado.\nJangan sebut harga.';
const client = {
  customerName: 'Ade', customerCode: 'SOLI00012', contact: '081234567890',
  deliveryAddress: 'Jl. Melati 3\nRT 02', deliveryArea: 'Kebayoran Baru, Jakarta Selatan',
  paymentMethod: 'Transfer manual BCA', shippingSummary: 'JNE REG', shippingFee: 18000,
  voucherCode: 'HALO', voucherDiscount: 50000, notes: note, items: lines,
};
const server = buildServerOrderText({
  customerName: 'Ade', customerCode: 'SOLI00012', contact: '081234567890',
  address: 'Jl. Melati 3\nRT 02', area: 'Kebayoran Baru, Jakarta Selatan', shippingSummary: 'JNE REG',
  paymentProvider: 'manual_transfer_bca', lines, itemsSubtotal: 947000, voucherCode: 'HALO',
  voucherDiscount: 50000, shippingFee: 18000, total: 915000, buyerNote: note,
});
assert.equal(server.checkoutDraft, buildCheckoutDraft(client), 'the server draft drifted from the layout the browser writes');
assert.equal(server.notes, buildOrderNotes({ ...client, notes: note }), 'the server notes drifted from the browser layout');
assert.deepEqual(parseOrderNoteRows(server.notes).map((row) => row.label), ['Address', 'Area', 'Shipping', 'Payment', 'Notes'],
  "Studio's notes parser no longer reads the server's notes");

// The server's figures win: a different shipping fee is what the draft says, whatever the browser thought.
const moved = buildServerOrderText({ lines, itemsSubtotal: 947000, shippingFee: 22000, total: 969000, paymentProvider: 'doku' });
assert.match(moved.checkoutDraft, /^Shipping fee: Rp 22\.000$/m);
assert.match(moved.checkoutDraft, /^Total: Rp 969\.000$/m);
assert.match(moved.checkoutDraft, /^Payment: DOKU Checkout$/m);
assert.equal(paymentLabelFor('doku-qris'), 'QRIS');
assert.equal(paymentLabelFor('manual_transfer_usd'), 'International transfer (USD)');

// --- 2. The buyer's own note: the field, or what an older tab put after "Notes:" ------------------------
assert.equal(buyerNoteFrom({ buyerNote: '  bungkus kado  ', notes: 'Notes: lain' }), 'bungkus kado');
assert.equal(buyerNoteFrom({ notes: buildOrderNotes({ ...client, notes: note }) }), note,
  'a multi-line note from an older tab lost its second line');
assert.equal(buyerNoteFrom({ notes: 'Notes: hanya catatan' }), 'hanya catatan');
assert.equal(buyerNoteFrom({ notes: 'Address: Jl. Melati\nPayment: QRIS' }), '', 'no note must stay no note');
assert.equal(buyerNoteFrom({}), '');
assert.equal(buyerNoteFrom({ buyerNote: 'x'.repeat(5000) }).length, 1000);

// --- 3. The endpoint uses it, and no longer stores the browser's text on a cart order -------------------
const endpoint = stripComments(readFileSync(join(here, '..', '..', 'api', 'orders', 'create.js'), 'utf8'));
assert.match(endpoint, /import \{ buildServerOrderText, buyerNoteFrom \} from '\.\.\/\.\.\/src\/utils\/orderText\.js';/);
assert.match(endpoint, /notes: isBespoke \? buildBespokeNotes\(briefRequest\) : catalogText\.notes,/);
assert.match(endpoint, /checkout_draft: isBespoke \? buildBespokeCheckoutDraft\(briefRequest\) : catalogText\.checkoutDraft,/);
assert.ok(!/notes: [^\n]*\(input\.notes \|\| ''\)/.test(endpoint), "a cart order's notes are the browser's text again");
assert.ok(!/checkout_draft: [^\n]*input\.checkoutDraft/.test(endpoint), "a cart order's draft is the browser's text again");
assert.match(endpoint, /total: subtotal,/, 'the draft total must be the total the order is charged');
// The cart's bookkeeping stays in the cart.
assert.match(endpoint, /const \{ previousPriceNumber: _previous, priceChanged: _changed, maxStock: _max, \.\.\.display \} = line;/);
assert.match(endpoint, /resolved\.push\(\{ \.\.\.display,/, 'item lines are stored with the client line spread in whole again');

// The browser sends the note on its own.
const service = stripComments(readFileSync(join(here, '..', 'services', 'orderService.js'), 'utf8'));
assert.match(service, /buyerNote: orderData\.buyerNote \|\| '',/);
const flow = stripComments(readFileSync(join(here, '..', 'hooks', 'useCheckoutFlow.js'), 'utf8'));
assert.match(flow, /buyerNote: notes,/);

console.log('serverWritesOrderText selfcheck OK (a cart order stores the server\'s own figures; only the buyer\'s note comes from the browser)');
