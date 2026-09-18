// `node src/utils/exportOrder.selfcheck.mjs`
//
// The English shop has no checkout, so an international sale is agreed on WhatsApp and written down in
// Studio. Three things the domestic checkout would get wrong have to be right here, and all three are
// silent when they are wrong: the overseas price instead of the Indonesian one, shipping that was
// quoted by hand, and the shop the order belongs to — which is the only reason the buyer's messages
// come out in English afterwards.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildExportOrderData } from './exportOrder.js';
import { buildExportQuote } from './exportQuote.js';
import { sanitizeClientContext } from './clientContext.js';

const here = dirname(fileURLToPath(import.meta.url));
const money = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value) || 0)}`;

const line = (over = {}) => ({
  product: { slug: 'la-tulipe', name: 'La Tulipe', priceNumber: 260000 },
  variant: { id: 'v30', size: '30 ml', priceNumber: 260000 },
  name: 'La Tulipe',
  size: '30 ml',
  quantity: 2,
  unitPrice: 1020000,
  overseasPriceSet: true,
  ...over,
});

const filled = {
  customerName: 'Aiko',
  contact: '+81 90 1234 5678',
  deliveryAddress: '1-2-3 Shibuya, Tokyo 150-0002, Japan',
  destinationName: 'Jepang',
  formatMoney: money,
};

// --- 1. It refuses for a NAMED reason, never silently --------------------------------------------------
// Each refusal is shown to Dekito, so it has to say which field is missing rather than "invalid".
const refusals = [
  [{ ...filled, lines: [] }, /produk/i],
  [{ ...filled, lines: [line({ quantity: 0 })] }, /produk/i],
  [{ ...filled, lines: [line()], customerName: '  ' }, /nama/i],
  [{ ...filled, lines: [line()], contact: '' }, /kontak/i],
  [{ ...filled, lines: [line()], deliveryAddress: '' }, /alamat/i],
];
for (const [input, expected] of refusals) {
  const result = buildExportOrderData(input);
  assert.equal(result.ok, false, `accepted an order it should have refused: ${JSON.stringify(Object.keys(input))}`);
  assert.equal(result.orderData, null, 'a refused order still handed back data to insert');
  assert.match(result.reason, expected, `the refusal does not say what is missing: ${result.reason}`);
}

// --- 2. The buyer is charged the OVERSEAS price -------------------------------------------------------
// The whole reason the overseas tier exists. A line at 260000 here is the Indonesian price reaching an
// international order, which is the mistake this tool was built to stop making by hand.
const order = buildExportOrderData({ ...filled, lines: [line()], shippingTotal: 450000 }).orderData;
assert.equal(order.items[0].priceNumber, 1020000, 'the order was priced at the domestic rate');
assert.equal(order.items[0].quantity, 2);
assert.equal(order.quantity, 2);
assert.equal(order.productsSubtotal, 2040000);

// --- 3. The order bills exactly what the quote promised ------------------------------------------------
// Two separate builders, one number. Dekito sends the quote on WhatsApp and then writes the order down;
// if they ever disagree, the buyer agreed to one figure and is charged another — and nobody would see
// it until the invoice.
const lines = [line(), line({ name: 'Wayback', product: { slug: 'wayback', name: 'Wayback', priceNumber: 300000 }, quantity: 1, unitPrice: 1190000 })];
const shipping = { total: 512000, chargeableKg: 2 };
const quote = buildExportQuote({ destinationName: 'Jepang', lines, shipping, formatMoney: money });
const billed = buildExportOrderData({ ...filled, lines, shippingTotal: shipping.total }).orderData;
assert.equal(billed.subtotal, quote.total,
  `the order bills ${billed.subtotal} while the quote promised ${quote.total}`);
assert.equal(billed.subtotal, billed.productsSubtotal + billed.shippingFee,
  'the order total is not its own parts added up');

// Shipping is part of what is owed. Studio reads `subtotal` as the order total everywhere, so leaving
// it out would under-bill by the one number this whole page exists to compute.
const unshipped = buildExportOrderData({ ...filled, lines: [line()], shippingTotal: 0 }).orderData;
assert.equal(unshipped.subtotal, 2040000, 'shipping of zero changed the product total');
assert.equal(billed.subtotal - shipping.total, billed.productsSubtotal);

// --- 4. The order says which shop it came from, and that value survives the whitelist ------------------
assert.deepEqual(order.clientContext, { shop: 'en' });
assert.deepEqual(sanitizeClientContext(order.clientContext), { shop: 'en' },
  'the shop is dropped on the way to the database, so every message to this buyer goes out in Indonesian');

// And the insert path actually writes it. This is the join between the two halves: the builder can mark
// the order perfectly while buildOrderPayload quietly throws the field away, which is what it did before.
const orderService = readFileSync(join(here, '..', 'services', 'orderService.js'), 'utf8');
assert.match(orderService, /client_context: sanitizeClientContext\(clientContext\)/,
  'buildOrderPayload does not write client_context, so nothing marked here reaches the database');

// --- 5. A domestic-priced line is named, not swallowed — and not refused either ------------------------
// Dekito is allowed to sell at whatever price he agreed to. He is not allowed to do it by accident.
const mixed = buildExportOrderData({
  ...filled,
  lines: [line(), line({ name: 'Sudra', product: { slug: 'sudra', name: 'Sudra' }, overseasPriceSet: false, unitPrice: 240000 })],
  shippingTotal: 100000,
});
assert.equal(mixed.ok, true, 'a domestic-priced line must be a warning, not a refusal');
assert.deepEqual(mixed.warnings, ['Sudra']);
assert.ok(mixed.orderData.notesLines.some((row) => row.includes('Sudra')),
  'the order does not record that a domestic price was charged, so nobody will ever know');
assert.deepEqual(buildExportOrderData({ ...filled, lines: [line()], shippingTotal: 1 }).warnings, [],
  'a fully overseas-priced order must warn about nothing');

console.log('exportOrder selfcheck OK (an order written from an export quote bills the overseas price plus the quoted shipping, exactly what the quote promised, and is marked as the English shop all the way into the insert)');
