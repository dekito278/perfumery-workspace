// `node src/utils/internationalDestination.selfcheck.mjs`
//
// One country, three answers — which price, whether the freight is inside it, and whether Dekito has to
// quote it by hand — decided in one place so no screen answers one of them from a different table.
//
// The rule this replaces was carrier coverage: the eight countries whose RaySpeed rate happened to be
// measured. Every product page meanwhile promised "Shipping included to Southeast Asia, East Asia,
// Australia and the Americas". Thailand, the Philippines and Vietnam lived in that gap — promised free
// shipping on the page they were reading, charged for it when the order was written in Studio.
//
// The promise is what the buyer was told, so the promise is the rule, and the published rate card is how
// that sentence is spelled out.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { MESSAGES } from '../i18n/messages.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const inline = (...parts) => readFileSync(join(srcRoot, ...parts), 'utf8')
  .split('\n').filter((line) => !line.startsWith('import ')).join('\n');

const shim = [
  inline('data', 'exportZones.js'),
  inline('data', 'internationalShippingRates.js'),
  // Every inlined module keeps its own `export` keywords, so no re-export line is needed — and adding
  // one collides with them.
  inline('utils', 'internationalDestination.js'),
].join('\n');
const {
  destinationFor, canCheckoutTo, listCheckoutDestinations, shippingIncludedFor, isAsiaCountry,
  SHIPPING_INCLUDED_REGIONS, SHIPPING_RATE_REGIONS,
} = await import(`data:text/javascript;base64,${Buffer.from(shim, 'utf8').toString('base64')}`);

// --- 1. The three countries the old rule got wrong ----------------------------------------------------
for (const code of ['TH', 'PH', 'VN', 'MO', 'CN', 'KR', 'NZ', 'CA', 'MX']) {
  assert.equal(shippingIncludedFor(code), true,
    `${code} is inside the sentence the product page prints, so its shipping is included`);
}

// --- 2. And the ones it got right, unchanged ----------------------------------------------------------
for (const code of ['MY', 'SG', 'HK', 'BN', 'JP', 'AU', 'TW', 'US']) {
  assert.equal(shippingIncludedFor(code), true, `${code} was already promised included and still is`);
}
for (const code of ['DE', 'FR', 'GB', 'IT', 'ES', 'AE', 'SA', 'IN', 'LK']) {
  assert.equal(shippingIncludedFor(code), false, `${code} is quoted by hand — the page never promised it`);
  assert.equal(destinationFor(code).shippingQuoted, true);
}

// --- 3. The included set IS the sentence, region for region -------------------------------------------
// If a region is ever added to the card, this is what refuses to let it default into "free shipping".
assert.deepEqual(SHIPPING_INCLUDED_REGIONS, ['southeast_asia', 'east_asia_oceania', 'north_america']);
for (const region of SHIPPING_RATE_REGIONS) {
  const included = SHIPPING_INCLUDED_REGIONS.includes(region.key);
  for (const code of region.countries) {
    assert.equal(shippingIncludedFor(code), included,
      `${code} must follow its region (${region.key}), not a list of its own`);
  }
}
// The sentence itself, in both shops. A region added to the promise without being added to the card — or
// the other way round — is the drift this whole file exists to catch.
for (const language of ['id', 'en']) {
  const promise = MESSAGES[language]['intl.priceNote'];
  assert.ok(promise, `${language}.intl.priceNote must exist`);
  for (const word of ['Asia', 'Australia']) {
    assert.ok(promise.includes(word), `${language} promise must still name ${word}: ${promise}`);
  }
}

// --- 4. Which of the two prices --------------------------------------------------------------------
assert.equal(destinationFor('MY').priceRegion, 'asia');
assert.equal(destinationFor('TH').priceRegion, 'asia');
assert.equal(destinationFor('JP').priceRegion, 'world', 'Japan is a rich market on the world price');
assert.equal(destinationFor('US').priceRegion, 'world');
// The two questions are independent, and this is the pair that proves it: Japan's shipping is included
// AND it pays the world price. Collapsing them would quote Japan 2.2x.
assert.equal(destinationFor('JP').shippingIncluded, true);
for (const region of SHIPPING_RATE_REGIONS) {
  for (const code of region.countries) {
    assert.equal(destinationFor(code).priceRegion, isAsiaCountry(code) ? 'asia' : 'world',
      `${code}'s price region must agree with the neighbours rule`);
  }
}

// --- 5. Home, nonsense, and the places the shop does not ship to --------------------------------------
assert.equal(destinationFor('ID'), null, 'Indonesia is home, not an international destination');
// That assertion passes for the wrong reason on its own — Indonesia is not on the rate card either, so
// removing the home check entirely still returns null and the test stays green. A sabotage proved it.
// The home check has to be there and has to come FIRST, or the day Indonesia appears on a card the shop
// starts quoting itself an export price.
const rule = readFileSync(join(srcRoot, 'utils', 'internationalDestination.js'), 'utf8');
const homeCheck = rule.indexOf('code === HOME_COUNTRY');
const cardLookup = rule.indexOf('shippingRateRegionFor(code)');
assert.ok(homeCheck > 0, 'home must be refused explicitly, not by happening to be absent from the card');
assert.ok(homeCheck < cardLookup, 'and refused before the card is consulted');
assert.equal(destinationFor(''), null);
assert.equal(destinationFor(), null, 'called with nothing at all, no crash');
assert.equal(destinationFor('ZZ'), null);
assert.equal(destinationFor('my').code, 'MY', 'a lowercase code is the same country');
// Not a gap to fill with a guess: a parcel nobody has priced still belongs on WhatsApp.
for (const code of ['BR', 'AR', 'ZA', 'NG', 'EG', 'RU', 'TR', 'PK']) {
  assert.equal(canCheckoutTo(code), false, `${code} is not on the card and cannot be checked out to`);
  assert.equal(shippingIncludedFor(code), false, 'and nothing may promise its shipping is included');
}

// --- 6. The picker offers every country the card prices, and nothing else ------------------------------
const groups = listCheckoutDestinations((code) => `Negara ${code}`);
assert.equal(groups.length, SHIPPING_RATE_REGIONS.length, 'every region must be offered as a group');
const offered = groups.flatMap((group) => group.countries.map((country) => country.code));
assert.equal(new Set(offered).size, offered.length, 'no country may appear twice in the picker');
for (const code of offered) {
  assert.equal(canCheckoutTo(code), true, `${code} is offered in the picker but cannot be checked out to`);
}
assert.equal(offered.length, SHIPPING_RATE_REGIONS.reduce((sum, region) => sum + region.countries.length, 0));
// Sorted by the name the buyer reads, not by code — a picker ordered by ISO code is unusable.
for (const group of groups) {
  const names = group.countries.map((country) => country.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), `${group.key} must be sorted by name`);
}

console.log(`internationalDestination selfcheck OK (${offered.length} destinations, one rule for price, shipping and quote)`);
