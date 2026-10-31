// `node src/utils/theCatalogueCanBeSkippedPast.selfcheck.mjs`
//
// Twenty-six tab stops stood between the top of the catalogue and the first bottle.
//
// Counted on the built site, 2026-10-23, by walking the focusable elements in order: the header (7),
// six category pills, the search box, thirteen wear chips. A keyboard or switch user who came to
// BROWSE rather than filter paid all twenty-six, on every visit. The product page was fine — six stops
// — so this is the catalogue's problem alone, which is why the link is only there.
//
// Both shops Dekito pointed at ship this ("SKIP TO RESULTS LIST"). It is the one piece of their markup
// that is purely a kindness, and it costs a mouse user nothing because it is off-screen until focused.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// One catalogue serves every screen since the phone storefront retired (2026-10-31).
const pages = [
  ['CatalogPage.jsx', read('pages', 'CatalogPage.jsx')],
];

// --- 1. Both catalogues offer it, through one component ---------------------------------------------
for (const [name, page] of pages) {
  assert.match(page, /<SkipToResults/, `${name} leaves a keyboard user to tab through every filter`);
  assert.match(page, /import SkipToResults from '@\/components\/storefront\/SkipToResults\.jsx'/,
    `${name} must use the shared component rather than its own anchor`);
  // Before the filters, or it skips nothing.
  assert.ok(page.indexOf('<SkipToResults') < page.search(/catalog-pills|m-editorial-catalog-pills|ng-filter/),
    `${name} puts the skip link after the filters, so it skips nothing`);
}

// --- 2. The target exists and TAKES FOCUS ------------------------------------------------------------
// The half that is usually forgotten: without tabIndex={-1} the browser scrolls to the grid and leaves
// focus at the top, so the next Tab goes back to the filters and the link has achieved nothing.
for (const [name, page] of pages) {
  assert.match(page, /id="catalog-results" tabIndex=\{-1\}/,
    `${name} has no focusable target, so the skip link only scrolls`);
}
const component = read('components', 'storefront', 'SkipToResults.jsx');
assert.match(component, /href=\{`#\$\{targetId\}`\}/, 'the link must point at the target id');

// --- 3. Invisible until focused, and it does come back ------------------------------------------------
const css = readFileSync(join(src, 'styles', 'storefront.css'), 'utf8');
const rule = css.slice(css.indexOf('.skip-to-results {'), css.indexOf('#catalog-results:focus'));
assert.ok(rule.length > 0, 'the skip link is rendered but never styled');
assert.match(rule, /position: fixed/,
  'a statically positioned skip link pushes the toolbar down when it appears');
assert.match(rule, /top: -\d+px/, 'it must start off-screen, or every visitor sees it');
assert.match(rule, /:focus[\s\S]*top: \d+px/,
  'and it must come back on focus, or it is unreachable rather than merely hidden');

// --- 4. Copy in both shops ---------------------------------------------------------------------------
const messages = read('i18n', 'messages.js');
const carrying = messages.split('\n').filter((line) => line.includes('catalog.skipToResults'));
assert.equal(carrying.length, 2, `catalog.skipToResults must exist in both shops; found ${carrying.length}`);

console.log('theCatalogueCanBeSkippedPast OK (one link past twenty-six tab stops, on the catalogue)');
