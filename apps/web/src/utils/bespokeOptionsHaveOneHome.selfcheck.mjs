// `node src/utils/bespokeOptionsHaveOneHome.selfcheck.mjs`
//
// What a bespoke bottle costs is built from four option lists — bottleSizes, bottleTypes, capDesigns,
// labelDesigns — and bespokeFloorPrice sums the cheapest enabled option in each. That makes those lists
// a PRICE LIST, and a price list needs one home.
//
// It had two. data/storefront.js carried a second set of bespoke option lists that nothing imported:
//
//   bespokeBottleSizeOptions   30 ml Rp 350.000, 50 ml Rp 500.000
//   the live table            30 ml Rp 240.000, 50 ml Rp 395.000
//
// 46% high on the smaller bottle, for options the shop no longer sells either ("Cap biasa", "Cap batu",
// "Cap custom akrilik" against the live "Cap Basic" and "Cap custom Abstrak"). Dead code that reads like
// the price list.
//
// One of those dead lists has already reached a buyer's order. bespokeBudgetOptions held exactly one
// string — "Budget otomatis mengikuti ukuran, cap, dan material tambahan." — the form's own helper
// sentence, and on production one of the 17 bespoke orders carries that sentence as its BUDGET. The
// field captured its own hint, and the list that did it was still sitting in the repo with no callers.
//
// Seven dead exports deleted. bespokeOccasionOptions stays: 7 callers, and its own comment explains why
// its stored value must remain Indonesian while the label is translated.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bespokeFloorPrice, cheapestEnabled } from './bespokeOrder.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry) && !entry.includes('.selfcheck.')) files.push(full);
  }
};
walk(root);
assert.ok(files.length > 100, `only ${files.length} files scanned — the walk is broken, not the code`);

// ── 1. The fallback is the only in-repo price list ───────────────────────────────────────────────
// Parsed out of the service rather than imported: bespokeSettingsService reaches supabase.
const service = readFileSync(join(root, 'services', 'bespokeSettingsService.js'), 'utf8');
const fallbackBlock = service.match(/export const defaultBespokeSettings = \{([\s\S]*?)\n\};/);
assert.ok(fallbackBlock, "could not find defaultBespokeSettings — this guard's parse is broken, not the service");

// Every other file: no bespoke option list carrying a price. One priced list, one home.
for (const file of files) {
  const where = file.replace(`${root}/`, '');
  if (where === 'services/bespokeSettingsService.js') continue;
  const source = stripComments(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(/export const (bespoke\w*Options) = \[([\s\S]*?)\n\];/g)) {
    assert.ok(
      !/\bprice:/.test(match[2]),
      `${where} exports ${match[1]} with prices in it. What a bespoke bottle costs comes from `
      + 'storefront_bespoke_options and its fallback in bespokeSettingsService — a second priced list is '
      + 'how 30 ml came to be written down twice, at Rp 240.000 and at Rp 350.000',
    );
  }
}

// ── 2. The seven dead lists stay deleted ─────────────────────────────────────────────────────────
// Named one at a time, because each is a specific thing that was wrong: stale prices, options no longer
// sold, and a helper sentence that became a buyer's budget.
const DELETED = {
  bespokeBottleSizeOptions: 'prices 46% above the live ones',
  bespokeCapDesignOptions: 'cap options the shop no longer sells',
  bespokeBudgetOptions: "the form's helper sentence, which is a BUDGET on one live order",
  bespokeExoticMaterialOptions: 'an empty list nothing read',
  bespokeMoodOptions: 'moods nothing read, in the wrong language for what orders carry',
  bespokeSizeOptions: 'derived from a dead list',
  bespokeCapOptions: 'derived from a dead list',
};
const storefrontData = readFileSync(join(root, 'data', 'storefront.js'), 'utf8');
for (const [name, why] of Object.entries(DELETED)) {
  assert.ok(
    !new RegExp(`export const ${name}\\b`).test(storefrontData),
    `${name} is back in data/storefront.js — it was deleted because of ${why}`,
  );
  // And nothing may import it from anywhere else either.
  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'));
    assert.ok(
      !new RegExp(`\\b${name}\\b`).test(source),
      `${file.replace(`${root}/`, '')} refers to ${name}, which was deleted (${why})`,
    );
  }
}

// The one that stays, stays. 7 callers, and its value must remain Indonesian.
assert.match(storefrontData, /export const bespokeOccasionOptions = \[/,
  'bespokeOccasionOptions is the live list and must not be deleted with the dead ones');
assert.match(storefrontData, /\{ value: 'Harian', labelKey: 'bsp\.occ\.harian' \}/,
  "the occasion list must keep its value/labelKey split — the VALUE is what an order records");

// ── 3. A failed settings fetch may not quote a component as free ─────────────────────────────────
// bespokeFloorPrice sums the cheapest enabled option of four collections, and cheapestEnabled([])
// answers {} — whose price reads as 0. So an empty collection in the fallback silently makes that part
// of a bespoke bottle free, on exactly the path taken when the database cannot be reached.
const fallbackCollections = [...fallbackBlock[1].matchAll(/^\s{2}(\w+): \[([\s\S]*?)\n\s{2}\]/gm)]
  .map(([, key, body]) => [key, body]);
const PRICED = ['bottleSizes', 'bottleTypes', 'capDesigns', 'labelDesigns'];
for (const key of PRICED) {
  const entry = fallbackCollections.find(([name]) => name === key);
  assert.ok(entry, `the fallback has no ${key}, so a failed fetch would offer that part of the bottle free`);
  const enabled = [...entry[1].matchAll(/enabled: true/g)].length;
  assert.ok(enabled >= 1, `the fallback's ${key} has no enabled option, so its price falls to 0`);
}

// Run the arithmetic the page runs, over the fallback as written.
assert.equal(cheapestEnabled([]).price, undefined, 'an empty collection has no price — this is the hazard above');
assert.equal(Number(cheapestEnabled([]).price || 0), 0, 'and it reads as free');
const sample = {
  bottleSizes: [{ price: 240000, enabled: true }, { price: 395000, enabled: true }],
  bottleTypes: [{ price: 10000, enabled: true }, { price: 50000, enabled: true }],
  capDesigns: [{ price: 50000, enabled: true }, { price: 5000, enabled: true }],
  labelDesigns: [{ price: 0, enabled: true }, { price: 75000, enabled: true }],
};
assert.equal(bespokeFloorPrice(sample), 255000,
  'the floor is the sum of the cheapest enabled option in each priced collection');
assert.equal(bespokeFloorPrice({}), 0, 'and with no settings at all it is 0, which is why section 3 exists');

console.log(`bespokeOptionsHaveOneHome: ok — ${Object.keys(DELETED).length} dead lists stay deleted, one priced home, ${PRICED.length} collections that cannot fall to free`);
