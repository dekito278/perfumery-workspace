// Buyer quotes: pasted, never generated, and silent when there are none.
//
// Dekito chose quotes over a review system on 25 Oct against this shop's own numbers: 35 orders ever,
// 24 paid, four buyers on the best-selling perfume. A form with stars would, at full participation, put
// 4 reviews on the best page and 0 or 1 on most, and "Ulasan (0)" on 14 of 18 product pages announces
// that nobody has bought.
//
// Two things this guard holds, and they matter in different ways:
//
//   1. NOTHING IN THIS REPO MAY INVENT A QUOTE. A fabricated customer sentence is a fake review whatever
//      it is called — a placeholder, a sample, a demo seed. There is no honest version of it, so there
//      must be no code path that writes one and no fixture that looks like one.
//   2. An empty column shows NOTHING. Not a heading, not an empty state, not "be the first to review".
//      Silence is the design while the real number is four.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noteSkip } from '../../tools/selfcheckSubject.mjs';
import { TESTIMONIAL_LIMITS, normalizeTestimonials, testimonialAttribution } from './productTestimonials.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');
// Comments stripped before any pattern check. The first version refused its OWN docstring: the sentence
// "Nothing in this repo may generate one" matched the rule against offering to generate one. A guard a
// comment can trip is a guard that reads prose, which is twice wrong — it fails on the explanation and
// it would pass on a file that only describes itself correctly.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const component = stripComments(read('../components/storefront/ProductTestimonials.jsx'));
const field = stripComments(read('../components/product/TestimonialsField.jsx'));

// --- 1. The rule, RUN ---------------------------------------------------------------------------------
assert.deepEqual(normalizeTestimonials(null), [], 'a column that is still null is an empty list, not a crash');
assert.deepEqual(normalizeTestimonials('bukan array'), [], 'and neither is a string');
assert.deepEqual(normalizeTestimonials([{ name: 'Rina', city: 'Bandung' }]), [],
  'a name with no quote is not a testimonial — it would render as an empty card with someone under it');
assert.deepEqual(
  normalizeTestimonials([{ quote: '  wanginya   tahan \n seharian  ', name: ' Rina ', city: '' }]),
  [{ quote: 'wanginya tahan seharian', name: 'Rina', city: '' }],
  'whitespace from a paste is collapsed, and an unstated city stays empty rather than guessed',
);
assert.deepEqual(normalizeTestimonials([{ quote: 'bagus' }]), [{ quote: 'bagus', name: '', city: '' }],
  'a buyer who did not want their name printed still said the thing');

// The caps are real, not decorative: one pasted wall of text must not push add-to-cart off the screen.
const long = normalizeTestimonials([{ quote: 'x'.repeat(5000), name: 'y'.repeat(500), city: 'z'.repeat(500) }])[0];
assert.equal(long.quote.length, TESTIMONIAL_LIMITS.quote);
assert.equal(long.name.length, TESTIMONIAL_LIMITS.name);
assert.equal(long.city.length, TESTIMONIAL_LIMITS.city);
assert.equal(
  normalizeTestimonials(Array.from({ length: 40 }, (_, i) => ({ quote: `q${i}` }))).length,
  TESTIMONIAL_LIMITS.count,
  'the count is capped too',
);

// Order is the order he pasted them in. A shuffle would make the page different on every render.
assert.deepEqual(
  normalizeTestimonials([{ quote: 'satu' }, { quote: 'dua' }, { quote: 'tiga' }]).map((row) => row.quote),
  ['satu', 'dua', 'tiga'],
);

assert.equal(testimonialAttribution({ name: 'Rina', city: 'Bandung' }), 'Rina, Bandung');
assert.equal(testimonialAttribution({ name: 'Rina' }), 'Rina');
assert.equal(testimonialAttribution({ city: 'Bandung' }), 'Bandung');
assert.equal(testimonialAttribution({}), '', 'nothing to print means nothing printed, not a stray comma');

// --- 2. Nothing invents a quote -----------------------------------------------------------------------
// A placeholder attribute is the input's own hint and never becomes data; a VALUE is what would.
const QUOTE_SHAPED = /(quote|text)\s*:\s*['"`][^'"`]{12,}/;
for (const [what, source] of [['the storefront block', component], ['the Studio field', field]]) {
  assert.doesNotMatch(source, QUOTE_SHAPED, `${what} carries a hardcoded sentence that could reach a page as data`);
  assert.doesNotMatch(source, /sample|contoh kutipan|dummy|lorem|generate/i, `${what} offers to invent one`);
}
assert.doesNotMatch(stripComments(read('./productTestimonials.js')), QUOTE_SHAPED, 'the rule file holds no quote of its own');

// --- 3. Empty means silent ----------------------------------------------------------------------------
assert.match(component, /if \(!quotes\.length\) return null;/,
  'with nothing to show the block must render nothing — no heading, no empty state');
assert.doesNotMatch(component, /emptyState|beFirst|jadilah yang pertama|no reviews/i,
  'and it must not frame the emptiness either');

// --- 4. The quotes are printed, not translated --------------------------------------------------------
// A buyer's own words are not interface copy. Only the heading above them goes through t().
assert.match(component, /\{row\.quote\}/, 'the quote is printed as written');
assert.doesNotMatch(component, /t\(row\.|t\(`\$\{row/, 'a buyer sentence must never be looked up as a message key');
assert.equal((component.match(/t\('[a-z.]+'\)/g) || []).length, 1, 'exactly one translated string: the heading');

// --- 5. It is on every product page -------------------------------------------------------------------
const PAGES = path.resolve(HERE, '../pages');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const productPages = walk(PAGES).filter((file) => /ProductDetailPage\.jsx$/.test(path.basename(file)));
assert.ok(productPages.length >= 2, `only ${productPages.length} product page(s) found — the walk lost them`);
for (const file of productPages) {
  assert.match(fs.readFileSync(file, 'utf8'), /<ProductTestimonials[\s/>]/,
    `${path.basename(file)} does not show the quotes, so they would be typed and never read`);
}

// --- 6. The migration adds the column AND rebuilds the view that forgot -------------------------------
// supabase/migrations sits outside apps/web, which is all Vercel checks out, so this part runs on a
// developer machine and nowhere else. Tested by whether the SQL is READABLE, not by whether the folder
// exists — Vercel keeps the directory and strips the contents.
const MIGRATIONS = path.resolve(HERE, '../../../../supabase/migrations');
const sqlFiles = fs.existsSync(MIGRATIONS) ? fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')) : [];
if (!sqlFiles.length) {
  noteSkip('supabase/migrations is outside the build checkout (Vercel takes apps/web only), so the '
    + 'migration half of this chain runs on a developer machine and nowhere else');
} else {
  const mine = sqlFiles.filter((file) => /buyer_quotes/.test(file));
  assert.equal(mine.length, 1, 'the buyer-quotes migration is missing — the column the code writes would not exist');
  const sql = fs.readFileSync(path.join(MIGRATIONS, mine[0]), 'utf8');
  assert.match(sql, /add column if not exists testimonials jsonb/, 'it must add the column');
  assert.doesNotMatch(sql, /insert into public\.storefront_products/i, 'and it must not seed a single quote');

  // The reserve bug this migration also closes: the public view is built with jsonb_populate_record, so
  // its column list froze when it was created. 20261024090000 added `reserve` to the table and left the
  // view one column behind, which made isReserveProduct() false for every storefront reader.
  assert.match(sql, /create or replace view public\.storefront_products_public/,
    'recreating the public view is not housekeeping here: without it the storefront cannot read the new '
    + 'column at all, exactly as it still cannot read `reserve`');
  assert.match(sql, /grant select on public\.storefront_products_public to anon, authenticated/,
    'a recreated view needs its grant again, or the storefront reads nothing at all');
}
