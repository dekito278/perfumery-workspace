// "Foto utama = foto botol" — a checkbox in Studio (Dekito, 26 Nov 2026).
//
// The home shows bottles only, and the catalogue puts them before label cards. Until now "a bottle" meant a
// photo served from /brand/products/, which only a code change could add. The checkbox lets Dekito upload a
// bottle photo himself and have it count. It is stored as a tag, not a column, so no SQL has to be run:
// the app hides it from every tag list, and the public view (which strips only the batch tags) passes it
// through so the shop can read it.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hasBottlePhoto } from './curatedProducts.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(SRC, ...parts), 'utf8');

// --- 1. What counts as a bottle --------------------------------------------------------------------------
const storage = 'https://x.supabase.co/storage/v1/object/public/product-images/la-tulipe/depan.webp';
assert.equal(hasBottlePhoto({ imageUrl: '/brand/products/la-rose/1-depan.webp' }), true, 'a site photo counts by itself');
assert.equal(hasBottlePhoto({ imageUrl: storage }), false, 'an uploaded photo is a label card until Dekito says otherwise');
assert.equal(hasBottlePhoto({ imageUrl: storage, bottlePhoto: true }), true, 'ticked: it counts');
assert.equal(hasBottlePhoto({ imageUrl: '', bottlePhoto: true }), false, 'a tick with no photo shows nothing');

// --- 2. The tag: hidden in the app, kept on save, removed on untick ---------------------------------------
const service = read('services', 'productCatalogService.js');
assert.match(service, /export const PRODUCT_MAIN_PHOTO_BOTTLE_TAG = 'Main photo: bottle';/);
const prefixes = service.slice(service.indexOf('const PRODUCT_INTERNAL_TAG_PREFIXES = ['), service.indexOf('];', service.indexOf('const PRODUCT_INTERNAL_TAG_PREFIXES = [')));
assert.doesNotMatch(prefixes, /PRODUCT_MAIN_PHOTO_TAG_PREFIX/, 'not internal: the public view would strip it and the shop would never see it');
assert.match(service, /\|\| tag\.startsWith\(PRODUCT_MAIN_PHOTO_TAG_PREFIX\)/, 'hidden from the visible tags, so it never becomes a badge or a category');
assert.match(service, /&& !isHiddenProductTag\(tag\)/);
assert.match(service, /const parsedVisibleTags = splitList\(input\.tags\)\s*\.filter\(\(tag\) => !isHiddenProductTag\(tag\)\)/);
assert.match(service, /typeof input\.bottlePhoto === 'boolean'\s*\?\s*input\.bottlePhoto/,
  'the form\'s checkbox wins over the tag it carried in, so unticking removes it');
assert.match(service, /\.\.\.\(bottlePhoto \? \[PRODUCT_MAIN_PHOTO_BOTTLE_TAG\] : \[\]\)/);

// The SQL view strips internal tags by its own list — this one must NOT be on it, or the shop never sees it.
// (Developer machine only — Vercel checks out apps/web alone.)
const VIEW = join(SRC, '../../../supabase/migrations/20260907053000_storefront_products_public_view.sql');
if (existsSync(VIEW)) assert.doesNotMatch(readFileSync(VIEW, 'utf8'), /'main photo:%'/, 'the public view must let the bottle tag through');

// --- 3. It reaches the shop and both Studio forms ----------------------------------------------------------
assert.match(read('data', 'publicStorefront.js'), /bottlePhoto: product\.bottlePhoto === true \|\| productMainPhotoIsBottle\(product\)/);
assert.match(read('utils', 'productFormState.js'), /bottlePhoto: product\.bottlePhoto === true \|\| productMainPhotoIsBottle\(product\)/);
assert.match(read('utils', 'productFormSnapshot.js'), /bottlePhoto: Boolean\(product\.bottlePhoto\)/, 'a tick is an unsaved change');
for (const form of ['ProductForm.jsx', 'MobileProductForm.jsx']) {
  const source = read('components', 'product', form);
  assert.match(source, /checked=\{Boolean\(form\.bottlePhoto\)\} onChange=\{\(event\) => updateField\('bottlePhoto', event\.target\.checked\)\}/, `${form} has the checkbox`);
  assert.match(source, /Foto utama = foto botol/);
  assert.doesNotMatch(source, /maks\. 6 pilihan/, `${form}: the home no longer shows six picks in catalogue order`);
}

console.log('bottlePhotoFlag selfcheck OK');
