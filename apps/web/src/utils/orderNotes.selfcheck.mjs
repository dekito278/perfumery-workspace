// Runnable check for order-note parsing. `node src/utils/orderNotes.selfcheck.mjs`.
// The shipping label reads the delivery address through this — a truncated address is an undeliverable parcel.
import assert from 'node:assert/strict';
import { getOrderNoteField, parseOrderNoteRows } from './orderNotes.js';

const singleLine = [
  'Address: Jl. Melati 3 No. 12',
  'Area: Jakarta Selatan',
  'Shipping: JNE REG / Rp 20.000',
  'Payment: Transfer BCA',
  'Notes: Titip ke satpam',
].join('\n');

assert.equal(getOrderNoteField(singleLine, 'Address'), 'Jl. Melati 3 No. 12');
assert.equal(getOrderNoteField(singleLine, 'Area'), 'Jakarta Selatan');
assert.equal(getOrderNoteField(singleLine, 'Notes'), 'Titip ke satpam');
assert.equal(parseOrderNoteRows(singleLine).length, 5);

// A buyer who typed their address across several lines
const multiLine = [
  'Address: Perumahan Griya Asri Blok C2 No. 14',
  'RT 05 / RW 09, Kelurahan Cipete Utara',
  'Patokan: pagar hitam sebelah warung',
  'Area: Jakarta Selatan',
  'Shipping: SiCepat BEST / Rp 24.000',
].join('\n');

assert.equal(
  getOrderNoteField(multiLine, 'Address'),
  'Perumahan Griya Asri Blok C2 No. 14\nRT 05 / RW 09, Kelurahan Cipete Utara\nPatokan: pagar hitam sebelah warung',
);
assert.equal(getOrderNoteField(multiLine, 'Area'), 'Jakarta Selatan');
assert.equal(parseOrderNoteRows(multiLine).length, 3);

// A value containing a colon survives (the shipping summary and free-text notes both can)
assert.equal(getOrderNoteField('Shipping: JNE: REG / Rp 20.000', 'Shipping'), 'JNE: REG / Rp 20.000');

// Missing keys and empty input
assert.equal(getOrderNoteField(singleLine, 'Nope'), '');
assert.equal(getOrderNoteField('', 'Address'), '');
assert.deepEqual(parseOrderNoteRows(''), []);

console.log('orderNotes selfcheck OK');
