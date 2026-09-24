// `node src/utils/internationalOrderPrice.selfcheck.mjs`
//
// The order endpoint recomputes every price from the database and never trusts the browser — that is the
// rule the price-tampering incident left behind. Until now it only knew domestic prices: `overseas` was
// hardcoded false with a comment saying overseas sales are entered by hand in Studio.
//
// An international checkout changes that, and the change has to land in the one place a price can be
// enforced. Three properties:
//
//   1. WHERE THE PARCEL GOES decides the price, not who is signed in. The member discount is a domestic
//      loyalty price and does not travel — and a member signing in must not make a Singapore order
//      cheaper than the page quoted.
//   2. A line with no international price is REFUSED, not fallen back to the Indonesian one. Charging
//      Rp 359.000 for a bottle going to Germany is a loss no buyer would ever question.
//   3. A country the shop does not ship to is refused outright rather than silently priced as domestic.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { destinationFor, internationalPriceFor } from './internationalDestination.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const endpoint = stripComments(readFileSync(join(srcRoot, '..', 'api', 'orders', 'create.js'), 'utf8'));

// --- 1. The endpoint can reach the rule at all --------------------------------------------------------
// It runs in plain node and cannot resolve the '@/' alias the browser modules use. An import that only
// works in Vite would fail at request time, on the one endpoint that must not fail.
assert.match(endpoint, /from '\.\.\/\.\.\/src\/utils\/internationalDestination\.js'/,
  'the endpoint must import the destination rule by relative path');
const rule = readFileSync(join(srcRoot, 'utils', 'internationalDestination.js'), 'utf8');
for (const line of rule.split('\n').filter((row) => row.startsWith('import '))) {
  assert.doesNotMatch(line, /'@\//,
    `internationalDestination imports ${line.trim()} — the order endpoint cannot resolve '@/'`);
}

// --- 2. Destination decides, not the signed-in tier ---------------------------------------------------
assert.match(endpoint, /priceCatalogItems\(input\.items \|\| \[\], buyerTier, destination\)/,
  'the recompute must be told where the parcel is going');
const branch = endpoint.match(/if \(destination\) \{([\s\S]*?)\n    \} else if \(index\) \{/);
assert.ok(branch, 'there must be an international branch, separate from the tier branch');
assert.doesNotMatch(branch[1], /buyerTier/,
  'the international price must not consult the buyer tier — a member discount does not travel');
assert.match(branch[1], /internationalPriceFor\(/, 'and must come from the shared rule');

// --- 3. A missing international price is refused ------------------------------------------------------
assert.match(branch[1], /if \(!international\) \{[\s\S]*?throw new Error/,
  'a line with no international price must be refused, never charged the Indonesian one');

// --- 4. An unserved country is refused ----------------------------------------------------------------
assert.match(endpoint, /if \(destinationCountry && !destination\) \{[\s\S]*?jsonResponse\(res, 422/,
  'a country the shop does not ship to must be refused, not priced as domestic');
assert.match(endpoint, /destinationFor\(destinationCountry\)/, 'and refused by the same rule the shop lists with');

// --- 5. The arithmetic the endpoint now performs ------------------------------------------------------
// HUG N°1 today: retail Rp 359.000, hand-set world price Rp 1.260.000.
const tierPrices = { overseas: 1260000, member: 323000 };
const RETAIL = 359000;

const toSingapore = destinationFor('SG');
assert.equal(toSingapore.priceRegion, 'asia');
assert.equal(internationalPriceFor({ tierPrices, linePrice: RETAIL, region: toSingapore.priceRegion }), 790000,
  'a parcel to Singapore is priced at the neighbours rate');

const toGermany = destinationFor('DE');
assert.equal(internationalPriceFor({ tierPrices, linePrice: RETAIL, region: toGermany.priceRegion }), 1260000);

// The member price is in the table above and must never surface on either branch.
for (const code of ['SG', 'DE', 'US', 'TH']) {
  const priced = internationalPriceFor({ tierPrices, linePrice: RETAIL, region: destinationFor(code).priceRegion });
  assert.notEqual(priced, tierPrices.member, `${code} must not be charged the member price`);
  assert.ok(priced > RETAIL, `${code} must not be charged below the Indonesian price`);
}

// No overseas price set: the world branch has nothing to charge and must return nothing, so the endpoint
// refuses instead of inventing a number.
assert.equal(internationalPriceFor({ tierPrices: {}, linePrice: RETAIL, region: 'world' }), null);

console.log('internationalOrderPrice selfcheck OK (the destination prices the order, and a missing price is refused)');
