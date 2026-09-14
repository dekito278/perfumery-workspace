// `node src/utils/mobileImageWeight.selfcheck.mjs`
//
// Two things were adding weight to every mobile commerce page, measured on the live site with an
// iPhone 13 profile:
//
// 1. useMobileCommercePrefetch eagerly downloaded three LOCAL files — the logo and two /brand/home
//    fallbacks — on every page, 521 KB of untransformed originals. They are only shown when a site
//    image slot is empty, and home-statement is configured, so perfumer-pipettes.jpg (175 KB) could
//    never be displayed at all. The images the mobile home page really shows come from Supabase through
//    the transform, so none of them were ever warmed by this.
//
// 2. The mobile storefront never got the srcSet treatment the desktop home page received, so its hero
//    and statement were fixed at width=900 and width=750 for every screen.
//
// The second fix has a trap the first measurement caught: a phone is ~390 CSS px, so sizes="100vw" on a
// 3x screen asks for ~1170 and an UNCAPPED candidate list answers 1600 — heavier than the fixed widths
// it replaced. Each image's ceiling is therefore the width it already requested.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...p) => strip(readFileSync(join(src, ...p), 'utf8'));

// --- 1. no eager download of fallbacks nobody may ever see --------------------------------------------
const prefetch = read('hooks', 'useMobileCommercePrefetch.js');
for (const file of ['solivagant-logo.png', 'perfumer-pipettes.jpg', 'raw-material-library.jpg']) {
  assert.ok(!prefetch.includes(file),
    `${file} must not be prefetched on every mobile page — it is a fallback, and the transform never touches it`);
}
assert.doesNotMatch(prefetch, /homeImageUrls/, 'the local warm-up list is gone');
// The data prefetch and the real product image are worth keeping; this is not a blanket removal.
assert.match(prefetch, /prefetchCatalogProducts\(\)/, 'the data prefetch stays');
assert.match(prefetch, /preloadImage\(getOptimizedProductImageUrl\(firstProductImage, 720\)\)/,
  'the first product image goes through the transform and is worth warming');

// --- 2. the mobile storefront offers widths, and never a heavier one than before -----------------------
const page = read('pages', 'mobile', 'MobileStorefrontPage.jsx');
const widths = (name) => {
  const m = page.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
  assert.ok(m, `${name} must be declared`);
  return m[1].split(',').map((n) => Number(n.trim()));
};
const hero = widths('HERO_WIDTHS');
const statement = widths('STATEMENT_WIDTHS');

// The ceilings are the widths this page used to hardcode. Raising either hands a 3x phone MORE bytes
// than before, which is the regression the first attempt at this shipped into a measurement.
assert.equal(Math.max(...hero), 900, 'the hero used to request width=900; that stays its ceiling');
assert.equal(Math.max(...statement), 750, 'the statement used to request width=750; that stays its ceiling');
assert.equal(Math.min(...hero), 480, 'a 1x phone should be able to take a phone-sized hero');
assert.ok(hero.length >= 3 && statement.length >= 3, 'offer enough steps for the browser to choose from');

for (const [slot, constant] of [['home-hero', 'HERO_WIDTHS'], ['home-statement', 'STATEMENT_WIDTHS']]) {
  const line = page.split('\n').find((l) => l.includes(`siteImages['${slot}']`) && l.includes('<img'));
  assert.ok(line, `${slot} must still be rendered`);
  assert.ok(line.includes(`srcSet(siteImages['${slot}'], ${constant})`), `${slot} must offer its capped widths`);
  assert.ok(line.includes('sizes="100vw"'), `${slot} needs sizes — a srcSet without it is inert`);
}

console.log('mobileImageWeight selfcheck OK (no unreachable fallbacks warmed; no candidate heavier than before)');
