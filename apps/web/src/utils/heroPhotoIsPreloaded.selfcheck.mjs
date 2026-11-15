// `node src/utils/heroPhotoIsPreloaded.selfcheck.mjs`
//
// Twelfth visitor audit, 15 Nov 2026: on a slow phone the product photo — the largest paint on the page —
// was not even requested until the whole app had downloaded and run. The prerendered product page now
// preloads it. A preload helps only if it names EXACTLY what the gallery then asks for (same src, srcset,
// sizes); one that misses is a second download. So both read one module, and this holds them to it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PRODUCT_IMAGES_BUCKET, PRODUCT_HERO_SIZES, PRODUCT_HERO_WIDTH, getProductImageSrcSet, getOptimizedProductImageUrl } from './productImageSrcSet.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const seo = readFileSync(join(root, '..', 'tools', 'seo-artifacts.mjs'), 'utf8');
assert.match(seo, /from '\.\.\/src\/utils\/productImageSrcSet\.js'/, 'the build must use the page\'s own srcset module');
assert.match(seo, /getOptimizedProductImageUrl\(imageUrl, PRODUCT_HERO_WIDTH\)/);
assert.match(seo, /imagesizes="\$\{escapeHtml\(PRODUCT_HERO_SIZES\)\}"/);
assert.match(seo, /html = upsertImagePreload\(html, abs\(siteUrl, product\.image\)\);/);
// The photo preloaded is the photo shown first: the list, then the single field (normalizeProductImages).
assert.match(seo, /const imgs = toList\(row\.image_urls\);\s*return String\(imgs\[0\] \|\| row\.image_url \|\| ''\);/);

assert.match(read('components', 'storefront', 'ProductVisual.jsx'), /getOptimizedProductImageUrl\(imageUrl, priority \? PRODUCT_HERO_WIDTH : 520\)/);
assert.match(read('components', 'storefront', 'ProductGallery.jsx'), /sizes=\{PRODUCT_HERO_SIZES\}/);
assert.match(read('pages', 'PublicProductDetailPage.jsx'), /<ProductGallery [^>]*priority \/>/, 'the product page gallery is the priority image');

const url = 'https://x.supabase.co/storage/v1/object/public/storefront-product-images/a/b.webp';
assert.match(getOptimizedProductImageUrl(url, PRODUCT_HERO_WIDTH), /render\/image\/public\/.*width=720/);
assert.equal(getProductImageSrcSet(url).split(', ').length, 5);
assert.equal(getProductImageSrcSet('https://www.solivagantscent.com/brand/covers/samhain.jpg'), undefined, 'a local cover has no srcset');
assert.equal(PRODUCT_HERO_SIZES, '(max-width: 767px) 100vw, 640px');
assert.match(read('services', 'productImageStorageService.js'), new RegExp(`PRODUCT_IMAGES_BUCKET = '${PRODUCT_IMAGES_BUCKET}'`),
  'the upload service and the srcset module name different buckets');
console.log('heroPhotoIsPreloaded selfcheck OK (the build preloads the exact photo the gallery opens on)');
