// `node src/utils/carrierNamedIsCarrierUsed.selfcheck.mjs`
//
// The export quote screen opened with a sentence naming the sheet its numbers came from: "Tarif LTU
// Express, berlaku 2026-02-05." That was true when it was written. RaySpeed was added later and took
// eight destinations off that sheet — and they are not eight arbitrary ones. They are Malaysia,
// Singapore, Hong Kong, Taiwan, Japan, Brunei, Australia: the near-Asia orders this shop actually gets,
// and Malaysia is the country the screen opens on. LTU still covers the other 225, so the sentence is
// right for most of the map and wrong for most of the parcels.
//
// The code thirty lines below says how wrong: "jangan pakai angka LTU, itu berkali-kali lipat." A screen
// whose whole purpose is answering "how much is shipping" told Dekito the figure in front of him came
// from a sheet several times more expensive than the one it had actually used.
//
// The fix that introduced RaySpeed went to the quoting function and to every panel that shows a result.
// It did not go to the heading, because the heading is not a result — it is a claim about where results
// come from, and nothing connected the two.
//
// The rule: the carrier a screen NAMES is the carrier its quote CAME from. Checked both ways — the
// predicate the heading branches on really is the one the quoter uses (run, over every destination), and
// the heading really does branch (read, off the page).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { listExportDestinations } from '../data/exportZones.js';
import { rayspeedServes, RAYSPEED_MEASURED_ON } from '../data/rayspeedRates.js';
import { EXPORT_RATE_EFFECTIVE } from '../data/exportRates.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// The quoter, run for real. Its own imports go through the '@/' alias, which node cannot resolve, so they
// are rewritten to absolute file URLs rather than stubbed — stubbing the rate tables would mean asserting
// against rates this guard invented.
const quoterSource = readFileSync(join(src, 'utils', 'exportShipping.js'), 'utf8')
  .replace(/'@\//g, `'${pathToFileURL(src).href}/`);
const { quoteInternationalShipping } = await import(
  `data:text/javascript;base64,${Buffer.from(quoterSource, 'utf8').toString('base64')}`
);

// --- 1. The predicate the heading branches on is the one the quoter obeys -------------------------------
const destinations = listExportDestinations();
assert.ok(destinations.length >= 100,
  `expected the full destination list, found ${destinations.length} — the scan is broken, not the code`);

let rayspeed = 0;
let ltu = 0;
for (const destination of destinations) {
  const quote = quoteInternationalShipping({ countryCode: destination.code, weightGram: 500 });
  if (!quote) continue;
  const served = rayspeedServes(destination.code);
  assert.equal(quote.carrier === 'rayspeed', served,
    `${destination.code} is quoted by ${quote.carrier} but rayspeedServes says ${served} — the heading `
    + 'branches on rayspeedServes, so the two disagreeing means the heading names the wrong sheet again');
  served ? (rayspeed += 1) : (ltu += 1);
}
assert.ok(rayspeed > 0 && ltu > 0,
  `both carriers must still be reachable for the heading to need a branch at all (rayspeed ${rayspeed}, `
  + `ltu ${ltu}) — if one is now dead, delete the branch and say so, do not leave the other's name up`);
// The specific case that was wrong on screen: the country the page opens on.
assert.equal(quoteInternationalShipping({ countryCode: 'MY', weightGram: 500 }).carrier, 'rayspeed',
  'Malaysia is the default country on this screen; it was the one being labelled LTU');
assert.equal(quoteInternationalShipping({ countryCode: 'DE', weightGram: 500 })?.carrier, 'ltu',
  'and Germany is why the LTU sheet is still in the repo');

// --- 2. The heading really does branch, and names each sheet's own date ---------------------------------
const page = readFileSync(join(src, 'pages', 'ExportShippingCalculatorPage.jsx'), 'utf8');
const start = page.indexOf('<header');
const heading = page.slice(start, page.indexOf('</header>', start));
assert.ok(start !== -1 && heading, 'the heading has moved; this guard no longer reads it');

for (const name of ['RaySpeed', 'LTU']) {
  assert.ok(heading.includes(name),
    `the heading names one carrier and not ${name} — on every destination the other one serves, it is a `
    + 'claim about the numbers below that is simply false');
}
assert.match(heading, /rayspeedServes\(/,
  'the heading states a carrier without asking which one this country ships by');
// Each sheet carries its own date, and swapping them is the same lie in quieter form: the LTU sheet is
// from February, the RaySpeed rates were measured in September.
assert.notEqual(RAYSPEED_MEASURED_ON, EXPORT_RATE_EFFECTIVE, 'the two sheets are dated separately');
assert.match(heading, /RAYSPEED_MEASURED_ON/, 'the RaySpeed half must date itself from the RaySpeed sheet');
assert.match(heading, /EXPORT_RATE_EFFECTIVE/, 'and the LTU half from the LTU sheet');

console.log(`carrierNamedIsCarrierUsed selfcheck OK (${rayspeed} destinations quoted by RaySpeed, ${ltu} by `
  + 'LTU, and the heading names whichever one this country actually ships by)');
