// `node src/utils/rayspeedShipping.selfcheck.mjs`
//
// Every international figure this app produced came off the LTU Express sheet, which is not the carrier
// Dekito ships with. Measured on RaySpeed's own simulator, same kilo to Malaysia: Rp 90.000 against LTU's
// Rp 1.188.000 — thirteen times. Every quote he sent an overseas buyer, and every shipping line on an
// order written from that tool, was about ten times the price he is actually billed.
//
// The rule this pins is narrower than "use RaySpeed": it is that a country nobody has MEASURED gets no
// number at all. Quoting Singapore off the LTU sheet because RaySpeed's rate is unknown would be the
// same defect wearing a different carrier's name.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

const stubs = `
const EXPORT_FLAT_PER_KG = [];
const EXPORT_ODA_FEE = 390000;
const EXPORT_PACKAGE_RATES = [[0.5, 890000, 909000, 1024000, 1195000, 1304000, 1378000, 1580000, 2146000],
                              [1.0, 1092000, 1188000, 1323000, 1511000, 1709000, 1819000, 2040000, 2744000]];
const EXPORT_ZONE_BY_COUNTRY = { MY: 2, SG: 1, US: 5, DE: 7, FR: 7, JP: 3 };
const RAYSPEED_RATE_PER_KG = { MY: 90000, US: 670500 };
const RAYSPEED_SERVED_UNMEASURED = ['SG', 'TW', 'HK', 'BN', 'JP', 'AU'];
const rayspeedRateFor = (c) => RAYSPEED_RATE_PER_KG[String(c || '').toUpperCase()] ?? null;
const rayspeedServes = (c) => {
  const code = String(c || '').toUpperCase();
  return Boolean(RAYSPEED_RATE_PER_KG[code]) || RAYSPEED_SERVED_UNMEASURED.includes(code);
};
`;
const runnable = stubs + read('utils', 'exportShipping.js')
  .split('\n').filter((line) => !line.startsWith('import ')).join('\n');
const { quoteInternationalShipping } = await import(
  `data:text/javascript;base64,${Buffer.from(runnable, 'utf8').toString('base64')}`
);

// --- 1. A measured country is quoted at the measured price -------------------------------------------
const malaysia = quoteInternationalShipping({ countryCode: 'MY', weightGram: 250 });
assert.equal(malaysia.carrier, 'rayspeed');
assert.equal(malaysia.total, 90000, 'Malaysia is being quoted off the wrong sheet again');
assert.equal(malaysia.measured, true);
assert.equal(malaysia.estimated, false, 'the measured 1 kg point must not be flagged as a guess');
assert.equal(quoteInternationalShipping({ countryCode: 'US', weightGram: 900 }).total, 670500);

// One bottle is 250 g and still bills a whole kilo — the minimum, not a proportion of it.
assert.equal(quoteInternationalShipping({ countryCode: 'MY', weightGram: 100 }).chargeableKg, 1);

// --- 2. Past the one measured point it says it is guessing --------------------------------------------
const heavy = quoteInternationalShipping({ countryCode: 'MY', weightGram: 2400 });
assert.equal(heavy.chargeableKg, 3);
assert.equal(heavy.total, 270000);
assert.equal(heavy.estimated, true,
  'a figure extrapolated from a single measured point was presented as if it had been measured');

// --- 3. Served but UNMEASURED means no number, not the old sheet --------------------------------------
// The whole defect, pointed the other way: Singapore off the LTU sheet is Rp 890.000, and the real
// figure is almost certainly near Malaysia's Rp 90.000. A blank the owner fills in is honest.
for (const code of ['SG', 'JP', 'AU', 'HK', 'TW', 'BN']) {
  const quote = quoteInternationalShipping({ countryCode: code, weightGram: 250 });
  assert.equal(quote.carrier, 'rayspeed', `${code} fell through to the LTU sheet`);
  assert.equal(quote.measured, false);
  assert.equal(quote.total, null,
    `${code} was given a number nobody measured — that is the bug this file exists to stop`);
}

// --- 4. Where RaySpeed does not go, LTU still applies --------------------------------------------------
// Germany came back "Harga Tidak Tersedia" from RaySpeed's own simulator, and Europe is nowhere in their
// destination pages. The LTU sheet is not wrong there, just expensive.
const germany = quoteInternationalShipping({ countryCode: 'DE', weightGram: 250 });
assert.equal(germany.carrier, 'ltu');
assert.ok(germany.total > 900000, 'Europe stopped being quoted at all');
assert.equal(quoteInternationalShipping({ countryCode: 'ID', weightGram: 250 }), null, 'home is not an export');
assert.equal(quoteInternationalShipping({ countryCode: '', weightGram: 250 }), null);

// --- 5. The rate file carries its provenance ----------------------------------------------------------
// These are numbers somebody read off a screen once. Six months from now the only thing that makes them
// trustworthy — or visibly stale — is the date and the conditions they were read under.
const rates = read('..', 'src', 'data', 'rayspeedRates.js');
assert.match(rates, /RAYSPEED_MEASURED_ON = '20\d\d-\d\d-\d\d'/, 'the rates do not say when they were measured');
assert.match(rates, /Reguler/, 'nor under which service');
assert.match(rates, /15×15×15|15x15x15/, 'nor at which box size');

// And the measured numbers themselves, pinned. The quoter above runs against stubs — which is right for
// testing the RULE, and useless for noticing that somebody pasted an LTU figure into the rate file. If
// one of these ever changes it should be because it was measured again, which means this line changes
// with it and the date above changes too.
assert.match(rates, /MY: 90000/, 'the measured Malaysia rate has been edited — remeasure and update the date');
assert.match(rates, /US: 670500/, 'the measured United States rate has been edited');
assert.doesNotMatch(rates, /MY: 9090+00|MY: 1188000/,
  'an LTU sheet figure has been pasted into the RaySpeed rates');

console.log('rayspeedShipping selfcheck OK (the carrier that actually ships quotes the price, and a country nobody measured is quoted nothing at all)');
