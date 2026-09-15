// `node src/utils/motionPolish.selfcheck.mjs`
//
// Five motion details, and the two ways each of them breaks.
//
// Structural throughout: this is CSS, so there is no behaviour to exercise. What regresses is somebody
// deleting a rule, or — the one that actually happened while writing them — splitting a shared selector
// list in half by inserting a new rule in the middle of it, which silently stripped the cart button of
// every base style it had.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'styles', 'storefront.css'), 'utf8');
const home = readFileSync(join(root, 'pages', 'HomePage.jsx'), 'utf8');

// --- 1. The hero breathes, and stops for anyone who asked motion to stop ---------------------------
assert.match(css, /@keyframes hero-slow-zoom/, 'the hero has a slow zoom');
assert.match(css, /@media \(prefers-reduced-motion: no-preference\)\s*\{[^}]*\.home-hero__slide-image/,
  'and it only ever runs behind prefers-reduced-motion: no-preference');
// Desktop and phone are separate components with separate class names. Every visual change made to one
// and not the other is how they drift — the defect class this repo has been bitten by most.
assert.match(css, /@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]{0,400}?\.m-editorial-hero__image/,
  'the phone hero breathes too, or desktop and phone have already started to drift');
// Both ends above 1. Animating from scale(1) shows the page background at the edges for the whole
// fourteen seconds, because the image is exactly its box at 1 and smaller than it while easing.
const zoom = css.match(/@keyframes hero-slow-zoom \{([\s\S]*?)\n\}/);
assert.ok(zoom, 'the keyframes are readable');
const scales = [...zoom[1].matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1]));
assert.equal(scales.length, 2, 'two stops');
assert.ok(scales.every((v) => v > 1), `both ends must stay above 1, got ${scales.join(' and ')}`);

// --- 2. The hero text arrives out of focus, and NOTHING else does ----------------------------------
assert.match(css, /@keyframes hero-text-rise \{[\s\S]*?filter: blur\(6px\)[\s\S]*?filter: blur\(0\)/,
  'the hero text resolves from blurred to sharp');
// `filter` makes an element a containing block for fixed and sticky descendants. On the scroll reveal,
// which wraps entire sections, that would pin a sticky child in place for the length of every
// transition — the mobile action bar included.
const reveal = css.match(/\n\[data-reveal\] \{([\s\S]*?)\n\}/);
assert.ok(reveal, '[data-reveal] is readable');
assert.doesNotMatch(reveal[1], /filter:/,
  '[data-reveal] must not filter: it wraps whole sections, and filter breaks sticky descendants inside them');

// --- 3. The dark band is full-width WITHOUT 100vw ---------------------------------------------------
assert.match(home, /home-section home-section--flush home-section--dark/,
  'the journal is the full-width dark chapter break');
assert.match(css, /\.home-section--dark \{[\s\S]*?background: var\(--editorial-charcoal\)/, 'it is dark');
// And the phone's own storefront, which is a different component and would otherwise get none of this.
const mobileHome = readFileSync(join(root, 'pages', 'mobile', 'MobileStorefrontPage.jsx'), 'utf8');
assert.match(mobileHome, /m-editorial-section m-editorial-section--dark/,
  'the phone journal is a dark chapter break too');
assert.match(css, /\.m-editorial-section--dark \{[\s\S]*?background: var\(--editorial-charcoal, #[0-9a-f]{6}\)/,
  'and that class actually paints it dark, with a literal fallback the phone can resolve');
// A dark band with dark text on it is worse than no band. Both variants have to lift their body copy.
for (const rule of ['.home-section--dark .home-journal-card p', '.m-editorial-section--dark .m-editorial-journal-card p']) {
  assert.ok(css.includes(rule), `${rule} must lift its body copy off the dark ground`);
}
// 100vw counts the scrollbar. On any platform with a classic (non-overlay) scrollbar it is wider than
// the page and hands the body a horizontal scroll, which is why --flush pads instead of breaking out.
const flush = [...css.matchAll(/\.home-section--flush \{([\s\S]*?)\n(\s*)\}/g)].map((m) => m[1]);
assert.ok(flush.length >= 2, 'the flush rule exists at base and at the narrow breakpoint');
for (const body of flush) {
  assert.doesNotMatch(body, /width:\s*100vw|margin-left:\s*calc\(50% - 50vw\)/,
    'a full-width section must not use a 100vw breakout — it adds a horizontal scrollbar');
}
// A media query that narrows .home-section is LATER in the file than the base --flush rule and has the
// same specificity, so it wins unless --flush restates its width in the SAME block. One did not, and
// every "flush" section quietly stopped being flush below 900px — for as long as --flush had existed.
//
// So the invariant is not about one breakpoint: any block that re-declares .home-section's width has to
// re-declare --flush's too. Anchoring on "the 899px media query" would just find a different block the
// day somebody adds one.
{
  const blocks = [...css.matchAll(/@media[^{]*\{([\s\S]*?)\n\}\n/g)].map((m) => m[1]);
  const narrowing = blocks.filter((body) => /\.home-section \{[^}]*width:/.test(body));
  assert.ok(narrowing.length >= 1, 'at least one breakpoint narrows .home-section — this guard has something to check');
  for (const body of narrowing) {
    assert.match(body, /\.home-section--flush \{[^}]*width: 100%/,
      'a breakpoint that re-declares .home-section width must re-declare --flush width: 100% in the same block, or flush sections stop being flush there');
  }
}

// --- 4. A button answers the press ------------------------------------------------------------------
assert.match(css, /\.editorial-cart-button:active,\n\.editorial-button:active \{[\s\S]*?scale\(0\.98\)/,
  'pressing a button scales it, so a slow tap does not read as a missed one');
// The base styles are a SHARED selector list. Inserting a rule between the two selectors splits it and
// strips the cart button of everything — which is exactly what happened writing this, and the only
// symptom was a 44px button rendering at the wrong size.
assert.match(css, /\.editorial-cart-button,\n\.editorial-button \{\n  position: relative;/,
  'the shared base block must stay one rule: splitting the selector list silently unstyles the cart button');

// --- 5. One rule clips every image wrapper ------------------------------------------------------------
assert.match(css, /main :is\(a, figure, picture, div, span\):has\(> img\) \{\s*overflow: hidden;/,
  'a wrapper holding an image clips it, so a hover zoom never bleeds past its box');

// --- 6. The phone cannot see the desktop palette ------------------------------------------------------
// --editorial-charcoal, --editorial-ivory and --ease-smooth are declared on .solivagant-editorial-home,
// the DESKTOP storefront root. The phone app never carries that class, so a bare var() there resolves to
// nothing: a background silently becomes transparent, and an `animation` shorthand holding an unresolved
// easing is invalid as a whole and simply does not run.
//
// Both happened. The phone shipped ivory text on an ivory ground for one screenshot, and the guard above
// was green the entire time, because the rule existed — it just could not resolve.
{
  const phoneRules = [...css.matchAll(/(\.m-editorial-[^{]*)\{([^}]*)\}/g)];
  const bare = [];
  for (const [, selector, body] of phoneRules) {
    for (const use of body.matchAll(/var\((--[\w-]+)\s*\)/g)) {
      bare.push(`${selector.trim().split('\n')[0]} uses ${use[1]} with no fallback`);
    }
  }
  assert.deepEqual(bare, [],
    `the phone has no access to the desktop palette — every var() in an .m-editorial- rule needs a literal fallback:\n  ${bare.join('\n  ')}`);
  // And the shared animation, which the phone hero also runs.
  assert.match(css, /animation: hero-slow-zoom 14s var\(--ease-smooth, cubic-bezier\([^)]*\)\)/,
    'the hero animation carries a literal easing fallback, or it does not run on the phone at all');
}

console.log('motionPolish selfcheck OK (hero breathes and stops on request, blur stays off the scroll reveal, the dark band needs no 100vw, and the shared button block is still one rule)');
