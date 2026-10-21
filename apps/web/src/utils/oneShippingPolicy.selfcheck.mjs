// `node src/utils/oneShippingPolicy.selfcheck.mjs`
//
// §4: "angka keranjang = angka tabel admin untuk semua kombinasi". Dekito kept the RULE rather than
// building the table, so the criterion becomes: the cart and the Studio quote read ONE policy, and a
// change to it moves both by the same amount. That is kept by there being one of each number, not by
// comparing two of them somewhere.
//
// The policy is only the two figures Dekito decides — what the shop carries, and the rate it converts
// the carrier's rupiah at. The carrier's sheet stays transcribed in exportRates.js, which is why this
// guard asserts the defaults still equal the live behaviour: applying the migration must change no price.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_EXPORT_SHIPPING_POLICY, normalizeExportShippingPolicy, supportUsdFor,
} from './exportShippingPolicy.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const shimPath = join(here, `.shippingPolicy.selfcheck.${process.pid}.mjs`);

// THE REAL RULE, RUN. Four files reach each other through the '@/' alias, which plain node cannot
// resolve, and the thing under test is the number that falls out of all four: the carrier's zone sheet,
// its rate table, the bracket rule, and the subtraction. Stubbing any of them would test a different
// sum than the cart computes.
//
// So they are concatenated in dependency order with their imports stripped. No two of them declare the
// same top-level name — checked before writing this, because that is the one thing that breaks silently.
const chain = [
  join(src, 'data', 'exportZones.js'),
  join(src, 'data', 'exportRates.js'),
  join(src, 'data', 'internationalShippingRates.js'),
  join(src, 'utils', 'exportShippingPolicy.js'),
  join(src, 'utils', 'internationalShippingPrice.js'),
].map((file) => readFileSync(file, 'utf8')
  .replace(/^import [\s\S]*?from '[^']+';$/gm, '')
  .replace(/^export /gm, '')).join('\n');
writeFileSync(shimPath, `${chain}\nexport { quoteInternationalShippingPrice, SHIPPING_COST_RATE, SHIPPING_SUPPORT_USD };\n`);

try {
  const { quoteInternationalShippingPrice, SHIPPING_COST_RATE, SHIPPING_SUPPORT_USD } = await import(`file://${shimPath}`);
  const at = (policy, bottles = 1, countryCode = 'US') => (
    quoteInternationalShippingPrice({ countryCode, bottles, policy })?.usd
  );

  // --- 1. The defaults are today's prices -------------------------------------------------------------
  // Dekito's own brief quotes both of these as what the site charges now, so the migration seeding these
  // numbers must leave every price exactly where it is.
  assert.deepEqual(DEFAULT_EXPORT_SHIPPING_POLICY, { supportSingleUsd: 30, supportMultipleUsd: 50, costRateIdr: 18000 });
  // TWO CONSTANTS FOR ONE NUMBER IS A DRIFT WAITING TO HAPPEN. exportShippingPolicy.js is import-free on
  // purpose — the guards run its arithmetic rather than reading it — so it cannot import the rate sheet's
  // own figures. This asserts they are the same instead, which is the cheaper half of the same promise.
  assert.equal(DEFAULT_EXPORT_SHIPPING_POLICY.costRateIdr, SHIPPING_COST_RATE,
    'the policy default and the rate sheet must name the same conversion rate');
  assert.equal(DEFAULT_EXPORT_SHIPPING_POLICY.supportSingleUsd, SHIPPING_SUPPORT_USD.single,
    'and the same single-bottle subsidy');
  assert.equal(DEFAULT_EXPORT_SHIPPING_POLICY.supportMultipleUsd, SHIPPING_SUPPORT_USD.multiple,
    'and the same one from two bottles up');
  assert.equal(at(null, 1, 'US'), 65, 'US, one bottle: the US$65 in the brief');
  assert.equal(at(null, 2, 'KW'), 55, 'Kuwait, two bottles: the US$55 in the brief');
  assert.equal(at(DEFAULT_EXPORT_SHIPPING_POLICY, 1, 'US'), at(null, 1, 'US'),
    'passing the defaults explicitly is the same as passing nothing');

  // --- 2. A change moves the price, by exactly what was changed ---------------------------------------
  const carriesTenMore = { ...DEFAULT_EXPORT_SHIPPING_POLICY, supportSingleUsd: 40 };
  assert.equal(at(carriesTenMore, 1, 'US'), 55, 'carrying US$10 more takes US$10 off what the buyer pays');
  const cheaperRate = { ...DEFAULT_EXPORT_SHIPPING_POLICY, costRateIdr: 16000 };
  assert.ok(at(cheaperRate, 1, 'US') > at(null, 1, 'US'),
    'a lower rate makes the carrier cost MORE dollars, so the buyer pays more — not less');

  // --- 3. The floor, which only became reachable when the knob became editable ------------------------
  // Until the subsidy could be typed it could not exceed the freight, so the subtraction had no floor.
  // A subsidy above the carrier's rate would have produced a NEGATIVE shipping line, which reduces the
  // order total: the shop paying the buyer to receive a parcel.
  assert.equal(at({ ...DEFAULT_EXPORT_SHIPPING_POLICY, supportSingleUsd: 1000 }, 1, 'US'), 0,
    'a subsidy larger than the freight is free shipping, never a negative line');
  assert.equal(at({ ...DEFAULT_EXPORT_SHIPPING_POLICY, supportMultipleUsd: 9999 }, 3, 'DE'), 0);

  // --- 4. A typo cannot price a parcel at nothing ------------------------------------------------------
  for (const broken of [{ costRateIdr: 0 }, { costRateIdr: -5 }, { costRateIdr: 'x' }]) {
    const policy = normalizeExportShippingPolicy({ ...DEFAULT_EXPORT_SHIPPING_POLICY, ...broken });
    assert.equal(policy.costRateIdr, 18000, `${JSON.stringify(broken)} falls back to the known rate`);
    assert.equal(at(policy, 1, 'US'), 65, 'and the price is unchanged');
  }
  assert.equal(normalizeExportShippingPolicy({ supportSingleUsd: -10 }).supportSingleUsd, 0,
    'a negative subsidy would ADD to the carrier cost, so it clamps at zero');

  // --- 5. One policy, read by both callers ------------------------------------------------------------
  const cart = readFileSync(join(here, '..', 'hooks', 'useInternationalQuote.js'), 'utf8');
  const studio = readFileSync(join(here, '..', 'pages', 'ExportShippingCalculatorPage.jsx'), 'utf8');
  assert.match(cart, /policy: getExportShippingPolicy\(\)/,
    'the storefront cart reads the policy, or it would price a parcel from the constants while Studio used the row');
  assert.match(studio, /policy: shippingPolicy/, 'and the Studio quote reads the same one');
  assert.match(studio, /refreshExportShippingPolicy\(\)/, 'loaded from the database on open');
  assert.match(studio, /saveExportShippingPolicy\(shippingPolicy\)/, 'and editable there');
  // The carrier's sheet is NOT editable from a screen: it is transcribed data, not a decision.
  assert.ok(!/EXPORT_PACKAGE_RATES\s*=/.test(studio), 'the carrier rate sheet stays out of the editor');

  const migration = readFileSync(
    join(here, '..', '..', '..', '..', 'supabase', 'migrations', '20261021160000_export_shipping_policy.sql'), 'utf8',
  );
  assert.match(migration, /values \('default', 30, 50, 18000\)/,
    'seeded with what the shop charges today, so applying it changes no price');
  assert.match(migration, /for select\s*\n\s*using \(true\)/,
    'anyone may READ it — the cart has to compute the same figure, and the price it produces is public');
  assert.match(migration, /using \(public\.is_admin\(\)\)/, 'and only Dekito may write it');
  assert.match(migration, /cost_rate_idr integer not null default 18000 check \(cost_rate_idr > 0\)/,
    'the database refuses a rate of zero too, not just the client');

  console.log('oneShippingPolicy: ok (US$65 to the US and US$55 to Kuwait on the defaults, both callers '
    + 'on one policy, floored at zero, and a typo cannot zero a parcel)');
} finally {
  try { unlinkSync(shimPath); } catch { /* already gone */ }
}
