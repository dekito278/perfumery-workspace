// `node src/utils/scheduledPriceSwitch.selfcheck.mjs`
//
// The domestic prices change at 2026-11-12 00:00 WIB. Retail and member move; THE INTERNATIONAL PRICE
// DOES NOT — that is the first constraint in Dekito's October brief, and the US$ figure is derived from
// the `overseas` tier price, so leaving those rows alone is what keeps US$80/95/140/160 still.
//
// The switch is rows with an effective_at, in a table of their own. Not a column on
// storefront_product_prices, because that table has unique (product_id, variant_id, tier) and so cannot
// hold today's member price and November's at once, its tier check does not allow 'retail' at all, and
// three admin paths lean on that exact constraint (saveTierPrice upserts on it, listTierPriceIndex reads
// one row per tier, deleteTierPrice removes every row for a tier). Breaking the member-price screen in
// the same week the prices change would be a poor trade.
//
// TIME IS DECIDED BY A SERVER. The two RPCs filter on now() in SQL, and the order endpoint uses its own
// clock. A buyer whose device is a day fast must not be able to buy at tomorrow's price.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { indexTierPrices, resolveTierPrice } from './tierPrice.js';
import { applyTierPrices } from './tierPricedCatalog.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SWITCH = '2026-11-12T00:00:00+07:00';
const BEFORE = '2026-11-11T23:59:59+07:00';

// Production shapes: La Tulipe's real figures, read from the live tables on 2026-10-21.
const rows = () => [
  { slug: 'la-tulipe', variant_id: '30-ml', tier: 'member', price_number: 323000, effective_at: null },
  { slug: 'la-tulipe', variant_id: '30-ml', tier: 'overseas', price_number: 1260000, effective_at: null },
  { slug: 'la-tulipe', variant_id: '30-ml', tier: 'retail', price_number: 479000, effective_at: SWITCH },
  { slug: 'la-tulipe', variant_id: '30-ml', tier: 'member', price_number: 429000, effective_at: SWITCH },
];
// POSTGREST DOES NOT PROMISE AN ORDER, so the fixture is read in both directions. With the scheduled
// row last, "whichever row came back last" happens to give the right answer and a missing latest-wins
// rule looks fine — the first version of this guard passed a sabotage that removed it. Reversed, the
// undated member row arrives last and would win, putting the OLD member price back after the switch.
const reversed = () => [...rows()].reverse();
const pricesAt = (asOf, order = rows) => indexTierPrices(order(), { asOf })['la-tulipe']['30-ml'];

// --- 1. The boundary, to the second ------------------------------------------------------------------
const before = pricesAt(BEFORE);
assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: before, tier: 'retail' }), 359000,
  'at 23:59:59 on 11 Nov a retail buyer still pays the old price');
assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: before, tier: 'member' }), 323000,
  'and a member still pays the old member price');
assert.equal(before.retail, undefined, 'a scheduled row that has not arrived is not a price yet');

const after = pricesAt(SWITCH);
assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: after, tier: 'retail' }), 479000,
  'at 00:00:00 on 12 Nov retail is the new price, without the product row being rewritten');
assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: after, tier: 'member' }), 429000,
  'and the member price is the new one, not the old row that is still in the table');

// --- 1b. The same answer whichever order the rows arrive in -------------------------------------------
for (const [label, order] of [['as queried', rows], ['reversed', reversed]]) {
  const prices = pricesAt(SWITCH, order);
  assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: prices, tier: 'member' }), 429000,
    `${label}: the row in force wins by its date, not by its position in the result`);
  assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: prices, tier: 'retail' }), 479000,
    `${label}: and so does the scheduled retail`);
  const earlier = pricesAt(BEFORE, order);
  assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: earlier, tier: 'member' }), 323000,
    `${label}: before the switch the undated row is the only one there is`);
}

// --- 2. The international price does not move ---------------------------------------------------------
for (const [label, prices] of [['before', before], ['after', after]]) {
  assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: prices, overseas: true }), 1260000,
    `the overseas price must be untouched ${label} the switch — US$80 is derived from it`);
}

// --- 3. A price RISE is not a discount ----------------------------------------------------------------
// applyTierPrices records retailPriceNumber as the figure a member's price is compared against. If the
// scheduled retail did not move that baseline, a retail visitor would have seen 479.000 struck through
// 359.000 — a rise dressed as a saving.
const product = {
  slug: 'la-tulipe',
  priceNumber: 359000,
  variants: [{ id: '30-ml', priceNumber: 359000, price: 'Rp 359.000' }],
};
const retailAfter = applyTierPrices([product], 'retail', indexTierPrices(rows(), { asOf: SWITCH }), String)[0];
assert.equal(retailAfter.variants[0].priceNumber, 479000, 'the retail visitor sees the new price');
assert.equal(retailAfter.variants[0].retailPriceNumber, 479000,
  'and the baseline is the new price too — not the old one, which would read as "was 359.000"');
const memberAfter = applyTierPrices([product], 'member', indexTierPrices(rows(), { asOf: SWITCH }), String)[0];
assert.equal(memberAfter.variants[0].priceNumber, 429000, 'the member sees the new member price');
assert.equal(memberAfter.variants[0].retailPriceNumber, 479000,
  'compared against the new retail, so "Member Rp 429.000" sits under Rp 479.000');

// --- 4. Both readers filter on the database's clock --------------------------------------------------
const migration = readFileSync(
  join(web, '..', '..', 'supabase', 'migrations', '20261021090000_scheduled_domestic_prices.sql'), 'utf8',
);
assert.match(migration, /create table if not exists public\.storefront_price_schedule/,
  'the schedule is its own table — see the header for why it is not a column on the old one');
assert.doesNotMatch(migration, /alter table public\.storefront_product_prices/,
  'the existing price table must not be altered: three admin paths lean on its unique constraint');
for (const fn of ['storefront_prices_for_me', 'storefront_member_prices']) {
  const body = migration.slice(migration.indexOf(`function public.${fn}`));
  const end = body.indexOf('$$;');
  assert.ok(end > 0, `${fn} is not redefined in the migration, so it would still ignore the schedule`);
  assert.match(body.slice(0, end), /sc\.effective_at <= now\(\)/,
    `${fn} must filter the schedule on now() — the database's clock, not the visitor's`);
  assert.match(body.slice(0, end), /order by[\s\S]*effective_at desc nulls last/,
    `${fn} must take the LATEST row in force; without the order the winner is whichever row came back last`);
}

// --- 5. The rows: 19 retail, 19 member, and no overseas ----------------------------------------------
const inserts = migration.slice(migration.indexOf('insert into public.storefront_price_schedule'));
const counts = { retail: 0, member: 0, overseas: 0, reseller: 0 };
for (const match of inserts.matchAll(/'(retail|member|overseas|reseller)',\s*(\d+),/g)) counts[match[1]] += 1;
assert.equal(counts.retail, 19, 'one scheduled retail price per live product');
assert.equal(counts.member, 19, 'and one member price each');
assert.equal(counts.overseas, 0,
  'NOTHING may schedule an overseas price — the US$ figure is derived from it and must not move');
assert.equal(counts.reseller, 0, 'nor a reseller price, which the brief does not change');
// The mapping, asserted as prices rather than as names: a product is in a tier because of what it costs
// today, which is how the brief says to map it.
const scheduled = [...inserts.matchAll(/'(retail|member)',\s*(\d+),/g)].map((m) => [m[1], Number(m[2])]);
const tally = {};
for (const [tier, price] of scheduled) tally[`${tier}:${price}`] = (tally[`${tier}:${price}`] || 0) + 1;
assert.deepEqual(tally, {
  'retail:479000': 10, 'member:429000': 10,
  'retail:569000': 7, 'member:509000': 7,
  'retail:849000': 1, 'member:765000': 1,
  'retail:999000': 1, 'member:899000': 1,
}, 'ten tier A, seven tier B, and the two reserves — mapped from the price each product carries today');

// --- 6. The order endpoint reads the schedule too -----------------------------------------------------
const endpoint = readFileSync(join(web, 'api', 'orders', 'create.js'), 'utf8');
assert.match(endpoint, /storefront_price_schedule\?product_id=eq/,
  'the order endpoint must read the schedule, or checkout would keep charging the old price after the switch');
assert.match(endpoint, /indexTierPrices\(\s*\[\.\.\.tierRows, \.\.\.scheduledRows\]/,
  'and merge both tables through the one shared index');
assert.match(endpoint, /asOf: Date\.now\(\)/, 'judged against the server clock');
assert.match(endpoint, /storefront_product_prices\?product_id=eq[^`]*select=\*/,
  'and select=* so a deploy that lands before the migration does not 400 on a missing column');

console.log('scheduledPriceSwitch: ok (old prices through 11 Nov 23:59:59 WIB, new from 12 Nov 00:00:00, '
  + '19 retail + 19 member scheduled, no overseas row touched)');
