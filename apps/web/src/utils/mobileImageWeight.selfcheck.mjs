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
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...p) => strip(readFileSync(join(src, ...p), 'utf8'));

// --- 1. no eager download of fallbacks nobody may ever see --------------------------------------------
// useMobileCommercePrefetch retired with the phone storefront (2026-10-31). The rule outlives it: nothing
// in the app may warm a local /brand fallback in the background.
const walk = (dir) => readdirSync(join(src, dir), { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(join(dir, entry.name))
    : /\.(jsx?|mjs)$/.test(entry.name) && !entry.name.includes('.selfcheck.') ? [join(dir, entry.name)] : []
));
const warmers = [];
for (const file of ['hooks', 'services', 'components', 'pages', 'layouts', 'utils'].flatMap(walk)) {
  const text = read(file);
  if (/new Image\(\)|rel: 'preload'|rel="preload"/.test(text)
    && /solivagant-logo\.png|perfumer-pipettes\.jpg|raw-material-library\.jpg/.test(text)) warmers.push(file);
}
assert.deepEqual(warmers, [], `these files warm a local fallback nobody may ever see: ${warmers.join(', ')}`);

// --- 2. the phone gets capped widths on the one home, never a heavier one than before -----------------
const page = read('pages', 'HomePage.jsx');
const widths = (name) => {
  const m = page.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
  assert.ok(m, `${name} must be declared`);
  return m[1].split(',').map((n) => Number(n.trim()));
};
const hero = widths('PHONE_HERO_WIDTHS');
const collab = widths('PHONE_COLLAB_WIDTHS');

// The ceilings are the widths the phone home used to hardcode. Raising either hands a 3x phone MORE bytes
// than before, which is the regression the first attempt at this shipped into a measurement.
assert.equal(Math.max(...hero), 900, 'the phone hero used to request width=900; that stays its ceiling');
assert.equal(Math.max(...collab), 750, 'the second full-bleed image used to request width=750; that stays its ceiling');
assert.equal(Math.min(...hero), 480, 'a 1x phone should be able to take a phone-sized hero');
assert.ok(hero.length >= 3 && collab.length >= 3, 'offer enough steps for the browser to choose from');

for (const [slot, constant] of [['home-hero', 'PHONE_HERO_WIDTHS'], ['home-newsletter', 'PHONE_COLLAB_WIDTHS']]) {
  const source = page.match(new RegExp(`<source media="\\(max-width: 767px\\)" srcSet=\\{srcSet\\(siteImages\\['${slot}'\\], ${constant}\\)\\} sizes="100vw" />`));
  assert.ok(source, `${slot} must offer the phone its capped widths through a <source> for small screens`);
  // The <source> has to sit inside the same <picture> as the slot's <img>, or it caps nothing.
  const picture = page.slice(source.index, page.indexOf('</picture>', source.index));
  assert.ok(picture.includes(`siteImages['${slot}']`) && picture.includes('<img'), `${slot}'s phone source must share a <picture> with its <img>`);
}

console.log('mobileImageWeight selfcheck OK (no unreachable fallbacks warmed; no phone candidate heavier than before)');
