// `node src/utils/indicativeRateNeverBills.selfcheck.mjs`
//
// This shop keeps two dollar rates on purpose, and their own comments say why:
//
//   USD_PER_RUPIAH_RATE (overseasVisitor.js) — "One constant, and it goes stale. It is deliberately only
//   ever shown with the word 'approx' beside it… drifting a few percent misleads nobody."
//
//   USD_PRICE_RATE (usdPrice.js) — "This one decides what a buyer is asked to send, so it moves only
//   when Dekito moves it."
//
// The export quote screen used the first one to price freight. Not to caption it — to price it. The
// shipping rate card is written in dollars, that line converted it to rupiah, the rupiah became the
// order's shipping fee, it entered the subtotal, and usdPriceFor converted the subtotal back to dollars
// at the OTHER rate. Freight left the card in dollars and came back a different number of dollars, and
// the size of the difference was whatever gap the market had opened since the approximate rate was last
// touched.
//
// Today both constants read 16500, so nothing is wrong on screen and no guard that compares outputs
// would have found anything. The defect is that the screen was one edit away from being wrong, and the
// edit it was waiting for is the one its own comment invites: correcting the approximate rate toward the
// market. It even said so out loud — the caption read "kurs 16.500, 2026-09-15" while the dollars on the
// order were figured at the rate set on 2026-09-24.
//
// The rule: a rate documented as indicative may not reach a figure anyone is billed. Both sides derived
// from disk — the screens that write orders, and the screens that touch the indicative rate — so the
// check is that those two sets do not intersect, not that this one page was tidied up.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { USD_PER_RUPIAH_RATE } from './overseasVisitor.js';
import { USD_PRICE_RATE } from './usdPrice.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const root = join(src, '..');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(join(root, 'src'));
walk(join(root, 'api'));

const read = (file) => readFileSync(file, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// --- 1. The indicative rate still exists to be misused ---------------------------------------------------
// It is currently imported by nothing — removing it from the export screen left it with no callers at
// all, which is the safest state a tempting constant can be in and not one to rely on. The day someone
// reaches for "the dollar rate" and autocomplete offers this one, section 2 is what stops it. If it is
// ever deleted outright, delete this guard with it rather than leaving it passing over nothing.
const indicative = files.filter((file) => /USD_PER_RUPIAH_RATE|approximateUsd/.test(read(file)));
assert.deepEqual(indicative.map((file) => file.slice(root.length + 1)), ['src/utils/overseasVisitor.js'],
  'the indicative rate has either been retired or picked up by a new caller; both are worth reading this '
  + `guard over: ${indicative.map((file) => file.slice(root.length + 1)).join(', ')}`);

// --- 2. Nothing that writes an order touches it ----------------------------------------------------------
// "Writes an order" is read off disk: a file that calls createOrder or PATCHes an order total is a file
// whose numbers are billed. The export quote screen was in both sets, which is how it was found.
const bills = files.filter((file) => /\bcreateOrder\(|\bsendInternationalShippingQuote\b/.test(read(file)));
assert.ok(bills.length >= 2,
  `expected to find the screens that write orders, found ${bills.length} — the scan is broken, not the code`);

const both = bills.filter((file) => indicative.includes(file)).map((file) => file.slice(root.length + 1));
assert.deepEqual(both, [],
  'a screen that writes orders prices something with the rate documented as indicative — the one whose '
  + 'own comment says it may drift toward the market at any time. Whatever it touches is billed, and it '
  + `will be wrong the day that rate is corrected: ${both.join(', ')}`);

// --- 3. And the difference is currently invisible, which is exactly why this is a rule and not a test ----
// Stated as an assertion so that the day the rates part, the message below is what explains the failure
// above rather than a surprise.
assert.equal(typeof USD_PER_RUPIAH_RATE, 'number');
assert.equal(typeof USD_PRICE_RATE, 'number');
if (USD_PER_RUPIAH_RATE !== USD_PRICE_RATE) {
  assert.deepEqual(both, [],
    `the two rates have now parted (${USD_PER_RUPIAH_RATE} vs ${USD_PRICE_RATE}), so any billed figure `
    + 'still going through the indicative one is now wrong in money, not just in principle');
}

console.log(`indicativeRateNeverBills selfcheck OK (${bills.length} screens write orders, ${indicative.length} `
  + `touch the indicative rate, and no screen is in both)`);
