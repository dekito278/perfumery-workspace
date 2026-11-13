// `node src/utils/reserveTakesNoMemberCode.selfcheck.mjs`
//
// Dekito, 14 Nov 2026: Ambar Segara (Solivagant Reserve, Rp2.980.000) has a member price equal to its price.
// A member code takes a PERCENTAGE off retail for every bottle — rows or no rows — so without an exception
// the code would have cut the Reserve bottle too. The exception is the product's own `reserve` flag, read
// the same way by the catalogue the buyer sees and by the order server that charges them.
//
// Also: the three new perfumes' name covers ship with the site, at the paths the manual SQL points at.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { applyTierPrices } from './tierPricedCatalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, '..');

// --- 1. Run it: a member with a 10% code ---------------------------------------------------------------
const product = (slug, reserve, price) => ({ slug, reserve, priceNumber: price, price: String(price), variants: [{ id: '30-ml', size: '30 ml', priceNumber: price }] });
const [regular, reserve] = applyTierPrices(
  [product('jason-voorhees', false, 479000), product('ambar-segara', true, 2980000)],
  'member', {}, String, 10, false,
);
assert.ok(regular.variants[0].priceNumber < 479000, 'a member code no longer lowers a regular bottle — the test is broken');
assert.equal(reserve.variants[0].priceNumber, 2980000, 'a member code cut the price of a Reserve bottle');

// --- 2. The order server applies the same exception ----------------------------------------------------
const endpoint = readFileSync(join(webRoot, 'api', 'orders', 'create.js'), 'utf8');
assert.match(endpoint, /select=id,slug,name,category,price_number,variants,tags,reserve`/, 'the order server does not read the reserve flag');
assert.match(endpoint, /const lineMemberPercent = product\.reserve \? null : memberPercent;/);
assert.match(endpoint, /memberPercent: lineMemberPercent,/, 'the order server still charges a Reserve bottle at the member-code price');

// --- 3. The covers the SQL points at exist -------------------------------------------------------------
const sql = readFileSync(join(webRoot, '..', '..', 'supabase', 'manual', '20261115090000_three_new_variants.sql'), 'utf8');
const covers = [...sql.matchAll(/https:\/\/www\.solivagantscent\.com(\/brand\/covers\/[a-z-]+\.jpg)/g)].map((match) => match[1]);
assert.equal(new Set(covers).size, 3, 'the SQL should point at three covers');
for (const path of covers) assert.ok(existsSync(join(webRoot, 'public', path)), `public${path} is missing — the product would show a broken image`);

console.log('reserveTakesNoMemberCode selfcheck OK (a member code leaves a Reserve bottle at its price, in the shop and at the till; the three covers ship)');
