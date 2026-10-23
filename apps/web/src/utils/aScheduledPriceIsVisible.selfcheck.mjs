// `node src/utils/aScheduledPriceIsVisible.selfcheck.mjs`
//
// A price with a date on it may not be invisible to the person who sets prices.
//
// storefront_prices_for_me picks the winner with, read from the LIVE function on 2026-10-23:
//
//     order by f.product_id, f.variant_id, f.tier, f.effective_at desc nulls last
//
// A scheduled row carries a date, the base row carries null, so from the moment the date passes the
// scheduled row wins — and goes on winning. Correct on 12 November, wrong on the 13th: Dekito could
// edit a price in Studio, watch it save, and the shop would keep charging the scheduled number with
// nothing on any screen to explain it. Nineteen products' price fields would have become decorative.
//
// Two things close that, and this guard holds both:
//   * 20261112090000 applies the schedule into the tables Studio writes and then DELETES it, so the
//     mechanism is one-shot (Dekito's choice, 2026-10-23);
//   * the product form shows what is scheduled either way, because a schedule nobody can see is what
//     made this dangerous — not the ordering.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const migrations = join(src, '..', '..', '..', 'supabase', 'migrations');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. The form reads the schedule and renders it -----------------------------------------------
const form = read('components', 'product', 'ProductForm.jsx');
assert.match(form, /getScheduledPricesForProduct\(product\.id\)/,
  'the product form must ask what is scheduled for the product being edited');
assert.match(form, /scheduledPrices\.length \?/,
  'and render something when there is a schedule');
// The two states are different warnings and both must exist: one says the price WILL change, the other
// says the field below is already being overridden. Collapsing them loses the urgent half.
assert.match(form, /scheduledPrices\.some\(\(row\) => row\.inForce\)/,
  'a schedule already in force must read differently from one still to come');

// --- 2. The service asks for both, and fails closed ----------------------------------------------
const service = read('services', 'priceScheduleService.js');
assert.match(service, /from\('storefront_price_schedule'\)|TABLE = 'storefront_price_schedule'/,
  'the service must read the schedule table');
// The QUERY must not narrow by date. The first version of this line also matched the in-memory
// `getTime() <= now` that computes inForce, and failed on correct code — a guard that cannot tell a
// filter from a comparison is a guard that gets loosened in a hurry and stops meaning anything.
const query = service.slice(service.indexOf('.from(TABLE)'), service.indexOf('if (error'));
assert.doesNotMatch(query, /\.lte\(|\.gte\(|\.lt\(|\.gt\(/,
  'the query must NOT filter to rows already in force — the overriding one is the urgent one to show');
assert.match(service, /catch\s*\{\s*return \[\];|return \[\];/,
  'a failed read shows no schedule rather than breaking the price tab');

// --- 3. The one-shot migration exists and is safe to run twice -----------------------------------
const applyFile = readdirSync(migrations).find((name) => /apply_and_clear_price_schedule/.test(name));
assert.ok(applyFile, 'the migration that makes the schedule one-shot is missing');
const apply = readFileSync(join(migrations, applyFile), 'utf8');
for (const needed of [
  /update public\.storefront_products/,
  /insert into public\.storefront_product_prices/,
  /delete from public\.storefront_price_schedule/,
]) {
  assert.match(apply, needed, `the apply migration is missing a step: ${needed}`);
}
// Every statement filtered on the date, so running it before the switch is a no-op and running it twice
// is a no-op. A delete without that filter would throw away a schedule that has not happened yet.
const statements = apply.split(';').filter((s) => /^\s*(update|insert|delete)\s/im.test(s));
assert.equal(statements.length, 3, `expected three write statements, found ${statements.length}`);
for (const statement of statements) {
  assert.match(statement, /effective_at <= now\(\)/,
    `a write without the date filter would touch a schedule that has not arrived:\n${statement.trim().slice(0, 120)}`);
}
// Variants are matched by id. Matching by position would move the price onto the wrong bottle the day a
// product grows a second size.
assert.match(apply, /elem->>'id' = d\.variant_id/,
  'the retail update must find the variant by id, never by position');
assert.doesNotMatch(apply, /tier = 'retail'[\s\S]{0,200}insert into public\.storefront_product_prices/,
  'retail must not be inserted into storefront_product_prices — its CHECK forbids that tier');

console.log('aScheduledPriceIsVisible OK (the schedule is one-shot, and the price tab says so either way)');
