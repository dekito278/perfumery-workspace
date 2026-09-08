// `node src/utils/mobileParityFixes.selfcheck.mjs`
//
// Several screens exist twice, desktop and mobile, and a fix keeps landing on one copy only. Three found
// so far: the storefront image transform, the money inputs, and the batch load. These are two more, both
// fixed on desktop years-of-audits ago and still broken on the phone until now.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { fromDatetimeLocal, toDatetimeLocal } from './datetimeLocalInput.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(srcRoot, rel), 'utf8');

// --- 1. The timestamp helpers must round-trip -------------------------------------------------------
// The mobile order page read a stored UTC timestamp with `.slice(0, 16)` and wrote it back through
// `new Date(...)`. That hands <input type="datetime-local"> the UTC clock reading as if it were local, so
// a shipment recorded at 10:00 WIB showed as 03:00 and saving stored 03:00 WIB. Every save shifted it
// again: three edits moved it to the previous day.
const stored = '2026-09-08T03:00:00.000Z';
let roundTripped = stored;
for (let i = 0; i < 3; i += 1) {
  roundTripped = fromDatetimeLocal(toDatetimeLocal(roundTripped));
}
assert.equal(roundTripped, stored, 'saving an unchanged shipment time must not move it, however many times');
assert.equal(toDatetimeLocal(stored), '2026-09-08T10:00', 'the input must show the local wall clock, not the UTC one');
assert.equal(toDatetimeLocal(''), '', 'an empty timestamp stays empty');
assert.equal(toDatetimeLocal('not a date'), '', 'an unparseable timestamp must not render "Invalid Date"');
assert.equal(fromDatetimeLocal(''), '', 'an empty input stays empty');

// The broken read is what this replaces; make sure nobody reintroduces it.
const naive = (value) => (value ? value.slice(0, 16) : '');
assert.notEqual(naive(stored), toDatetimeLocal(stored), 'this check is meaningless if the two agree');

// --- 2. No page may feed a datetime-local draft from a sliced ISO string -----------------------------
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) files.push(full);
  }
};
walk(srcRoot);

const offenders = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('type="datetime-local"')) continue;
  for (const match of source.matchAll(/(\w*(?:At|Date))\s*:\s*[^,\n]*\.slice\(0,\s*16\)/g)) {
    offenders.push(`${relative(srcRoot, file)}: ${match[0].trim()}`);
  }
}
assert.deepEqual(offenders, [], 'slicing a stored UTC timestamp into a datetime-local input shifts it by the '
  + `local offset on every save:\n  ${offenders.join('\n  ')}\n  Use toDatetimeLocal / fromDatetimeLocal.`);

for (const page of ['pages/OrderDetailPage.jsx', 'pages/mobile/MobileOrderDetailPage.jsx']) {
  assert.match(read(page), /toDatetimeLocal\(/, `${page} must read shipment times through the shared helper`);
  assert.match(read(page), /fromDatetimeLocal\(/, `${page} must write shipment times through the shared helper`);
}

// --- 3. Both formula composers must protect work in progress ----------------------------------------
for (const page of ['pages/CreateFormulaPage.jsx', 'pages/mobile/MobileCreateFormulaPage.jsx']) {
  const source = read(page);
  assert.match(source, /hasUnsavedComposition/, `${page} must know whether the composition is unsaved`);
  assert.match(source, /hasUnsavedComposition && !window\.confirm\(/,
    `${page} must ask before discarding a composition in progress`);
}

// --- 4. The journal list must survive its decoration, and must not call a failure "nothing written" ---
// Both journal pages fetch posts and formulas in one Promise.all. The formula name is decoration on a
// post; a failed formulas query used to reject the pair and take the journal list with it — the same
// shape audit round 8 fixed for the formula list's own metrics.
for (const page of ['pages/JournalPage.jsx', 'pages/mobile/MobileJournalPage.jsx']) {
  assert.match(read(page), /getFormulas\(\)\.catch\(/,
    `${page} must let a failed formulas query fall back to [], not take the journal list down with it`);
}

// The mobile empty state said "Mulai tulis Journal" after a failed load — telling the owner they have
// written nothing, when in fact nothing could be read.
const mobileJournal = read('pages/mobile/MobileJournalPage.jsx');
assert.match(mobileJournal, /setLoadError\(/, 'MobileJournalPage must record that the load failed');
assert.match(mobileJournal, /loadError \? 'Journal belum bisa dimuat'/,
    'MobileJournalPage must say the list failed to load instead of inviting the owner to start writing');

// --- 5. A percent voucher above 100 must not be storable ---------------------------------------------
// The storefront caps the discount at 100 when applying, so a stored 150 only shows the owner a number
// the checkout will never honour.
for (const page of ['pages/VoucherManagementPage.jsx', 'pages/mobile/MobileVoucherManagementPage.jsx']) {
  assert.match(read(page), /PERCENT\s*\n?\s*\?\s*Math\.min\(|Math\.min\(rawDiscountValue, 100\)/,
    `${page} must clamp a percent voucher to 100 before saving`);
}

console.log('mobileParityFixes selfcheck OK (5 fixes held on both the desktop and the mobile copy)');
