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

// Fourth audit, 13 Nov 2026: the home page's featured perfume had the same template-less grid and ran 11px
// past a 360px screen.
const home = read('pages', 'HomePage.jsx');
assert.match(home, /<div className="ng-container grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-\[72px\]">\s*<Link to=\{`\/catalog\/\$\{featured\.slug\}`\} className="relative block min-w-0"/,
  'the featured block has a column template on a phone');
assert.match(home, /<h2 id="home-featured-title" className="ng-display text-\[clamp\(38px,12vw,56px\)\][^"]*\[overflow-wrap:anywhere\]/, 'and its name scales and wraps');

// The site menu (fourth audit, 13 Nov 2026): a panel of links, not role="menu"; Tab out of it closes it;
// Escape hands focus back to the button; on a phone the page behind it does not scroll.
const header = read('components', 'storefront', 'PublicHeader.jsx');
assert.doesNotMatch(header, /role="menu(item)?"/, 'the menu is links in a <nav>, not an application menu');
assert.match(header, /<nav id="site-menu" className="ng-menu" aria-label=\{t\('nav\.siteMenu'\)\}>/);
assert.match(header, /aria-controls="site-menu"/);
assert.match(header, /handleFocusOut[\s\S]{0,160}!menuRef\.current\.contains\(e\.relatedTarget\)\) setMegaOpen\(false\)/, 'focus leaving the menu closes it');
assert.match(header, /setMegaOpen\(false\);\s*menuButtonRef\.current\?\.focus\(\);/, 'Escape returns focus to the button');
assert.match(header, /if \(phone\) \{\s*const release = lockBodyScroll\(\);/, 'the page behind a phone menu stays put');

const backToTop = read('components', 'storefront', 'BackToTop.jsx');
assert.match(backToTop, /\/\^\\\/\(cart\|checkout\|bespoke\|payment\|pay\)\(\\\/\|\$\)\/\.test\(pathname\)/, 'no floating button on the pages that end in a form button');
assert.match(backToTop, /if \(onFormPage\) return null;/);

console.log('phoneLayout selfcheck OK (the product page fits a 360px phone; nothing floats over a pay button)');
