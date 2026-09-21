// `node src/utils/invoiceShipment.selfcheck.mjs`
//
// Measured on Dekito's own invoices, 2026-09-21, opened with his customer code:
//
//   DKT-MPEBTVGS      PENGIRIMAN · Belum siap · "Sudah dikirim, resi belum masuk ke sistem"
//   DKT-MTBC51CN...   PENGIRIMAN · Belum siap · "Resi akan muncul setelah dikirim"   (EXPIRED order)
//
// The first contradicts itself between two lines of the same card. The second promises a tracking number
// for an order that was cancelled and whose stock is already back on the shelf.
//
// The cause is two readings of one question. The headline trusted shipment_status alone; the sentence
// used orderHasShipped(), which reads four fields because the three screens each trusted a different one
// (the waybill work earlier today). And neither had a word for a CLOSED order, where nothing is coming.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { invoiceShipmentState, isClosedOrder, shipmentNoteKey } from './invoiceShipment.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The two orders that reported this ----------------------------------------------------------------
const shippedOrder = { paymentStatus: 'paid', status: 'shipped', shipmentStatus: 'not_ready' };
assert.equal(invoiceShipmentState(shippedOrder), 'shipped',
  'a paid order the shop considers shipped must not be headlined "Belum siap" because one column lagged');
assert.equal(shipmentNoteKey(shippedOrder), 'inv.waybillMissing');

const expiredOrder = { status: 'cancelled', paymentStatus: 'expired', shipmentStatus: 'not_ready' };
assert.equal(invoiceShipmentState(expiredOrder), 'closed', 'a cancelled order is not "waiting" for anything');
assert.equal(shipmentNoteKey(expiredOrder), 'inv.waybillNever');

// --- 2. The states that were already right stay right -----------------------------------------------------
const waiting = { paymentStatus: 'paid', status: 'processing', shipmentStatus: 'packing' };
assert.equal(invoiceShipmentState(waiting), 'waiting', 'an order still being packed is waiting, and says so');
assert.equal(shipmentNoteKey(waiting), 'inv.waybillLater');
assert.equal(invoiceShipmentState({ deliveredAt: '2026-09-20T00:00:00Z' }), 'shipped', 'delivered has left');
assert.equal(invoiceShipmentState({}), 'waiting', 'an empty order promises nothing and claims nothing');

// Closed covers every dead payment status, not just the one that was in front of me.
for (const paymentStatus of ['expired', 'failed', 'refunded']) {
  assert.equal(isClosedOrder({ paymentStatus }), true, `${paymentStatus} is a closed order`);
}
assert.equal(isClosedOrder({ status: 'cancelled' }), true);
assert.equal(isClosedOrder({ paymentStatus: 'paid', status: 'shipped' }), false);
// A closed order that HAD shipped stays closed: the refund is the newer fact.
assert.equal(invoiceShipmentState({ status: 'cancelled', shippedAt: '2026-09-01T00:00:00Z' }), 'closed');

// --- 3. The page builds both lines from that one reading ---------------------------------------------------
const page = read('pages', 'CustomerInvoicePage.jsx');
assert.match(page, /const shipmentState = invoiceShipmentState\(order\);/,
  'the invoice must read the order once');
assert.match(page, /shipmentState === 'closed'\s*\?\s*t\('inv\.shipmentClosed'\)/,
  'the headline must say a closed order was not shipped');
assert.match(page, /t\(shipmentNoteKey\(order\)\)/, 'and the sentence must come from the same reading');
assert.doesNotMatch(page, /orderHasShipped\(order\) \? 'inv\.waybillMissing' : 'inv\.waybillLater'/,
  'the old two-readings version must not come back');
assert.match(page, /order\.trackingNumber && shipmentState !== 'closed'/,
  'and a waybill left on a cancelled order must not be offered as if the parcel were moving');
assert.match(page, /t\(shipmentState === 'closed' \? 'inv\.keepThisClosed' : 'inv\.keepThis'\)/,
  'the footer must stop promising updates that will never come');

// --- 4. In both languages ---------------------------------------------------------------------------------
for (const language of ['id', 'en']) {
  for (const key of ['inv.waybillNever', 'inv.shipmentClosed', 'inv.keepThisClosed']) {
    assert.ok(MESSAGES[language][key], `${language}.${key} is missing`);
  }
  assert.notEqual(MESSAGES[language]['inv.keepThisClosed'], MESSAGES[language]['inv.keepThis'],
    `${language}: the closed footer must not repeat the promise it exists to replace`);
}

console.log('invoiceShipment selfcheck OK (one reading of the order, and a closed one says nothing is coming)');
