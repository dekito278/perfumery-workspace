// `node src/utils/oneCartLineRule.selfcheck.mjs`
//
// On 2026-10-07 the `notes` field became the full material list — the Bortnikoff format Dekito asked
// for. Right for the field, too long for a line beside a price: Pantura is twelve notes, about 120
// characters, and the cart line reads "{notes} · {size}", so the size was pushed off the end of the
// row on a phone.
//
// Four cart pages were rendering that one value three different ways. The two desktop carts printed
// it whole; the Indonesian phone cart clamped it to two lines in CSS, which is a different answer
// that also hides the text from anyone copying it; the English phone cart showed nothing at all.
// Nobody chose three behaviours — they accumulated, which is this repo's documented failure mode:
// "the two-copy habit in this repo is where five separate fixes went to one side and not the other."
//
// The rule: a cart line that shows a product's notes shows them through shortNoteList. Found by
// WALKING the pages rather than listing them, so a fifth cart inherits the rule the day it is added.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { shortNoteList, CART_LINE_NOTE_LIMIT, withoutNotesHeading } from './shortNoteList.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// --- 1. The rule itself, run ---------------------------------------------------------------------------
assert.equal(shortNoteList('Green, Wet Moss, Leather Accord, Smoky Accord, Animalic Accord, Earthy'),
  'Green, Wet Moss, Leather Accord…');
assert.equal(shortNoteList('Orange, Lime, Bergamot, Sea Salt Accord, Green, Solar Note, Floral, Bitter, Smoky Accord, Amber, Amberwood F, Musk Accord'),
  'Orange, Lime, Bergamot…', 'Pantura is the longest list in the shop and the reason this exists');
// A list that already fits keeps every note AND gains no ellipsis — an ellipsis promising more when
// there is no more is its own small lie.
assert.equal(shortNoteList('Nectar, Rose, Musk Accord'), 'Nectar, Rose, Musk Accord');
assert.equal(shortNoteList('Lime, Amberwood F, Vetiver'), 'Lime, Amberwood F, Vetiver');
// Exactly at the limit, and one past it.
assert.equal(shortNoteList('a, b, c'), 'a, b, c');
assert.equal(shortNoteList('a, b, c, d'), 'a, b, c…');
// Not a list: the short summaries this field used to hold, and anything hand-typed.
assert.equal(shortNoteList('Swampy green'), 'Swampy green');
// Nothing at all, in every shape a missing field arrives in.
for (const empty of ['', '   ', ',,', null, undefined]) assert.equal(shortNoteList(empty), '');
// Ragged spacing and a trailing comma must not produce a blank note or a doubled separator.
assert.equal(shortNoteList('Green ,  Wet Moss ,'), 'Green, Wet Moss');
assert.equal(shortNoteList('Green, Wet Moss, Leather, Smoky', 2), 'Green, Wet Moss…');
assert.ok(CART_LINE_NOTE_LIMIT >= 2 && CART_LINE_NOTE_LIMIT <= 5,
  `a cart line showing ${CART_LINE_NOTE_LIMIT} notes is either uselessly short or back to the whole list`);

// --- 2. Every cart page obeys it, found by walking ------------------------------------------------------
const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return /\.jsx$/.test(entry) ? [full] : [];
});
const carts = walk(join(src, 'pages')).filter((file) => /Cart\w*\.jsx$/.test(file));
assert.ok(carts.length >= 4,
  `expected the cart pages, found ${carts.length} — the scan is broken, not the code`);

const showing = [];
for (const file of carts) {
  const source = stripComments(readFileSync(file, 'utf8'));
  // Every place the page renders a line's notes into JSX.
  const renders = [...source.matchAll(/\{[^{}]*\b(?:item|line|product)\.notes\b[^{}]*\}/g)].map((m) => m[0]);
  if (!renders.length) continue;
  showing.push(relative(src, file));
  for (const render of renders) {
    assert.match(render, /shortNoteList\(/,
      `${relative(src, file)} prints a line's notes without shortening them: ${render.trim()}\n  `
      + 'Twelve notes and a size do not fit on one row beside a price');
  }
  // And not by hiding the overflow instead, which is the other answer that was in here. Scoped to the
  // LINE that renders the notes: these pages also clamp a long product NAME to two lines, which is a
  // different element and a reasonable thing to do.
  for (const line of source.split('\n')) {
    if (!/\b(?:item|line|product)\.notes\b/.test(line)) continue;
    assert.doesNotMatch(line, /WebkitLineClamp/,
      `${relative(src, file)} clamps the notes line in CSS as well — one rule, not two, or the carts `
      + `drift again:\n  ${line.trim().slice(0, 140)}`);
  }
}
assert.ok(showing.length >= 3,
  `only ${showing.length} cart page(s) show notes at all; expected the rule to bind on at least three`);

// --- 3. THE FIELD AS IT ACTUALLY ARRIVES ---------------------------------------------------------------
// Every fixture above is a bare list — which is what the field was ASSUMED to hold. Production holds a
// heading: 38 of the 39 filled values read "Fragrance Notes: Green, Wet Moss, …", in both language
// columns. Split on the comma, the heading is glued to the first note and takes one of the three slots,
// so the Indonesian cart line read "Fragrance Notes: Metallic Accord, Medicinal, Milky…" — an English
// label standing where a note should be. Indexed, it made "fragrance" and "notes" match all 19
// perfumes, and "notes" is the word the search box's own placeholder suggests.
assert.equal(withoutNotesHeading('Fragrance Notes: Metallic Accord, Medicinal, Milky, Powdery, Musk Accord'),
  'Metallic Accord, Medicinal, Milky, Powdery, Musk Accord');
assert.equal(shortNoteList(withoutNotesHeading('Fragrance Notes: Metallic Accord, Medicinal, Milky, Powdery, Musk Accord')),
  'Metallic Accord, Medicinal, Milky…', 'three notes, none of them a label');
// Case and spacing as a human would type them, and the heading only at the START.
assert.equal(withoutNotesHeading('fragrance notes:Green, Moss'), 'Green, Moss');
assert.equal(withoutNotesHeading('  Fragrance   Notes :  Green'), 'Green');
assert.equal(withoutNotesHeading('Green, Fragrance Notes: Moss'), 'Green, Fragrance Notes: Moss',
  'only a leading heading is a heading — a note that happens to contain the words is a note');
// The one row in the shop without the heading is the gift vial, whose notes are a sentence. It must
// come back untouched.
assert.equal(withoutNotesHeading('Vial 2 ml hadiah, satu per order, dipilih pembeli'),
  'Vial 2 ml hadiah, satu per order, dipilih pembeli');
for (const empty of ['', null, undefined]) assert.equal(withoutNotesHeading(empty), '');

// It comes off ONCE, where the database row is mapped, so the cart line, the catalogue search index and
// the bespoke reference all get the notes rather than a label glued to the first one. A fix in the cart
// alone would have left the search matching everything.
const mapper = stripComments(readFileSync(join(src, 'services', 'productCatalogService.js'), 'utf8'));
const rowMap = mapper.slice(mapper.indexOf('const fromDatabaseRow'));
for (const [field, column] of [['notes', 'row.notes'], ['notesEn', 'row.notes_en']]) {
  const line = rowMap.match(new RegExp(`\\b${field}:\\s*([^,\\n]+)`));
  assert.ok(line, `fromDatabaseRow no longer maps ${field} — this check reads it out of the mapper`);
  assert.match(line[1], /withoutNotesHeading\(/,
    `fromDatabaseRow passes ${column} through as-is, so the heading reaches the cart line AND the search index`);
}

console.log(`oneCartLineRule selfcheck OK (${CART_LINE_NOTE_LIMIT} notes per line, ${showing.length} of `
  + `${carts.length} cart pages show them, all through one helper: ${showing.join(', ')})`);
