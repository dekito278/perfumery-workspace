// `node src/utils/galleryThumbnails.selfcheck.mjs`
//
// ProductGallery's thumbnail strip rendered the RAW storage object. Each thumbnail is 64 CSS px on
// screen; the files behind them are the originals, and 35 of the 69 live product images are PNGs that
// were named .webp by an upload bug since fixed — 200 kB to 1.4 MB each.
//
// Measured on /mobile/products/patchouli-so-sexy: five raw originals, 4.9 MB, for a strip of
// thumbnails. The main image beside them had gone through the transform all along. Desktop never showed
// it because this component is only used by the mobile product page.
//
//   before  5 raw / 4942 kB + 5 transformed / 178 kB  = 5120 kB
//   after   0 raw            + 10 transformed / 204 kB =  204 kB
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const gallery = strip(readFileSync(join(src, 'components', 'storefront', 'ProductGallery.jsx'), 'utf8'));

// --- nothing in the gallery may point an <img> at the untouched object --------------------------------
// `src={image}` is the exact shape that shipped 4.9 MB. A bare `|| image` fallback is fine: it only
// applies to a URL the transform cannot rewrite anyway.
assert.doesNotMatch(gallery, /<img\s+src=\{image\}/,
  'a thumbnail must not be the raw storage object — that is the 4.9 MB defect');
assert.doesNotMatch(gallery, /src=\{activeImage\}(?!\s*\|)/,
  'the main image must not fall back to the raw object either');

// --- the thumbnails go through the transform, at thumbnail size ---------------------------------------
assert.match(gallery, /getOptimizedProductImageUrl\(image, THUMB_WIDTHS\[0\]\)/,
  'the thumbnail src must be transformed');
assert.match(gallery, /getStorageImageSrcSet\(image, THUMB_WIDTHS\)/, 'and offer a choice of widths');
assert.match(gallery, /sizes="64px"/,
  'sizes must describe the real rendered size — a srcSet without it makes the browser assume 100vw and '
  + 'pick the largest candidate');

const widths = gallery.match(/const THUMB_WIDTHS = \[([^\]]*)\]/);
assert.ok(widths, 'THUMB_WIDTHS must be declared');
const list = widths[1].split(',').map((n) => Number(n.trim()));
assert.ok(Math.max(...list) <= 192,
  `a 64 px thumbnail never needs more than 192 (3x); found ${Math.max(...list)}`);
assert.ok(Math.min(...list) <= 96, 'a 1x screen should be able to take a 96 px thumbnail');

// --- the main image keeps its own, larger transform ----------------------------------------------------
assert.match(gallery, /getOptimizedProductImageUrl\(activeImage, 1200\)/,
  'the main image is not a thumbnail and must keep its own width');

console.log('galleryThumbnails selfcheck OK (no raw originals behind 64 px thumbnails)');
