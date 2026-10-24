// `node src/utils/aFilterSaysWhatIsBehindIt.selfcheck.mjs`
//
// A filter pill that only names a category asks the buyer to spend a tap finding out whether anything
// is there — and sometimes the answer is nothing. Two Indonesian perfumeries Dekito pointed at on
// 2026-10-23 both put the number on the pill; the number is knowable before the tap, so it is shown.
//
// THE NUMBER HAS TO BE HONEST, which is the whole reason this file exists rather than a one-line map.
// Counting against the whole catalogue would show "FLORAL 8" to someone who has typed "vanilla" and
// would see two. So both catalogues split their filtering: everything except the category narrows the
// list, the pills count against THAT, and the category is applied last.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { catalogPillCounts, pillIsOffered } from './catalogFacets.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. The counting rule, run ---------------------------------------------------------------------
const matches = (product, category) => category === 'All' || product.category === category;
const shelf = [{ category: 'Floral' }, { category: 'Woody' }, { category: 'Floral' }];
assert.deepEqual(
  catalogPillCounts(shelf, ['All', 'Floral', 'Woody', 'Fresh'], matches),
  { All: 3, Floral: 2, Woody: 1, Fresh: 0 },
  'every pill is counted, including the ones with nothing behind them',
);
assert.deepEqual(catalogPillCounts([], ['All', 'Floral'], matches), { All: 0, Floral: 0 },
  'an empty shelf counts as zero rather than throwing');
assert.deepEqual(catalogPillCounts(null, null, matches), {}, 'and nothing at all is not a crash');

// "All" survives at zero because it is the way back out of a filter that found nothing. Disabling it
// would trap a buyer on an empty grid with no control that does anything.
assert.equal(pillIsOffered('All', 0), true, 'All is always offered — it is the way back');
assert.equal(pillIsOffered('Fresh', 0), false, 'a pill with nothing behind it is not a destination');
assert.equal(pillIsOffered('Fresh', 2), true);

// --- 1b. EVERY filter, not just the two catalogues ----------------------------------------------------
//
// The sentence at the top of this file is about "a filter pill". Until 2026-10-25 every check below it
// read two catalogue files BY NAME, and the public journal — which has a row of category tabs built
// straight from the five categories the editor offers — was never in scope. Live, it showed Formula
// Accord, Process and Product Idea with nothing behind any of them: three taps that each ended on an
// empty page, the exact thing #516 removed from the catalogue.
//
// Third time today that a guard's promise turned out to be wider than its subject. So the subject is
// derived: anything that renders a row of filter controls has to count and has to offer only what is
// there. Found by walking, so a fourth filter surface is covered the day it is written.
const walkPages = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name);
  if (entry.isDirectory()) return walkPages(full);
  return /\.jsx$/.test(entry.name) ? [full] : [];
});

// Detected by the filter-row classes, NOT by aria-pressed. The first version used aria-pressed and
// swept up the bespoke option pickers, the checkout payment chooser and the orders status tabs — those
// are CHOICES, where every option is meant to be selectable and "nothing behind it" is not a state
// they can be in. A filter row narrows a list; that is the thing this file is about.
const filterSurfaces = walkPages(join(src, 'pages'))
  .filter((file) => /className=\{?[`"'][^`"']*(catalog-pill|journal-tab|m-editorial-pill)/.test(readFileSync(file, 'utf8')))
  .map((file) => relative(src, file).split(sep).join('/'));

assert.ok(filterSurfaces.length >= 3,
  `only ${filterSurfaces.length} filter surfaces found — this walk is looking in the wrong place`);

const uncounted = filterSurfaces.filter((name) => {
  const body = readFileSync(join(src, name), 'utf8');
  return !/catalogPillCounts\(/.test(body) || !/pillIsOffered\(/.test(body);
});
assert.deepEqual(uncounted, [],
  'these render a row of filters without counting what is behind each one, so at least one of them '
  + 'can lead to an empty page that looked occupied:\n  ' + uncounted.join('\n  '));

// --- 2. Both catalogues count against the NARROWED list ---------------------------------------------
// The hazard is counting against `products`. Asserting the shape of the call is what catches a later
// edit that quietly passes the full shelf back in.
for (const [name, page] of [
  ['CatalogPage.jsx', read('pages', 'CatalogPage.jsx')],
  ['MobileCatalogPage.jsx', read('pages', 'mobile', 'MobileCatalogPage.jsx')],
]) {
  assert.match(page, /catalogPillCounts\(\s*narrowed/,
    `${name} must count the pills against the narrowed list, not the whole catalogue`);
  assert.match(page, /pillIsOffered\(/, `${name} must disable a pill with nothing behind it`);
  assert.doesNotMatch(page, /catalogPillCounts\(\s*products/,
    `${name} counts against the full shelf, so the numbers lie as soon as anyone searches`);
  // The category is applied AFTER the narrowing, or the two disagree about what a pill would show.
  assert.match(page, /narrowed[A-Za-z]*\.filter\(\(product\) => matchesCatalogCategory/,
    `${name} must apply the category to the narrowed list`);
}

// --- 3. The card says what it smells of, with the clamp the cart already uses ------------------------
for (const [name, page] of [
  ['CatalogPage.jsx', read('pages', 'CatalogPage.jsx')],
  ['MobileCatalogPage.jsx', read('pages', 'mobile', 'MobileCatalogPage.jsx')],
]) {
  assert.match(page, /shortNoteList\(product\.notes, CARD_NOTE_LIMIT\)/,
    `${name} must show the notes through the shared clamp, not its own slice`);
  assert.match(page, /const CARD_NOTE_LIMIT = 3;/, `${name} must name the limit rather than inline a 3`);
}

// --- 4. The styles exist for what the markup now renders ---------------------------------------------
// A class with no rule is a line of grey text at body size sitting under every product name.
const css = readFileSync(join(src, 'styles', 'storefront.css'), 'utf8');
// Matched to a BOUNDARY, not as a substring. The first version used includes(), and renaming
// `.catalog-card__notes` to `.catalog-card__notesXX` left it green — the old name is still inside the
// new one. A guard that passes on a renamed selector is checking nothing. No regex, because escaping
// a CSS selector into one is how the second version broke.
for (const selector of [
  '.catalog-pill__count', '.m-editorial-pill__count',
  '.catalog-card__notes', '.m-editorial-product-card__notes',
  '.catalog-pill:disabled',
]) {
  const styled = css.split(selector).slice(1).some((rest) => !/^[\w-]/.test(rest));
  assert.ok(styled, `${selector} is rendered but never styled`);
}

console.log('aFilterSaysWhatIsBehindIt OK (both catalogues count honestly, and a card says what it smells of)');
