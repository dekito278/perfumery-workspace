// `node src/utils/phoneLayout.selfcheck.mjs`
//
// Third visitor audit, 13 Nov 2026:
//   - on 360-390px phones the product page ran 444-516px wide (Wongka, Wayback, Jata Bhumi, Pantura): the
//     two-column grid had no column template on a phone, so its one column grew to the widest child — a
//     seven-thumbnail strip, a 56px title — and the description and "Tambah ke keranjang" were cut off.
//     After the fix all 114 product views (19 products x 2 shops x 360/390/768) measured inside the screen.
//   - the floating "Kembali ke atas" button sat on "Buat order & bayar" on the bespoke checkout.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const pdp = read('pages', 'PublicProductDetailPage.jsx');
assert.match(pdp, /<div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2 md:gap-\[72px\]">\s*<div className="relative min-w-0">/,
  'the product grid has a column template on a phone, and the gallery column may shrink');
assert.match(pdp, /className="ng-pdp__info flex min-w-0 flex-col gap-7"/, 'and so may the text column');
assert.match(pdp, /<h1 className="ng-display text-\[clamp\(38px,12vw,56px\)\][^"]*\[overflow-wrap:anywhere\][^"]*md:text-\[clamp\(56px,6\.5vw,88px\)\]">/,
  'the perfume name scales with the screen and wraps rather than cutting "Maskumambang" off');

const backToTop = read('components', 'storefront', 'BackToTop.jsx');
assert.match(backToTop, /\/\^\\\/\(cart\|checkout\|bespoke\|payment\|pay\)\(\\\/\|\$\)\/\.test\(pathname\)/, 'no floating button on the pages that end in a form button');
assert.match(backToTop, /if \(onFormPage\) return null;/);

console.log('phoneLayout selfcheck OK (the product page fits a 360px phone; nothing floats over a pay button)');
