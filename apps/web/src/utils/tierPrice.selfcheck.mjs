// `node src/utils/tierPrice.selfcheck.mjs`
//
// One rule for which price a line is sold at, shared by the storefront and the order endpoint. The
// availability and og:image bugs both came from two implementations of one answer drifting; a buyer being
// shown one price and charged another is the version of that mistake that costs money.
import assert from 'node:assert/strict';
import { indexTierPrices, resolveTierPrice, tierPricesForLine } from './tierPrice.js';

const RETAIL = 310000;
const prices = { member: 280000, reseller: 220000, overseas: 650000 };

// --- the plain cases -------------------------------------------------------------------------------
assert.equal(resolveTierPrice({ retailPrice: RETAIL, tierPrices: prices, tier: 'retail' }), RETAIL);
assert.equal(resolveTierPrice({ retailPrice: RETAIL, tierPrices: prices, tier: 'member' }), 280000);
assert.equal(resolveTierPrice({ retailPrice: RETAIL, tierPrices: prices, tier: 'reseller' }), 220000);

// --- nothing filled in yet: everyone pays retail, nobody sees an error ------------------------------
for (const tier of ['retail', 'member', 'reseller']) {
  assert.equal(resolveTierPrice({ retailPrice: RETAIL, tierPrices: {}, tier }), RETAIL,
    `${tier} must fall back to retail while no tier price is set — that is what makes the migration safe to delay`);
}

// --- a reseller never pays more than a member ------------------------------------------------------
assert.equal(
  resolveTierPrice({ retailPrice: RETAIL, tierPrices: { member: 280000 }, tier: 'reseller' }),
  280000,
  'with no reseller price set, a reseller takes the member price before retail',
);

// --- where it ships beats who is buying -------------------------------------------------------------
// Member and reseller are Indonesia only; overseas is one price for everyone.
for (const tier of ['retail', 'member', 'reseller']) {
  assert.equal(resolveTierPrice({ retailPrice: RETAIL, tierPrices: prices, tier, overseas: true }), 650000,
    `${tier} buying for an overseas address pays the overseas price, not their tier price`);
}
assert.equal(
  resolveTierPrice({ retailPrice: RETAIL, tierPrices: { member: 280000 }, tier: 'member', overseas: true }),
  RETAIL,
  'no overseas price set means retail — never the member price, which is domestic by decision',
);

// --- junk must not become a price -------------------------------------------------------------------
assert.equal(resolveTierPrice({ retailPrice: RETAIL, tierPrices: { member: 0 }, tier: 'member' }), RETAIL,
  'zero is not a price, it is an empty field');
assert.equal(resolveTierPrice({ retailPrice: RETAIL, tierPrices: { member: -50 }, tier: 'member' }), RETAIL);
assert.equal(resolveTierPrice({ retailPrice: RETAIL, tierPrices: { member: 'abc' }, tier: 'member' }), RETAIL);
assert.equal(resolveTierPrice({ retailPrice: RETAIL, tier: 'tukang-sihir' }), RETAIL,
  'an unknown tier is retail, not a crash and not a discount');
assert.equal(resolveTierPrice({}), 0, 'nothing at all is 0, and the caller decides what to do with that');

// --- indexing the rows the RPC returns --------------------------------------------------------------
const index = indexTierPrices([
  { slug: 'la-rose', variant_id: '', tier: 'member', price_number: 280000 },
  { slug: 'la-rose', variant_id: '30-ml', tier: 'member', price_number: 265000 },
  { slug: 'la-rose', variant_id: '', tier: 'overseas', price_number: 650000 },
  { slug: '', variant_id: '', tier: 'member', price_number: 1 },
  { slug: 'la-rose', variant_id: '', tier: '', price_number: 9 },
  { slug: 'la-rose', variant_id: '', tier: 'member', price_number: null },
]);
assert.deepEqual(Object.keys(index), ['la-rose'], 'a row with no slug is dropped, not indexed under ""');

// A variant's own price wins; what it does not set it inherits from the product row.
const line = tierPricesForLine(index, 'la-rose', '30-ml');
assert.equal(line.member, 265000, 'the variant price overrides the product-level one');
assert.equal(line.overseas, 650000, 'and inherits the tiers the variant does not set');
assert.equal(tierPricesForLine(index, 'la-rose', '').member, 280000);
assert.deepEqual(tierPricesForLine(index, 'tidak-ada', '30-ml'), {}, 'an unknown product has no tier prices');

assert.equal(
  resolveTierPrice({ retailPrice: RETAIL, tierPrices: line, tier: 'member' }),
  265000,
  'end to end: the 30 ml variant sells to a member at its own member price',
);

console.log('tierPrice selfcheck OK (retail is the floor, the variant wins, destination beats tier)');
