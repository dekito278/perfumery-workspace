// `node src/utils/launchYearIsStatedNotGuessed.selfcheck.mjs`
//
// Fragrantica records a launch year for every fragrance it lists, and this shop had nowhere to put one.
//
// The danger is not the missing column, it is the column sitting next to it. `created_at` exists, looks
// like an answer, and means something else: when the ROW was made in this app. It ranges 2026-05-07 to
// 2026-09-20 across the nineteen products — years after some of these perfumes were composed. A year
// derived from it would fill a permanent public database with wrong data, confidently, and nobody
// reading the page afterwards could tell.
//
// So the rule has two halves, and the second is the one that bites: the year must be STATED, never
// derived; and the column must reach the BUYER, which an `alter table` alone does not do. A Postgres
// view freezes its column list at creation, so storefront_products_public — the view every shop page
// actually reads — would still not carry it. That trap is documented in 20260920170000, where `limited`
// hit it; this guard makes the next column fail here instead of in production.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const root = join(src, '..', '..', '..');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. The migration that adds it also recreates the view ----------------------------------------------
// Found by walking the migrations rather than naming one: whichever file introduces the column is the
// file that has to carry the view with it.
const migrationsDir = join(root, 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const adders = migrations.filter((name) => /add column if not exists launch_year|add column launch_year/i
  .test(readFileSync(join(migrationsDir, name), 'utf8')));
assert.equal(adders.length, 1,
  `expected exactly one migration to add launch_year, found ${adders.length}: ${adders.join(', ')}`);
const adder = readFileSync(join(migrationsDir, adders[0]), 'utf8');
assert.match(adder, /create or replace view public\.storefront_products_public/,
  `${adders[0]} adds launch_year to the table and never recreates storefront_products_public. A view `
  + 'freezes its column list at creation, so every shop page would read a view that does not have the '
  + 'column and the year would be invisible to every buyer — the exact trap 20260920170000 hit');
assert.match(adder, /grant select on public\.storefront_products_public to anon, authenticated/,
  `${adders[0]} recreates the view without re-granting it, so the shop reads it as nobody`);
assert.match(adder, /launch_year between 1900 and 2100|launch_year is null or/,
  'nothing stops a typo reaching a permanent public record');

// --- 2. No year is ever derived from created_at ---------------------------------------------------------
// The whole point. Checked across the app and the fill-in form, comments stripped so that writing ABOUT
// the trap stays legal while doing it does not.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return /\.(js|jsx|mjs)$/.test(entry.name) && !entry.name.includes('.selfcheck.') ? [full] : [];
});
// Aimed at the actual danger — a LAUNCH year taking its value from a creation timestamp — rather than
// at any year read off any date. The first version flagged batchesService, which builds a production
// batch code out of createdAt.getFullYear() + month + day + hour. That is a timestamp being formatted,
// has nothing to do with a fragrance, and a guard that cries about it is a guard somebody deletes.
const DERIVES = /launch_?[Yy]ear[^\n;]{0,90}created|created[^\n;]{0,90}launch_?[Yy]ear/;
const derived = [...walk(src), join(migrationsDir, adders[0]),
  join(root, 'supabase', 'manual', '20261009090100_launch_years_to_fill.sql')]
  .filter((file) => DERIVES.test(strip(readFileSync(file, 'utf8'))))
  .map((file) => file.replace(`${root}/`, '').replace(`${src}/`, ''));
assert.deepEqual(derived, [],
  `a launch year is being derived from created_at in: ${derived.join(', ')}. That column is when the row `
  + 'was made in this app, not when the perfume was released — years apart on the older compositions');
const form = readFileSync(join(root, 'supabase', 'manual', '20261009090100_launch_years_to_fill.sql'), 'utf8');
const filled = [...form.matchAll(/set launch_year = (\w+)/g)].map((match) => match[1]);
assert.equal(filled.length, 19, `the fill-in form has ${filled.length} products, expected 19`);
// The form may carry a year, but only ONE, and only one somebody said out loud.
//
// It arrived all-NULL and stayed that way until Dekito answered on 9 Oct 2026 — "Rilis dari 2023" —
// so every line now reads 2023. That is his blanket answer applied to all nineteen, which is a
// different thing from nineteen years invented one at a time: the moment two different years appear
// in this file, somebody has decided per-product what only he can know. NULL stays allowed, because a
// line he has not settled shows no year at all rather than a guess.
const years = [...new Set(filled)].filter((value) => value !== 'NULL');
assert.ok(years.length <= 1,
  `the form holds ${years.length} different years (${years.join(', ')}). One stated year applied to all `
  + 'is an answer; several are per-product guesses, and a wrong one is permanent in Fragrantica');
for (const year of years) {
  assert.match(year, /^20\d\d$/, `"${year}" is not a year`);
  assert.ok(form.includes(year) && /Dekito|Rilis dari/.test(form),
    `the form fills in ${year} without saying whose answer that is — a year in this file has to be `
    + 'traceable to the person who stated it, or the next reader cannot tell it from a guess');
}
assert.match(form, /CHANGE THE ONES THAT ARE LATER|ubah yang/i,
  'a blanket year has to say out loud that it is a floor, not a fact about every bottle');

// --- 3. The shop carries it from the row to the page, both ways and both screens ------------------------
// FOUR hand-written allowlists stand between the database row and the screen, and the field has to be
// named in every one. It was added to the first, shipped, and never appeared: the column was in the
// table, in the buyer's view and in fromDatabaseRow, and normalizeProduct — which rebuilds the object
// from a list of fields it names — dropped it one hop later. Then getPublicFragranceCatalog dropped it
// again. Each was found by looking at the page and not seeing a year, one hop at a time.
//
// So this checks the WHOLE chain rather than its first link. A fifth mapper added later fails here.
const CHAIN = [
  ['services/productCatalogService.js', /launchYear: row\.launch_year/,
    'fromDatabaseRow does not read the column'],
  ['services/productCatalogService.js', /launchYear: input\.launchYear/,
    'normalizeProduct rebuilds the product from a named list and drops the year one hop after it is read'],
  ['services/productCatalogService.js', /launch_year: product\.launchYear/,
    'a year typed in the studio would be dropped on save — read and never written back'],
  ['data/publicStorefront.js', /launchYear: product\.launchYear/,
    'the public mapper the product pages read through does not carry it, so no page can show it'],
];
for (const [file, pattern, why] of CHAIN) {
  assert.match(strip(read(...file.split('/'))), pattern, `${file}: ${why}`);
}
const service = strip(read('services', 'productCatalogService.js'));
for (const page of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx']]) {
  const source = strip(read(...page));
  assert.match(source, /product\.launchYear \?/,
    `${page.join('/')} does not show the year, and the other product page does — the two-copy habit`);
  assert.match(source, /t\('pdp\.released'/, `${page.join('/')} prints the year without a translated label`);
}
for (const shop of ['id', 'en']) {
  const label = MESSAGES[shop]['pdp.released'];
  assert.ok(label && label.includes('{year}'),
    `pdp.released is missing its {year} placeholder in ${shop}, so the line would show a label and no year`);
}
assert.notEqual(MESSAGES.id['pdp.released'], MESSAGES.en['pdp.released'],
  'the English shop is the one a fragrance database reads; it must not be left in Indonesian');

console.log(`launchYearIsStatedNotGuessed selfcheck OK (${adders[0]} adds the column AND recreates the `
  + 'buyer\'s view, 19 products await a year nobody has guessed, both product pages show it once stated)');
