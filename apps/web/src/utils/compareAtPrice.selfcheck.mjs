// `node src/utils/compareAtPrice.selfcheck.mjs`
//
// PriceNote renders a struck-through price only when it is ABOVE what is being charged — correctly, since
// a lower number is not a discount. Neither product form ever said so, so typing 5 into "Harga coret"
// saved happily, showed nothing on the storefront, and left no way to tell a broken field from a working
// one.
//
// Two live products carry exactly that, measured against storefront_products_public on 2026-09-14:
//   lintang-asmoro     30 ml   Rp329.000   compare-at Rp5
//   patchouli-so-sexy  30 ml   Rp297.000   compare-at Rp10
// They are the only two, and there are no legitimate compare-at values anywhere in the catalogue.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compareAtPriceNote } from './compareAtPrice.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Silence is the normal state ------------------------------------------------------------------
// Most products have no strike-through at all. A note on every variant row would be noise, and noise is
// how a real warning gets ignored.
assert.equal(compareAtPriceNote({}), '', 'a variant with nothing filled in says nothing');
assert.equal(compareAtPriceNote({ priceNumber: 329000 }), '', 'no compare-at, no note');
assert.equal(compareAtPriceNote({ priceNumber: 329000, compareAtPriceNumber: 0 }), '', 'zero means "not set"');
assert.equal(compareAtPriceNote({ priceNumber: 329000, compareAtPriceNumber: 400000 }), '',
  'a real discount is exactly what the field is for and must not be nagged about');

// --- 2. The two live cases ---------------------------------------------------------------------------
assert.match(compareAtPriceNote({ priceNumber: 329000, compareAtPriceNumber: 5 }), /DI ATAS/,
  'lintang-asmoro: Rp5 against Rp329.000 must be called out');
assert.match(compareAtPriceNote({ priceNumber: 297000, compareAtPriceNumber: 10 }), /tidak akan tampil/,
  'patchouli-so-sexy: and the note must say WHY nothing appears, not just that it is wrong');

// Equal is not a discount either — saving nothing is not worth a strike-through.
assert.notEqual(compareAtPriceNote({ priceNumber: 329000, compareAtPriceNumber: 329000 }), '',
  'the same number twice is not a comparison');
// One rupiah above is, however thin.
assert.equal(compareAtPriceNote({ priceNumber: 329000, compareAtPriceNumber: 329001 }), '',
  'the boundary belongs to the owner, not to this check');

// --- 3. A compare-at with no price yet gets its own answer --------------------------------------------
// Saying "must be above the sale price" when there is no sale price would send the owner looking for a
// rule they have not broken.
assert.match(compareAtPriceNote({ compareAtPriceNumber: 10 }), /harga jual dulu/,
  'no price yet is a different problem and must read as one');

// --- 4. Junk in must not produce a confident answer ---------------------------------------------------
for (const bad of [{ priceNumber: 'abc', compareAtPriceNumber: 'def' }, { priceNumber: null, compareAtPriceNumber: null }]) {
  assert.equal(typeof compareAtPriceNote(bad), 'string', 'always a string, never a crash');
}
assert.equal(compareAtPriceNote(), '', 'called with nothing at all, no crash');
assert.equal(compareAtPriceNote(null), '', 'null is not a variant');

// --- 5. BOTH forms must show it ----------------------------------------------------------------------
// Desktop and mobile product forms are the pair this repo most often fixes on one side only.
for (const form of ['components/product/ProductForm.jsx', 'components/product/MobileProductForm.jsx']) {
  const source = read(...form.split('/'));
  assert.match(source, /compareAtPriceNote\(variant\)/,
    `${form} must tell the owner when a compare-at will not display`);
  assert.match(source, /from '@\/utils\/compareAtPrice\.js'/, `${form} must use the shared rule, not its own`);
}

// --- 6. The storefront rule this mirrors must stay put -------------------------------------------------
// If PriceNote ever started showing a lower compare-at, this note would be lying to the owner.
const priceNote = read('components', 'storefront', 'PriceNote.jsx');
assert.match(priceNote, /!\(compareAt > price\)\) return null;/,
  'PriceNote must still hide a compare-at that is not above the price — the form note describes this rule');

console.log('compareAtPrice selfcheck OK (a strike-through that will not show now says so, on both forms)');
