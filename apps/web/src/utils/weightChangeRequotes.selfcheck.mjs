// `node src/utils/weightChangeRequotes.selfcheck.mjs`
//
// Audit round 7 made a weight change clear the quoted rate, so nobody agrees to a fee for a parcel that
// no longer exists. Ninth visitor audit, 13 Nov 2026, found the other half missing: when the shop itself
// changed the weight — a line corrected down to the stock left — after the area was chosen, the rate
// vanished and nothing asked again. "Lengkapi: ongkir", an empty list, and above it the notice
// "Kami pilihkan ongkir paling hemat" still claiming a choice had been made.
//
// The rule: a weight change clears the old rate AND, with an area and courier in hand, prices the parcel
// again, keeping the buyer's own service when it is still offered. A reply to an older quote never lands.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const flow = stripComments(readFileSync(join(root, 'hooks', 'useCheckoutFlow.js'), 'utf8'));

const effect = flow.match(/const quotedWeightRef = useRef\(shippingWeight\);\s*useEffect\(\(\) => \{([\s\S]*?)\}, \[shippingWeight\]\);/);
assert.ok(effect, 'the weight effect is gone or no longer keyed on the weight alone');
const body = effect[1];
assert.match(body, /setSelectedShipping\(null\);\s*setShippingOptions\(\[\]\);\s*setShippingNotice\(''\);/,
  'a weight change must clear the old rate and the notice that claimed it');
assert.match(body, /if \(!weightChanged \|\| !selectedDestination\?\.id \|\| !selectedCourier \|\| !items\.length\) return;/,
  'the re-quote must wait for a real change, an area and a courier');
assert.match(body, /loadShippingRates\(selectedDestination, \{\s*autoSelectCheapest: true,\s*prefer: previousRate,/,
  'a weight change with an area chosen must price the parcel again, keeping the buyer\'s service');

// The buyer's service, if still offered; else the cheapest. And the notice says why the rate moved.
assert.match(flow, /const sameService = prefer\s*\? sortedRates\.find\(\(rate\) => rate\.courierCode === prefer\.courierCode && rate\.service === prefer\.service\)/);
assert.match(flow, /setSelectedShipping\(sameService \|\| sortedRates\[0\]\);/);

// Stale replies dropped, in both places the page asks for rates.
const asks = flow.match(/await getShippingRates\(\{/g) || [];
const tokens = flow.match(/const request = \+\+shippingRequestRef\.current;/g) || [];
const checks = flow.match(/if \(request !== shippingRequestRef\.current\) return;/g) || [];
assert.ok(asks.length >= 2, 'the rate requests were not found — the scan is broken');
assert.equal(tokens.length, asks.length, 'a rate request without a number can land after a newer one');
assert.ok(checks.length >= asks.length, 'a rate reply is not checked against the latest request');

console.log(`weightChangeRequotes selfcheck OK (a new weight re-prices the parcel; ${asks.length} rate requests drop stale replies)`);
