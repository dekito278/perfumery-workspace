// `node src/utils/anEmptyCartOffersWhatItPromises.selfcheck.mjs`
//
// Walked both phone carts at 375px. The same screen in two languages had drifted into two different
// shapes, and neither was right.
//
// INDONESIA said it twice. "Mulai belanja" with [Belanja][Aroma bespoke] at the top, then "Keranjang
// kosong" with [Mulai bespoke][Buka katalog] three hundred pixels below — two headings, four buttons,
// and only two destinations between them. An empty cart telling you twice that it is empty reads as
// unfinished.
//
// ENGLISH said less than it promised. Both carts print the same sentence — "pick a bottle in stock, or
// start a bespoke request" — over a single Shop button, so the bespoke door was named and not shown.
// It also ended there: no recommendations at all, in the shop that has taken no orders.
//
// BOTH recommended a bottle nobody can buy. La Tulipe has been at zero stock for days and was first in
// the list. The obvious-looking fix — `publicStatus === 'Available'`, which is what the desktop
// catalogue disables its add button on — silently matched NOTHING here and emptied the list, because
// the carts reach the catalogue through a different mapper that has no such field. Two shapes, one
// screen apart. getProductStockTotal is what publicStatus is itself derived from and works on either.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return /\.jsx$/.test(entry) ? [full] : [];
});
const carts = walk(join(src, 'pages')).filter((file) => /Cart\w*\.jsx$/.test(file));
assert.ok(carts.length >= 4, `expected the cart pages, found ${carts.length} — the scan is broken`);

// --- 1. A recommendation is a bottle that can be bought -------------------------------------------------
const recommending = [];
for (const file of carts) {
  const source = strip(readFileSync(file, 'utf8'));
  if (!/recommend/i.test(source)) continue;
  const name = relative(src, file);
  recommending.push(name);
  // Filtered — by something this page's own mapper actually produces. There are two shapes in play:
  // getPublicFragranceCatalog adds publicStatus, and the Studio catalogue the phone carts read does
  // not, so the obvious predicate matched nothing there and emptied the list instead of trimming it.
  const viaPublicMapper = /getPublicFragranceCatalog\(/.test(source);
  const filter = viaPublicMapper ? /publicStatus === 'Available'/ : /getProductStockTotal\(/;
  assert.match(source, filter,
    `${name} recommends products without checking whether they can be bought. The first bottle an empty `
    + 'cart suggested was La Tulipe, which the catalogue greys out. This page reads the '
    + `${viaPublicMapper ? 'public mapper, so publicStatus is the field' : 'Studio mapper, which has no publicStatus — count stock'}`);
  if (!viaPublicMapper) {
    assert.doesNotMatch(source, /\.publicStatus\b/,
      `${name} filters on publicStatus without going through getPublicFragranceCatalog, so the field is `
      + 'undefined and the filter silently matches nothing — worse than showing a sold-out bottle');
  }
}
assert.ok(recommending.length >= 2,
  `only ${recommending.length} cart(s) recommend anything; both phone carts should, and the English one `
  + 'was a dead end until 10 Oct 2026');

// --- 2. An empty cart offers both doors its own sentence names -----------------------------------------
// The sentence is ONE key, shared by both shops. A screen that prints it owes the reader both routes.
const promise = MESSAGES.en['cart.emptyMobileBody'];
assert.ok(/bespoke/i.test(promise),
  `cart.emptyMobileBody no longer mentions bespoke ("${promise}") — if the sentence changed, this rule `
  + 'should change with it rather than being left pointing at nothing');
for (const file of carts) {
  const source = strip(readFileSync(file, 'utf8'));
  if (!source.includes('cart.emptyMobileBody')) continue;
  assert.match(source, /\/mobile\/bespoke/,
    `${relative(src, file)} prints a sentence offering a bespoke request and gives no way to start one`);
  assert.match(source, /\/mobile\/catalog/, `${relative(src, file)} offers no way to the catalogue`);
}

// --- 3. It says it once ---------------------------------------------------------------------------------
// Two empty-state headings on one screen is what this started as.
for (const file of carts) {
  const source = strip(readFileSync(file, 'utf8'));
  // Only the two keys that ARE empty-state headings: "Mulai belanja" / "Start shopping" and
  // "Keranjang kosong" / "Your cart is empty". cart.title is the section label ("Keranjang"), shown in
  // both states, and counting it made this rule fire on a screen that says it exactly once.
  const headings = ['cart.emptyMobile', 'cart.startShopping']
    .filter((key) => new RegExp(`'${key.replace('.', '\\.')}'`).test(source));
  assert.ok(headings.length <= 1,
    `${relative(src, file)} renders ${headings.length} empty-state headings (${headings.join(', ')}). `
    + 'One screen, one way of saying it is empty');
}

console.log(`anEmptyCartOffersWhatItPromises selfcheck OK (${recommending.length} carts recommend only `
  + 'bottles in stock, both doors shown wherever the sentence names them, each said once)');
