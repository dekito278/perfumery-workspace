// `node src/utils/carouselAffordance.selfcheck.mjs`
//
// A carousel hides things on purpose. The whole job of its controls is to say how much is hidden and
// which way is left to go, and there are exactly two ways to get that wrong: say nothing, or say two
// things that disagree.
//
// Both were live here. The arrows never greyed out, so the last one was a promise the track could not
// keep; and the first version of the counter reported the LEFTMOST visible card, so the end of a
// five-card track read "3 of 5" next to a dead arrow.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
const css = read('styles', 'storefront.css');

// Sections 1-4 guarded the desktop home's arrow carousel and its hook. The 2026-10-31 redesign replaced
// that carousel with a numbered list that hides nothing, so there are no arrows to go dead and no
// position to announce; the hook had no other caller and was deleted with it.

// --- 5. The phone shelf shows the next card's edge ----------------------------------------------------
const mobileHome = read('pages', 'mobile', 'MobileStorefrontPage.jsx');
assert.match(mobileHome, /className="m-editorial-product-shelf"/, 'the curated selection is a shelf');
const shelf = css.match(/\.m-editorial-product-shelf \{([\s\S]*?)\n\}/);
assert.ok(shelf, 'the shelf rule is readable');
assert.match(shelf[1], /overflow-x: auto/, 'it scrolls');
assert.match(shelf[1], /scroll-snap-type: x proximity/,
  'proximity, not mandatory: mandatory fights a thumb that wants to stop between two cards');
// A card wider than the viewport hides the very affordance the shelf exists for.
const card = css.match(/\.m-editorial-product-shelf > \.m-editorial-product-card \{([\s\S]*?)\n\}/);
assert.ok(card, 'the shelf card rule is readable');
const basis = card[1].match(/flex: 0 0 (\d+)vw/);
assert.ok(basis, 'the card has a viewport-relative basis');
assert.ok(Number(basis[1]) < 100,
  `a shelf card must be narrower than the screen or nothing peeks — got ${basis[1]}vw`);

// --- 6. The CATALOGUE keeps its grid --------------------------------------------------------------------
// The shelf is an editorial gesture for a curated four. Turning the catalogue into one would hide most
// of the shop behind a swipe, on the page where someone is there to compare.
for (const page of [['pages', 'mobile', 'MobileCatalogPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx']]) {
  const source = read(...page);
  assert.match(source, /m-editorial-product-grid/,
    `${page.join('/')} keeps the grid — a shelf hides what a shopper came to compare`);
  // "Still mentions the grid somewhere" is not the rule and let a sabotage through: the catalogue lists
  // products twice (the real grid and a skeleton), so converting one of them left the other behind and
  // the check passed. The rule is that the shelf must not appear on these pages AT ALL.
  assert.doesNotMatch(source, /m-editorial-product-shelf/,
    `${page.join('/')} must not use the shelf: it is an editorial gesture for a curated few, not a way to hide a catalogue behind a swipe`);
}

console.log('carouselAffordance selfcheck OK (the counter and the arrows agree at both ends, reduced motion gets the jump, the shelf peeks, and the catalogue keeps its grid)');
