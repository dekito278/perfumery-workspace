// `node src/utils/publishChecklist.selfcheck.mjs`
//
// A sold-out perfume could not be edited at all.
//
// Both product forms refuse every save of a catalogue-visible product while the publish checklist is
// unready — and "stock > 0" was on that checklist as a BLOCKER. So a perfume that had sold out could not
// have its category, notes or description corrected; un-ticking "Tampilkan di katalog" to get around it
// would hide it from the shop, and re-ticking was refused for the same reason. The record was frozen.
//
// Measured on the live shop: Aquilaria tuberosa and Sudra, the only two of nineteen products at stock 0,
// both already visible to buyers, could not be re-filed out of the 'Limited' category.
//
// Stock is inventory, not product data. It never protected a buyer either — the shop shows "Stok Habis"
// and disables the button on its own. An atelier selling limited runs is sold out often; that is a normal
// state here, not an unfinished product.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => strip(readFileSync(join(here, '..', ...parts), 'utf8'));

const service = read('services', 'productCatalogService.js');
const checklist = service.slice(
  service.indexOf('export const getProductPublishChecklist'),
  service.indexOf('const blocking = items.filter'),
);
assert.ok(checklist.length > 200, 'the checklist moved — update this guard rather than deleting it');

const row = (key) => {
  const match = checklist.match(new RegExp(`\\{ key: '${key}',[^}]*\\}`));
  assert.ok(match, `the '${key}' row is gone from the publish checklist`);
  return match[0];
};

// --- Stock warns, never blocks -----------------------------------------------------------------------
assert.match(row('stock'), /required: false/,
  'stock is a publish BLOCKER again, so a sold-out perfume cannot be edited while it is in the catalogue');
// Still listed, so the panel says it out loud instead of going quiet about it.
assert.match(row('stock'), /key: 'stock'/, 'stock must still be reported, just not as a blocker');
assert.doesNotMatch(row('stock'), /wajib|harus lebih dari 0/i,
  'the stock message still reads like a requirement');

// --- What genuinely is product data still blocks ------------------------------------------------------
// Removing the wrong row would be the same mistake pointing the other way: a product with no price or no
// name has no business being in the catalogue, and those are not inventory.
for (const key of ['name', 'category', 'summary', 'price', 'image', 'slug']) {
  assert.match(row(key), /required: true/, `'${key}' stopped blocking publish — that is product data, not stock`);
}
// And description stays the warning it always was.
assert.match(row('description'), /required: false/);

// --- Both forms still gate on the same checklist ------------------------------------------------------
// There are two of them and they have drifted apart before.
for (const [name, file] of [
  ['desktop', ['components', 'product', 'ProductForm.jsx']],
  ['phone', ['components', 'product', 'MobileProductForm.jsx']],
]) {
  const source = read(...file);
  assert.match(source, /if \(form\.catalogVisible && !publishChecklist\.ready\)/,
    `${name} no longer checks the publish checklist before saving a visible product`);
}

console.log('publishChecklist selfcheck OK (stock warns, product data blocks, and a sold-out perfume can still be edited)');
