// `node src/utils/carrierNamedIsCarrierUsed.selfcheck.mjs`
//
// For three weeks this repo held two carriers at once and could not say which one it shipped with.
//
// `exportRates.js` is the sheet every export figure comes from, and its header named a forwarder nobody
// had confirmed. `rayspeedRates.js` opened with "the carrier Dekito actually ships with" and took eight
// near-Asia destinations off that sheet — Rp 90.000 the kilo to Malaysia against Rp 1.188.000, about a
// seventh. Both were live, and the Studio quote screen put a "Pakai" button under each: two freight
// figures seven times apart, side by side, for the same parcel. Whichever one Dekito pressed, the other
// said he had got it badly wrong.
//
// Dekito settled it on 6 Oct 2026: he ships DHL, and the sheet is his. The second table is deleted.
//
// What this guard holds is not "DHL" — it is the shape that let the contradiction exist: more than one
// source of freight, more than one function quoting it, and a heading that branched instead of saying
// so. Five ways, four of them derived by walking the tree rather than reading a list.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, basename, relative } from 'node:path';
import { Buffer } from 'node:buffer';
import { listExportDestinations } from '../data/exportZones.js';
import { EXPORT_RATE_EFFECTIVE } from '../data/exportRates.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return /\.(js|jsx|mjs)$/.test(entry) ? [full] : [];
});
// Guards are prose about history by nature — they are the one place the retired carrier SHOULD still be
// named. Everything else is live code.
const sources = walk(src).filter((file) => !file.endsWith('.selfcheck.mjs'));
assert.ok(sources.length > 300, `expected the whole tree, walked ${sources.length} files — the scan is broken`);

// --- 1. One function quotes the freight ----------------------------------------------------------------
// Two of them is how the message to the buyer and the order written beside it came to disagree: one read
// the carrier cost, the other the published card. A screen cannot name the carrier its number came from
// when two different numbers are on offer.
const quoter = readFileSync(join(src, 'utils', 'exportShipping.js'), 'utf8');
const quoters = [...stripComments(quoter).matchAll(/^export const (quote\w+)/gm)].map((match) => match[1]);
assert.deepEqual(quoters, ['quoteExportShipping'],
  `exportShipping.js exports ${quoters.length} quoting functions (${quoters.join(', ')}) — one sheet, one `
  + 'quoter, or the two can be read against each other again');

// --- 2. One source of freight, found by walking, not listed -------------------------------------------
// A module whose name says Rate is a table of money somebody will be billed. Every one of them that any
// file in the app reads is collected here, and the set is fixed: a third means a second carrier is back,
// and this is where its owner has to come and say which parcels it covers.
const KNOWN_RATE_MODULES = {
  'exportRates.js': 'the DHL sheet Dekito handed over — the only carrier prices in the app',
  'internationalShippingRates.js': 'not a carrier sheet: how much of the DHL cost SOLIVAGANT absorbs',
};
const rateModules = new Map();
for (const file of sources) {
  for (const [, specifier] of stripComments(readFileSync(file, 'utf8'))
    .matchAll(/from\s+'(@\/data\/[^']*[Rr]ate[^']*\.js)'/g)) {
    const name = basename(specifier);
    if (!rateModules.has(name)) rateModules.set(name, []);
    rateModules.get(name).push(relative(src, file));
  }
}
console.log('  rate tables the app reads:');
for (const [name, readers] of [...rateModules].sort()) {
  console.log(`    ${name} — ${readers.length} reader(s): ${readers.join(', ')}`);
}
assert.deepEqual([...rateModules.keys()].sort(), Object.keys(KNOWN_RATE_MODULES).sort(),
  'a rate table appeared or vanished. Two carriers quoting the same parcel seven times apart is the '
  + 'defect this guard exists for: if this is a second courier, the screen must say which parcels it '
  + 'covers and rule 4 below must branch with it');

// --- 3. That one sheet answers every destination it lists ---------------------------------------------
// The second carrier served eight countries and had measured two, so six of them produced a panel with
// no number in it — on a screen whose entire job is answering "how much is shipping". Run for real: the
// quoter's own imports go through '@/', which node cannot resolve, so they are rewritten to file URLs
// rather than stubbed. Stubbing the rate table would mean asserting against rates this guard invented.
const { quoteExportShipping } = await import(`data:text/javascript;base64,${Buffer.from(
  quoter.replace(/'@\//g, `'${pathToFileURL(src).href}/`), 'utf8').toString('base64')}`);

const destinations = listExportDestinations();
assert.ok(destinations.length >= 100,
  `expected the full destination list, found ${destinations.length} — the scan is broken, not the code`);
let quoted = 0;
for (const destination of destinations) {
  const quote = quoteExportShipping({ countryCode: destination.code, weightGram: 500 });
  assert.ok(quote && quote.total > 0,
    `${destination.code} is on the zone sheet and still came back without a price — a blank panel on the `
    + 'screen that exists to answer "how much is shipping"');
  quoted += 1;
}
// The two destinations the contradiction was measured on, and the one that proved it mattered.
assert.equal(quoteExportShipping({ countryCode: 'MY', weightGram: 500 }).total, 909000,
  'Malaysia is the country this screen opens on, and the one the two sheets disagreed about seven-fold');
assert.ok(quoteExportShipping({ countryCode: 'DE', weightGram: 500 }).total > 900000, 'Europe still quotes');
assert.equal(quoteExportShipping({ countryCode: 'ID', weightGram: 500 }), null, 'home is not an export');

// --- 4. The screen names the carrier, without branching, and dates itself from its sheet --------------
// The heading is a claim about where the numbers below came from. When a second carrier took over most of
// the parcels, the fix went to the quoter and to every panel showing a result — and not here, because a
// heading is not a result. Nothing connected the two.
// Comments stripped first. A heading that names DHL in a {/* comment */} and prints a bare date to the
// screen reads as correct source and tells Dekito nothing — the claim has to be in what he can see.
const page = stripComments(readFileSync(join(src, 'pages', 'ExportShippingCalculatorPage.jsx'), 'utf8'));
const start = page.indexOf('<header');
const heading = page.slice(start, page.indexOf('</header>', start));
assert.ok(start !== -1 && heading, 'the heading has moved; this guard no longer reads it');
assert.match(heading, /DHL/, 'the heading does not name the carrier whose sheet every figure below is from');
assert.match(heading, /EXPORT_RATE_EFFECTIVE/,
  "and it must date itself from that sheet's own constant, not from a date typed beside it");
assert.doesNotMatch(heading, /\?[^;]*Tarif|Serves\(|carrier/i,
  'the heading branches on a carrier again — if a second one is back, rule 2 above is where to say so');
assert.ok(/^20\d\d-\d\d-\d\d$/.test(EXPORT_RATE_EFFECTIVE), 'the sheet carries the date it took effect');

// --- 5. The retired carrier is gone from live code, and only from live code ----------------------------
// Comments and guards keep the history on purpose: the reason a decision was made outlives the code it
// removed, and "we used to quote a carrier seven times cheaper" is worth a reader's time. What must not
// survive is a switched-on gate — the pile that made the last sweep worth running.
const live = sources.filter((file) => /rayspeed/i.test(stripComments(readFileSync(file, 'utf8'))))
  .map((file) => relative(src, file));
assert.deepEqual(live, [],
  `the retired carrier is still live in: ${live.join(', ')} — history belongs in comments, not in code`);

console.log(`carrierNamedIsCarrierUsed selfcheck OK (one quoter, one carrier sheet, ${quoted} destinations `
  + 'priced from it, and the heading names DHL without branching)');
