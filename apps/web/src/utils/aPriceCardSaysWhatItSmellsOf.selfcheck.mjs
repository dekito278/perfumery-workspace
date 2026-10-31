// `node src/utils/aPriceCardSaysWhatItSmellsOf.selfcheck.mjs`
//
// A card that tells a buyer the price must tell them what it smells of.
//
// Both houses Dekito pointed at do this and do it first: HöM prints "Neroli · musk · oud" under the
// name, Rhen prints the whole pyramid on the front page. It is not decoration. A browse card has one
// job — help someone decide whether to open this bottle rather than the next one — and a price alone
// cannot answer the only question a perfume raises.
//
// The catalogue card has said it since #516. The two FRONT PAGES did not: desktop named a price and a
// perfumer, the phone named a price, and between them they are the first thing almost every visitor
// sees. The phone one was found by this guard rather than by me, after the desktop fix — which is the
// same mobile-twin blind spot the repo has hit before.
//
// SUBJECT IS DERIVED, not listed: any file rendering CardPrice is a card showing money, and has to
// answer for itself. A new browse surface is covered the day it is written.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

const rendersPrice = walk(src)
  .filter((file) => /\.jsx$/.test(file))
  .filter((file) => /<CardPrice\b/.test(readFileSync(file, 'utf8')));

assert.ok(rendersPrice.length >= 4,
  `only ${rendersPrice.length} files render CardPrice — this guard is looking in the wrong place`);

// Pages that show ONE perfume already print the full pyramid; a three-note summary beside it would be
// the same thing said twice, worse. Same for a cart line, which is a receipt, not a browse card. The
// exemption is by WHAT THE SURFACE IS, and each one is named with its reason so the list cannot grow
// quietly.
const NOT_A_BROWSE_CARD = new Map([
  ['pages/PublicProductDetailPage.jsx', 'one perfume, full pyramid already on the page'],
  ['components/journal/JournalRelatedProduct.jsx', 'sits under an article that just described the scent'],
]);

const silent = [];
for (const file of rendersPrice) {
  const name = relative(src, file).split(sep).join('/');
  if (NOT_A_BROWSE_CARD.has(name)) continue;
  if (!/shortNoteList\(/.test(readFileSync(file, 'utf8'))) silent.push(name);
}
assert.deepEqual(silent, [],
  'these show a buyer a price and never say what the perfume smells of. A browse card that answers '
  + '"how much" but not "what is it" asks someone to decide on the only fact that cannot help them:\n  '
  + silent.join('\n  '));

// Every exemption must still exist, or the list is protecting files that are gone while a real card
// slips in under a stale name.
const present = new Set(rendersPrice.map((file) => relative(src, file).split(sep).join('/')));
const stale = [...NOT_A_BROWSE_CARD.keys()].filter((name) => !present.has(name));
assert.deepEqual(stale, [],
  `these are exempted but no longer render a price — remove them from the list:\n  ${stale.join('\n  ')}`);

// --- The three browse cards agree on how many notes they show ----------------------------------------
// Different limits would make the same perfume look different on three screens, which is how a buyer
// starts wondering which one is lying.
const limits = [
  ['pages/CatalogPage.jsx', /const CARD_NOTE_LIMIT = (\d+)/],
  ['pages/HomePage.jsx', /const HOME_CARD_NOTE_LIMIT = (\d+)/],
].map(([file, pattern]) => {
  const match = readFileSync(join(src, file), 'utf8').match(pattern);
  assert.ok(match, `${file} no longer declares its note limit where this guard can read it`);
  return Number(match[1]);
});
assert.equal(new Set(limits).size, 1,
  `the browse cards cut the notes at different lengths (${limits.join(', ')}), so the same perfume `
  + 'reads differently depending on which screen found it');

console.log(`aPriceCardSaysWhatItSmellsOf selfcheck OK (${rendersPrice.length} price surfaces, ${NOT_A_BROWSE_CARD.size} exempt with reasons, all browse cards cut at ${limits[0]})`);
