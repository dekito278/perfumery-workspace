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

// Fifth audit, 13 Nov 2026: names are headings (a screen reader moves through a list by them), the cart's
// name link is a full touch target, and long notes keep a readable measure on a wide screen.
assert.match(read('pages', 'CatalogPage.jsx'), /<h2 className="m-0 font-ng-display[^"]*">\{named\.name\}<\/h2>/, 'each perfume in the catalogue is a heading');
assert.match(read('pages', 'PublicJournalPage.jsx'), /<h2 className="m-0 font-ng-display[^"]*">\{article\.title\}<\/h2>/, 'each article in the journal is a heading');
assert.match(read('pages', 'CartPage.jsx'), /className="inline-flex min-h-\[44px\] items-center self-start font-ng-display/, 'the cart name link is 44px tall');
assert.match(read('pages', 'BespokePage.jsx'), /<p className="m-0 flex max-w-\[62ch\] flex-col gap-1 text-\[15px\] text-ng-dust">/, 'the bespoke floor note keeps a measure');

// Every shop page starts with a way past the header (seventh audit, 13 Nov 2026).
assert.match(header, /<a href="#main-heading" className="skip-to-results" onClick=\{skipToHeading\}>\{t\('nav\.skipToContent'\)\}<\/a>/);
assert.match(header, /heading\.focus\(\);/, 'and it moves the focus, not only the scroll');

// Seventh audit, 13 Nov 2026: small things a phone pays for.
assert.match(read('pages', 'HomePage.jsx'), /srcSet=\{srcSet\(siteImages\['home-newsletter'\]\) \|\| FALLBACK_LIBRARY_SRCSET\}/, 'the bundled photo has a phone-size copy');
assert.doesNotMatch(read('pages', 'CheckoutPage.jsx'), /aria-label=\{t\('checkout\.namePlaceholder'\)\}/, 'the name field is named by its visible label');

// Eighth audit, 13 Nov 2026.
assert.match(read('pages', 'HomePage.jsx'), /<textPath href="#ng-ring-path" textLength="829" lengthAdjust="spacing">\{t\('home\.ngRing'\)\}<\/textPath>/, 'the ring is written once, fitted to its circle');
for (const page of ['CartPage.jsx', 'CheckoutPage.jsx']) {
  assert.match(read('pages', page), /<span className="whitespace-nowrap text-lg">\{formatTotal\(/, `${page}: the pay bar total keeps its line at 320 px`);
}
const naskah = readFileSync(join(src, 'styles', 'naskah.css'), 'utf8');
assert.match(naskah, /@media \(forced-colors: active\) \{\s*\.ng-script-mark \{\s*display: none;/, 'the script watermark stands down in forced colours');
const storefrontCss = readFileSync(join(src, 'styles', 'storefront.css'), 'utf8');
assert.match(storefrontCss, /@media \(prefers-reduced-motion: reduce\) \{\s*\.imm-section \{\s*opacity: 1;/, 'the product story honours reduced motion');

assert.match(naskah, /@media \(max-height: 480px\) and \(orientation: landscape\) \{\s*\.ng-buybar__inner \{/, 'the pay bar is compact on a phone held sideways');

const backToTop = read('components', 'storefront', 'BackToTop.jsx');
assert.match(backToTop, /\/\^\\\/\(cart\|checkout\|bespoke\|payment\|pay\)\(\\\/\|\$\)\/\.test\(pathname\)/, 'no floating button on the pages that end in a form button');
assert.match(backToTop, /if \(onFormPage\) return null;/);

assert.match(backToTop, /const shown = visible && !footerInView;/, 'the back-to-top button stands aside at the footer');
console.log('phoneLayout selfcheck OK (the product page fits a 360px phone; nothing floats over a pay button)');
