// `node src/utils/theShopDoesNotChaseAWaybill.selfcheck.mjs`
//
// Dekito's decision, 2026-10-10, in his own words: "biar aja no resi udh aman semua itu."
//
// The data agrees with him. Not one of the 35 orders on production carries a tracking_number — 13 of
// them 'shipped', 8 'completed' — over months of trading. The parcel goes out and the buyer is answered
// on WhatsApp.
//
// The software did not agree. It chased the number in nine places:
//
//   REFUSED the write   two order lists ("Buka ordernya untuk mengisi resi"), the fulfillment bulk
//                       action, and the phone's per-row ship button
//   PROMPTED            both order detail screens, which held the buyer's WhatsApp message back until
//                       the question was answered
//   COUNTED it wrong    an ops-health figure on both dashboards, a "Butuh resi" tile on two screens,
//                       warning chips on three, and a "Butuh resi" queue on the phone's fulfillment page
//   ASKED for it        the shared task ladder's "Lengkapi nomor resi", which on this data was the only
//                       task any packed order ever showed
//
// All of it fired on every order, forever. An alarm that never stops is not an alarm, and a refusal that
// always refuses is just a broken button.
//
// The rule now: the waybill is a field he MAY fill, never a thing the shop demands. This guard holds
// both halves — nothing may chase it, and nothing may take the field away either.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx|js)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(join(root, 'pages'));
walk(join(root, 'services'));
walk(join(root, 'utils'));
assert.ok(files.length > 100, `only ${files.length} files scanned — the walk is broken, not the code`);

// ── 1. The module that answered "does this need a waybill asked for?" is gone ──────────────────────
assert.ok(!existsSync(join(root, 'utils', 'waybillPrompt.js')),
  'waybillPrompt.js is back — the shop is asking for a waybill again');
for (const file of files) {
  const source = stripComments(readFileSync(file, 'utf8'));
  assert.ok(
    !/waybillPrompt|needsWaybillPrompt|ordersMissingWaybill/.test(source),
    `${file.slice(root.length + 1)} still asks whether a waybill is missing before it will act`,
  );
}

// ── 2. Nothing REFUSES, and nothing NAGS, because the number is empty ────────────────────────────
// The subject is read from the code: every place that tests a tracking number for emptiness. Each may
// DISPLAY something, but none may complain — toast.error was the shape of all four refusals, and
// toast.warning was the shape of the two that fired on every single shipment save.
const EMPTY_TEST = /!\s*(?:String\()?(?:[A-Za-z_$][\w$]*[.?]+)*trackingNumber/g;
let emptyTests = 0;
for (const file of files) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const where = file.slice(root.length + 1);
  for (const match of source.matchAll(EMPTY_TEST)) {
    emptyTests += 1;
    const after = source.slice(match.index, match.index + 240);
    for (const complaint of ['toast.error', 'toast.warning', 'setWaybillAsk']) {
      assert.ok(
        !after.includes(complaint),
        `${where} complains (${complaint}) because the waybill is empty:\n    ${after.split('\n')[0].trim()}`,
      );
    }
  }
}
// One remains, and it is the right kind: pressing Enter in the waybill field with nothing typed does
// nothing. The anchor against a broken scan is the identifier itself, which this shop still handles in
// plenty of places — the point was never that the field disappears.
assert.ok(emptyTests >= 1, `no empty-waybill tests found at all — the scan is probably broken`);
const filesNamingIt = files.filter((file) => readFileSync(file, 'utf8').includes('trackingNumber')).length;
assert.ok(filesNamingIt >= 8, `only ${filesNamingIt} files mention a tracking number — the scan is broken, not the code`);

// And no WRITE is gated on it. Every call that moves an order looks back over what was asked first;
// all four refusals sat in exactly that space.
let writes = 0;
for (const file of files) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const where = file.slice(root.length + 1);
  for (const call of source.matchAll(/\b(updateOrderStatus|updateOrderShipment|settleBulk)\(/g)) {
    writes += 1;
    const before = source.slice(Math.max(0, call.index - 700), call.index);
    assert.ok(
      !new RegExp(EMPTY_TEST.source).test(before),
      `${where} decides whether to ${call[1]} by looking at the waybill`,
    );
  }
}
assert.ok(writes >= 6, `only ${writes} order writes found — the scan is broken, not the code`);

// ── 3. No screen carries a "Butuh resi" warning any more ──────────────────────────────────────────
for (const file of files) {
  const source = stripComments(readFileSync(file, 'utf8'));
  assert.ok(
    !/Butuh resi/.test(source),
    `${file.slice(root.length + 1)} still labels an order as needing a waybill`,
  );
}

// ── 4. The shared task ladder does not ask for one ────────────────────────────────────────────────
const workflow = stripComments(readFileSync(join(root, 'utils', 'orderWorkflow.js'), 'utf8'));
const tasks = workflow.match(/export const ORDER_TASKS = \{([\s\S]*?)\n\};/);
assert.ok(tasks, "could not find ORDER_TASKS — this guard's parse is broken, not the ladder");
// The TITLES are what the card headlines, and none of them may ask for a number. "Simpan kurir/resi"
// and "Cetak resi PDF" are helpers about things he does anyway — the printed label is also called a
// resi — so the test is the ASK, not the word.
const ASKS_FOR_A_WAYBILL = /(?:lengkapi|isi|minta|scan|paste)[^'"]{0,24}resi|nomor resi/i;
const taskTitles = [...tasks[1].matchAll(/title: '([^']+)'/g)].map((match) => match[1]);
assert.ok(taskTitles.length >= 6, `only ${taskTitles.length} task titles parsed — the parse is broken`);
for (const title of taskTitles) {
  assert.ok(
    !ASKS_FOR_A_WAYBILL.test(title),
    `the task ladder is asking for a waybill again ("${title}") — on this shop's data that is the only task a packed order would ever show`,
  );
}

// ── 5. But the field is still his to fill ─────────────────────────────────────────────────────────
// "Stop chasing it" is not "take it away". Every screen that could save a waybill before still can, so
// a number a courier does hand over has somewhere to go.
const CAN_STILL_SAVE = {
  'pages/OrderDetailPage.jsx': /trackingNumber: event\.target\.value/,
  'pages/mobile/MobileOrderDetailPage.jsx': /trackingNumber: event\.target\.value/,
  'pages/ShipmentsPage.jsx': /trackingNumber/,
  'pages/mobile/MobileFulfillmentPage.jsx': /trackingNumber/,
};
for (const [file, field] of Object.entries(CAN_STILL_SAVE)) {
  const source = readFileSync(join(root, ...file.split('/')), 'utf8');
  assert.match(source, field, `${file} no longer lets a waybill be typed in — the field stays, the nagging goes`);
}
// And the buyer's screens still show one when it exists.
assert.match(
  readFileSync(join(root, 'utils', 'trackingLead.js'), 'utf8'),
  /trackingNumber \|\| ''\)\.trim\(\) \? 'track\.shipped' : 'track\.shippedNoWaybill'/,
  'the tracking page must still name a waybill it actually has',
);

// ── 6. And no sentence tells a buyer one is coming ────────────────────────────────────────────────
// storefrontMessages owns the wording; this is the short version, so the decision is checked from the
// side of the code that implements it too.
for (const key of ['track.shippedNoWaybill', 'cust.waybillMissing', 'cust.waybillLater', 'inv.waybillMissing', 'inv.waybillLater']) {
  for (const lang of ['id', 'en']) {
    assert.doesNotMatch(
      MESSAGES[lang][key],
      /belum masuk|akan muncul|not in the system|appears once|not yet/i,
      `${lang}.${key} still promises a waybill that is not coming`,
    );
  }
}

console.log(`theShopDoesNotChaseAWaybill: ok — ${files.length} files scanned, ${emptyTests} empty-waybill tests and not one of them refuses`);
