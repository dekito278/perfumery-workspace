// `node src/utils/orphanedProductImages.selfcheck.mjs`
//
// Deleting a product deletes a row. The pictures it named live in a storage bucket, and nothing in the
// app can reach them once the row is gone — the row was the only thing that knew their names. So a
// delete that skips them does not fail, it just leaves paid-for litter nobody can ever find again.
//
// ProductListPage cleaned up. MobileProductListPage, same button on the same catalogue, did not: it
// called deleteCustomProduct and stopped. Every product Dekito deleted from his phone left all of its
// images behind.
//
// The fix was not to copy the cleanup to the phone — that is the same bug with a second home, and this
// repo has watched that go wrong often enough. It moved into deleteCustomProduct, which is the one
// place that knows the delete succeeded, and it reads the image list from the row it actually deleted
// rather than from whatever object the caller happened to be holding.
//
// So the rule has two halves: the one place must do it, and there must be no second way to delete a
// product that goes around it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
));

const catalog = stripComments(readFileSync(join(src, 'services', 'productCatalogService.js'), 'utf8'));

// --- 1. Both ways out of deleteCustomProduct clean up ------------------------------------------------
// Sliced by balancing braces from `=> {`, not by a window: the function ends where its body closes.
const sliceFunction = (source, name) => {
  const at = source.indexOf(`export const ${name} = `);
  assert.ok(at !== -1, `could not find ${name} — update this guard`);
  const open = source.indexOf('{', source.indexOf('=>', at));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`${name} never closes`);
};

const body = sliceFunction(catalog, 'deleteCustomProduct');

// The early return for a `custom-*` leftover and the real database delete are separate exits, and the
// bug this guard exists for was exactly one exit being handled. Checking the whole body would pass with
// either half missing, so each is checked on its own.
const earlyReturn = body.slice(0, body.indexOf('return;') + 'return;'.length);
assert.ok(earlyReturn.includes('startsWith(\'custom-\')'), 'the custom-* branch moved — update this guard');
const databaseExit = body.slice(earlyReturn.length);

for (const [what, part] of [['the custom-* leftover branch', earlyReturn], ['the database delete', databaseExit]]) {
  assert.match(part, /forgetProductImages\(|deleteProductImages\(/,
    `${what} of deleteCustomProduct leaves the product's images in the bucket, where nothing can ever `
    + 'reach them again');
}

// And the list must come from the deleted row, not from a caller's copy: the select has to bring it back.
assert.match(databaseExit, /\.select\('id, image_urls'\)/,
  'the delete must return the row\'s own image list — a caller\'s stale copy is what the phone got wrong');

// --- 2. No second way to delete a product ------------------------------------------------------------
// A page reaching for the table directly would skip all of the above. Derived: any file that deletes
// from storefront_products and is not the service itself.
const deleters = walk(src)
  .filter((file) => /\.(js|jsx|mjs)$/.test(file) && !file.endsWith('.selfcheck.mjs'))
  .filter((file) => {
    const source = stripComments(readFileSync(file, 'utf8'));
    return /from\('storefront_products'\)[\s\S]{0,200}?\.delete\(/.test(source);
  })
  .map((file) => file.slice(src.length + 1));
assert.deepEqual(deleters, ['services/productCatalogService.js'],
  `a product is deleted somewhere that cannot clean up after it: ${deleters.join(', ')}`);

// --- 3. The cleanup is not a no-op -------------------------------------------------------------------
// A cleanup that quietly matches nothing is worse than none: it reads as done. deleteProductImages turns
// a public URL back into an object path by finding the bucket name in it. That expression is lifted out
// and run, so a renamed bucket or a changed URL shape fails here rather than in silence.
const storage = stripComments(readFileSync(join(src, 'services', 'productImageStorageService.js'), 'utf8'));
const bucket = storage.match(/const PRODUCT_IMAGES_BUCKET = '([^']+)'/)?.[1]
  || readFileSync(join(src, 'services', 'productImageStorageService.js'), 'utf8').match(/PRODUCT_IMAGES_BUCKET = '([^']+)'/)?.[1];
assert.ok(bucket, 'could not read the bucket name — update this guard');

const toPath = (url) => {
  const marker = `/${bucket}/`;
  const text = String(url || '');
  const index = text.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(text.slice(index + marker.length).split('?')[0]);
};

const ours = `https://ysokpneuumtmgqfgdpmc.supabase.co/storage/v1/object/public/${bucket}/kaki%20langit/1758900000000-ab12cd.webp`;
assert.equal(toPath(ours), 'kaki langit/1758900000000-ab12cd.webp',
  'a public URL from our own bucket must resolve to the object path, or the cleanup deletes nothing');
assert.equal(toPath(`${ours}?width=800`), 'kaki langit/1758900000000-ab12cd.webp',
  'a transform query must not become part of the path');
assert.equal(toPath('https://images.example.com/borrowed.jpg'), null,
  'a URL from somewhere else is not ours to delete');

// The same expression still lives in the service — if it drifts, the run above stops describing it.
assert.match(storage, /const marker = `\/\$\{PRODUCT_IMAGES_BUCKET\}\/`/,
  'deleteProductImages no longer resolves paths this way — re-derive this guard from the new shape');

console.log(`orphanedProductImages selfcheck OK (both exits clean up, ${deleters.length} place deletes a product, path resolution runs)`);
