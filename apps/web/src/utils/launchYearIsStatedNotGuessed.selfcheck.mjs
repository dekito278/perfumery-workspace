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
import { BRAND_PROFILE } from '../data/brandProfile.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const FOUNDED_YEAR = BRAND_PROFILE.foundedYear;
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
// --- 2b. A brand's founding year is not a perfume's launch year ----------------------------------------
//
// I got this wrong and shipped it. Asked on 9 Oct 2026 what year to use, Dekito said "Rilis dari 2023";
// I read that as a blanket answer about all nineteen releases and wrote 2023 to every row. He corrected
// it on 11 Oct: "kok rilis parfum saya 2023 semua. Gak gitu loh maksud saya brand yg berdiri sejak 2023.
// Kalo variannya mah beda2." The house started in 2023; the bottles came out in different years.
//
// So the earlier version of this guard had the rule inverted — it allowed at most ONE distinct year and
// called several "per-product guesses". Several different years is now the only correct state, and the
// mistake is the blanket one.
const SUPERSEDED = '20261009090100_launch_years_to_fill.sql';
const LIVE_FORM = '20261011080000_launch_years_are_per_perfume.sql';
const manualDir = join(root, 'supabase', 'manual');
const superseded = readFileSync(join(manualDir, SUPERSEDED), 'utf8');
assert.match(superseded, /SUPERSEDED/,
  `${SUPERSEDED} wrote 2023 to all nineteen on a misreading. It has been run; it must stay marked so it `
  + 'is never run again');
assert.ok(superseded.includes(LIVE_FORM),
  `${SUPERSEDED} must point at its replacement, or the next reader fills in the wrong file`);

const form = readFileSync(join(manualDir, LIVE_FORM), 'utf8');
const statements = [...form.matchAll(/set launch_year = (\w+) where slug = '([^']+)'/g)];
assert.equal(statements.length, 19, `the fill-in form has ${statements.length} per-product lines, expected 19`);
// The years are in, and they are Dekito's own: given per perfume on 11 Oct 2026, eleven from 2025 and
// eight from 2026. So these lines are live SQL now rather than a blank form — what has to hold is that
// each one carries a real year or an honest NULL, and that the file says whose answer it is.
const filledYears = [];
for (const [, year, slug] of statements) {
  if (year === 'NULL') continue;
  assert.match(year, /^20\d\d$/, `"${year}" is not a year (${slug})`);
  filledYears.push(Number(year));
}
assert.ok(filledYears.length >= 1, 'the file sets no year at all — it exists to carry the ones Dekito gave');
assert.ok(
  /Dekito/.test(form) && /11 Oktober 2026|2026-10-11/.test(form),
  'a year in this file has to be traceable to the person who stated it and when, or the next reader '
  + 'cannot tell it from a guess',
);

// A BLANKET year is the mistake this guard exists for: one year written across every perfume because
// somebody read "rilis dari 2023" as an answer about all nineteen. Two or more distinct years is what
// per-product looks like.
const distinctYears = [...new Set(filledYears)];
assert.ok(
  distinctYears.length >= 2 || filledYears.length < 10,
  `all ${filledYears.length} perfumes in this file share the year ${distinctYears[0]}. One year applied `
  + 'to every bottle is the blanket mistake Dekito corrected on 11 Oct 2026 — the perfumes came out in '
  + 'different years',
);
// And the clearing half must really clear all nineteen, or the wrong years stay on the pages.
const clearing = form.match(/set launch_year = null\s*\nwhere slug in \(([\s\S]*?)\);/);
assert.ok(clearing, 'the form must still clear the years it exists to undo');
assert.equal([...clearing[1].matchAll(/'([^']+)'/g)].length, 19,
  'the clearing statement must name all nineteen products');

// Nothing anywhere may fill a launch year from the BRAND's founding year. They are different facts and
// they live in different places on purpose: foundedYear in src/data/brandProfile.js, launch_year on the
// product row.
const BRAND_LEAK = /launch_?[Yy]ear[^\n;]{0,80}(foundedYear|BRAND_PROFILE)|(foundedYear|BRAND_PROFILE)[^\n;]{0,80}launch_?[Yy]ear/;
const leaking = walk(src).filter((file) => BRAND_LEAK.test(strip(readFileSync(file, 'utf8'))))
  .map((file) => file.replace(`${src}/`, ''));
assert.deepEqual(leaking, [],
  `a launch year is being taken from the brand's founding year in: ${leaking.join(', ')}. The house `
  + 'started in 2023; the bottles did not all come out then');

// The Fragrantica submission may not carry one year on every fragrance either — that is the same
// mistake, in the document that goes somewhere permanent.
const submission = readFileSync(join(root, 'docs', 'fragrantica-submission.txt'), 'utf8');
const launched = [...submission.matchAll(/^\s*Launched\s+(.+)$/gm)].map((match) => match[1].trim());
assert.ok(launched.length >= 19, `the submission lists ${launched.length} launch lines, expected at least 19`);
const yearCounts = {};
for (const value of launched) {
  const year = value.match(/^(20\d\d)$/)?.[1];
  if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
}
// Two tests, and neither is "fewer than ten share a year" — eleven of the nineteen really are 2025.
//
// What must not happen is ONE year on all of them, which is how the brand's founding year got written
// nineteen times, and no fragrance may carry the founding year at all: Dekito's perfumes are 2025 and
// 2026, and 2023 in a Launched line would mean the old mistake came back.
const submissionYears = [...new Set(Object.keys(yearCounts))];
assert.ok(
  submissionYears.length >= 2,
  `every fragrance in the submission says ${submissionYears[0]}. One year on all nineteen is the blanket `
  + 'mistake; a wrong year in Fragrantica is permanent',
);
assert.ok(
  !submissionYears.includes(String(FOUNDED_YEAR)),
  `a fragrance in the submission claims to have launched in ${FOUNDED_YEAR}, which is when the HOUSE `
  + 'started. That is the mistake Dekito corrected on 11 Oct 2026',
);
// And every fragrance has one, so none goes to Fragrantica with a placeholder where a year belongs.
assert.equal(
  Object.values(yearCounts).reduce((sum, count) => sum + count, 0),
  launched.length,
  'a Launched line in the submission is not a year — fill it in or delete the line before posting',
);

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
  + `buyer's view, ${filledYears.length} per-perfume years from Dekito across ${distinctYears.length} `
  + 'different years, both product pages show it once stated)');
