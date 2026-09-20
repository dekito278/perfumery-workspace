// `node src/utils/waybillPrompt.selfcheck.mjs`
//
// A buyer who has paid must be able to find out something about their parcel.
//
// Measured on production through storefront_public_tracking_lookup — the RPC a buyer's own browser calls
// — before this landed: 11 of 11 shipped orders had tracking_number null, and 11 of 11 had courier_name
// null. So the tracking page said "belum tersedia" twice, and the WhatsApp template, whose courier,
// waybill and link lines are each conditional, collapsed to one sentence: "Order DKT-… sudah dikirim."
//
// The field was never missing. It sat in "Pengiriman & fulfillment" behind its own save button — a
// second gesture, in a second place, for the same event — and was skipped eleven times running.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { needsWaybillPrompt } from './waybillPrompt.js';

const here = dirname(fileURLToPath(import.meta.url));
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => strip(readFileSync(join(here, '..', ...parts), 'utf8'));

// --- 1. The rule itself, as behaviour ----------------------------------------------------------------
assert.equal(needsWaybillPrompt({ trackingNumber: '' }, 'shipped'), true, 'shipped with no waybill asks');
for (const blank of [null, undefined, '', '   ', '\t']) {
  assert.equal(needsWaybillPrompt({ trackingNumber: blank }, 'shipped'), true,
    `${JSON.stringify(blank)} is not a waybill — it is an empty field typed by hand`);
}
assert.equal(needsWaybillPrompt({ trackingNumber: 'JNE0099887766' }, 'shipped'), false,
  'an order that already carries a waybill must not be asked again');
for (const other of ['paid', 'processing', 'completed', 'cancelled', 'pending_payment']) {
  assert.equal(needsWaybillPrompt({ trackingNumber: '' }, other), false,
    `${other} is not the moment the number is in hand`);
}
assert.equal(needsWaybillPrompt(null, 'shipped'), true, 'a missing order still needs the question');

// --- 2. BOTH order screens ask, and both use the one rule --------------------------------------------
// There are two of these pages and they have drifted apart before — the phone one could read the payment
// status but never change it (round 7). The phone is the surface Dekito actually works from.
for (const [name, file] of [
  ['desktop', ['pages', 'OrderDetailPage.jsx']],
  ['phone', ['pages', 'mobile', 'MobileOrderDetailPage.jsx']],
]) {
  const source = read(...file);
  assert.match(source, /needsWaybillPrompt\(/,
    `the ${name} order screen decides for itself whether to ask — there must be one rule, not two`);
  assert.match(source, /setWaybillAsk\(/, `the ${name} order screen never opens the question`);
  // Saved through the SAME call the shipment form uses, so a waybill has one way in.
  const answer = source.slice(source.indexOf('const answerWaybill'), source.indexOf('const answerWaybill') + 1200);
  assert.match(answer, /updateOrderShipment\(/,
    `the ${name} screen saves the waybill by some other path than the shipment form`);
  assert.match(answer, /trackingNumber: waybill/, `the ${name} screen must save the number it was given`);
  // Skipping has to be possible: the parcel is out, the number may genuinely not exist yet.
  assert.match(source, /answerWaybill\(''\)/, `the ${name} screen offers no way to say the number is not known`);
}

// --- 3. The buyer's message waits for the answer -----------------------------------------------------
// The desktop screen prepares the WhatsApp draft on the status change. Preparing it before the waybill
// is typed hands Dekito a message missing the very number he is about to enter.
{
  const desktop = read('pages', 'OrderDetailPage.jsx');
  const updateStatus = desktop.slice(desktop.indexOf('const updateStatus'), desktop.indexOf('const updatePayment'));
  assert.match(updateStatus, /if \(missingWaybill\) \{[\s\S]*?setWaybillAsk\(current\);[\s\S]*?\} else if/,
    'the draft must be deferred while the question is open, not prepared alongside it');
  const branch = updateStatus.slice(updateStatus.indexOf('if (missingWaybill)'), updateStatus.indexOf('} else if'));
  assert.doesNotMatch(branch, /prepareCustomerNotification/,
    'the deferred branch prepares the message anyway — it would go out without the waybill');
  // And answering, either way, must still produce one: a buyer left with no message at all is worse.
  const answer = desktop.slice(desktop.indexOf('const answerWaybill'), desktop.indexOf('const saveInternalNotes'));
  assert.equal((answer.match(/prepareCustomerNotification/g) || []).length, 2,
    'both answers — a number and "belum ada" — must end with the buyer being written to');
}

// --- 4. The OTHER gesture — the one he actually uses --------------------------------------------------
//
// updateOrderStatus writes status and status_timeline. It never touches shipment_status. So the 10 of 11
// orders carrying shipment_status 'shipped' were saved through the shipment FORM — the one with the
// waybill field sitting directly beside the status select. The field was never hidden; it was skipped
// with it in plain view.
//
// A prompt cannot fix that, and nagging is not wanted. What was missing is the CONSEQUENCE: saving
// succeeded silently, so nothing ever said what the buyer would be left with. Said once, at the save,
// in the buyer's terms.
for (const [name, file] of [
  ['desktop', ['pages', 'OrderDetailPage.jsx']],
  ['phone', ['pages', 'mobile', 'MobileOrderDetailPage.jsx']],
]) {
  const source = read(...file);
  const save = source.slice(source.indexOf('const saveShipment'), source.indexOf('const saveShipment') + 1600);
  assert.match(save, /shipmentStatus === 'shipped' && !String\(shipmentDraft\.trackingNumber \|\| ''\)\.trim\(\)/,
    `${name}: saving a shipment as shipped with a blank waybill must not pass silently`);
  assert.match(save, /toast\.warning\('Tersimpan tanpa resi'/,
    `${name}: the save must say what happened, not report plain success`);
  assert.match(save, /halaman lacak/,
    `${name}: the warning has to name what the BUYER sees, not scold the admin`);
  // Still saved. This is a sentence, not a block: the parcel is out either way.
  assert.doesNotMatch(save, /return;\s*\}\s*toast\.warning/,
    `${name}: the warning must never stop the shipment from saving`);
}

console.log('waybillPrompt selfcheck OK (both order screens ask for the waybill where the number is in hand, and the buyer is written to either way)');
