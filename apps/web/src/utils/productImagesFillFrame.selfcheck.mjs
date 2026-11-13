// `node src/utils/productImagesFillFrame.selfcheck.mjs`
//
// Visitor audit, 13 Nov 2026: the Aquilaria thumbnail filled 70 of its 90 pixels, a dark band under it.
// Measured in the running shop, every catalogue thumbnail took its FILE's height (70, 86, 88, 93, 96 px)
// instead of its frame's: `.solivagant-editorial-home img { height: auto }` in storefront.css outranks
// a single `h-full` class. A 4:5 photo in a 4:5 frame hid it; a square one did not.
//
// And six live perfumes led with a white name card. Changing the cover meant reordering lines of URLs in
// Studio's text box, so Studio now has "Jadikan cover" on every photo, in both forms.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const css = read('styles', 'storefront.css');
const globalRule = /\.solivagant-editorial-home img \{[^}]*height: auto;/.test(css);
const visual = read('components', 'storefront', 'ProductVisual.jsx');
const gallery = read('components', 'storefront', 'ProductGallery.jsx');
if (globalRule) {
  assert.match(visual, /'absolute inset-0 !h-full !w-full !max-w-none/,
    'ProductVisual must force the photo to its frame: the shop-wide img { height: auto } outranks h-full');
  assert.match(gallery, /className="!h-full !w-full object-cover"/, 'and so must the gallery thumbnails');
}

for (const form of ['ProductForm.jsx', 'MobileProductForm.jsx']) {
  const source = read('components', 'product', form);
  assert.match(source, /const makeCover = \(imageUrl\) => setForm\(\(current\) => \{\s*const images = \[imageUrl, \.\.\.\(current\.images \|\| \[\]\)\.filter\(\(image\) => image !== imageUrl\)\];/,
    `${form}: "Jadikan cover" moves the photo to the front and keeps every other photo`);
  assert.match(source, /onClick=\{\(\) => makeCover\(image\)\}/, `${form}: every photo but the cover offers it`);
}

// Sixth visitor audit, 13 Nov 2026: every photo had the same alt, the strip did not say which was shown,
// a 3x phone got 720px for a ~1050px slot, and the structured data listed one image of up to seven.
{
  const gallery = readFileSync(new URL('../components/storefront/ProductGallery.jsx', import.meta.url), 'utf8');
  assert.match(gallery, /t\('a11y\.galleryPhoto', \{ number: activeIndex \+ 1, total: images\.length \}\)/, 'each photo names its place');
  assert.match(gallery, /aria-current=\{index === activeIndex \? 'true' : undefined\}/, 'the shown thumbnail is marked');
  assert.match(readFileSync(new URL('../services/productImageStorageService.js', import.meta.url), 'utf8'), /const PRODUCT_IMAGE_WIDTHS = \[[^\]]*1080\]/, 'a 1080w source exists');
  assert.match(readFileSync(new URL('./seo.js', import.meta.url), 'utf8'), /image: images\.length \? images : undefined,/, 'JSON-LD lists every photo');
}
console.log('productImagesFillFrame selfcheck OK (photos fill their frame; the cover is one tap in Studio)');
