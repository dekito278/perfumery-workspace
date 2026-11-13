// `node src/utils/handmadeIsShown.selfcheck.mjs`
//
// Dekito's brief, 14 Nov 2026 (P2-6, "parfum karya"): the site should show that one person makes each
// bottle, from formula to packing. Two optional things Dekito fills in Studio:
//   - per product, a batch ("Batch 03 · 40 botol") beside the stock line, and up to four process photos;
//   - on About, up to four process photos (Pengaturan toko — no SQL).
// Shown only when filled in; never stock photos (the forms say so). And the columns need SQL
// (supabase/manual/20261115110000_batch_and_process_photos.sql) — until it runs, saving a product in Studio
// must keep working, so the app sends the new columns only once it has read them back, or when one is set.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { batchParts, normalizeProcessImages, MAX_PROCESS_IMAGES } from './processImages.js';
import { normalizeSiteFacts } from '../data/siteFacts.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// --- 1. The rules -------------------------------------------------------------------------------------
assert.deepEqual(normalizeProcessImages(['https://a/1.jpg', 'not a url', '/2.jpg', 'https://a/1.jpg', ' https://a/3.jpg ', 'https://a/4.jpg', 'https://a/5.jpg']),
  ['https://a/1.jpg', '/2.jpg', 'https://a/3.jpg', 'https://a/4.jpg'], `at most ${MAX_PROCESS_IMAGES} photos, real addresses, no repeats`);
assert.deepEqual(normalizeProcessImages('https://a/1.jpg\n\nhttps://a/2.jpg'), ['https://a/1.jpg', 'https://a/2.jpg'], 'one per line, from the form');
assert.deepEqual(batchParts({ batchLabel: ' Batch 03 ', batchSize: '40' }), { name: 'Batch 03', size: 40 });
assert.deepEqual(batchParts({ batchLabel: '', batchSize: 0 }), { name: '', size: null }, 'empty means nothing shown');
assert.deepEqual(normalizeSiteFacts({}).aboutProcessImages, [], 'About shows no gallery until Studio holds one');

// --- 2. Every allowlist between the row and the page carries the fields -----------------------------------
const service = read('services', 'productCatalogService.js');
assert.match(service, /batchLabel: batchParts\(input\)\.name,/, 'normalizeProduct drops the batch');
assert.match(service, /batchLabel: row\.batch_label \|\| '',/, 'fromDatabaseRow drops the batch');
assert.match(service, /processImages: normalizeProcessImages\(row\.process_image_urls\),/);
assert.match(service, /hasBatchColumns: Object\.prototype\.hasOwnProperty\.call\(row \|\| \{\}, 'batch_label'\),/);
// Before the SQL: the columns are sent only when the row had them or the form holds a value.
assert.match(service, /\.\.\.\(\(product\.hasBatchColumns \|\| product\.batchLabel \|\| product\.batchSize \|\| product\.processImages\?\.length\) \? \{/,
  'the save payload always names the new columns — every product save would fail until the SQL is run');
assert.match(read('data', 'publicStorefront.js'), /batchLabel: product\.batchLabel \|\| '',[\s\S]{0,120}processImages:/, 'the public catalogue mapper drops them');
assert.match(read('utils', 'productFormSnapshot.js'), /batchLabel: String\(product\.batchLabel/, 'an edit to the batch would not count as unsaved');

// --- 3. Both Studio forms ask for them, and say "no stock photos" ------------------------------------------
for (const form of ['ProductForm.jsx', 'MobileProductForm.jsx']) {
  const source = read('components', 'product', form);
  for (const field of ["updateField('batchLabel'", "updateField('batchSize'", "updateField('processImages'"]) {
    assert.ok(source.includes(field), `${form} has no field for ${field}`);
  }
  assert.match(source, /Jangan foto stok/, `${form} does not say the photos must be Dekito's own`);
}
assert.match(read('components', 'studio', 'SiteFactsForm.jsx'), /update\('aboutProcessImages'/, 'Pengaturan toko has no place for the About photos');

// --- 4. The pages show them, and only when filled in -------------------------------------------------------
const pdp = read('pages', 'PublicProductDetailPage.jsx');
assert.match(pdp, /\{batchLine \? <p className="ng-mono m-0 text-ng-dust">\{batchLine\}<\/p> : null\}/);
assert.match(pdp, /<ProcessGallery images=\{product\.processImages\}/);
assert.match(read('pages', 'AboutPage.jsx'), /<ProcessGallery images=\{siteFacts\.aboutProcessImages\}/);
assert.match(read('components', 'storefront', 'ProcessGallery.jsx'), /if \(!list\.length\) return null;/, 'an empty gallery frame is shown');
for (const language of ['id', 'en']) {
  for (const key of ['pdp.batchSize', 'pdp.processHeading', 'pdp.processAlt', 'about.processHeading']) {
    assert.ok(MESSAGES[language][key], `${language}.${key} is missing`);
  }
}

// --- 5. The SQL recreates the view, or the shop never sees the columns -----------------------------------
const sql = readFileSync(join(root, '..', '..', '..', 'supabase', 'manual', '20261115110000_batch_and_process_photos.sql'), 'utf8');
for (const column of ['batch_label', 'batch_size', 'process_image_urls']) assert.match(sql, new RegExp(`add column if not exists ${column}`));
assert.match(sql, /create or replace view public\.storefront_products_public as/, 'the public view keeps its old column list without this');

console.log('handmadeIsShown selfcheck OK (batch and process photos travel from Studio to the page, shown only when filled in)');
