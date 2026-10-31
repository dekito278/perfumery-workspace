// `node src/utils/motionPolish.selfcheck.mjs`
//
// The motion details of the shop, and the ways each of them breaks.
//
// Structural throughout: this is CSS, so there is no behaviour to exercise. What regresses is somebody
// deleting a rule, or splitting a shared selector list in half by inserting a new rule in the middle of
// it — which once silently stripped the cart button of every base style it had.
//
// Rewritten for the Naskah Gelap storefront (2026-10-31). The rules it used to hold were on classes no
// page renders any more (.home-hero__slide-image, .home-section--dark, .editorial-button, the phone's
// .m-editorial-*), so it was guarding CSS that only stayed alive because this file named it. The same
// five promises, on the stylesheet the shop actually wears:
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '');
const naskah = strip(readFileSync(join(root, 'styles', 'naskah.css'), 'utf8'));
const storefront = strip(readFileSync(join(root, 'styles', 'storefront.css'), 'utf8'));

// Top-level rules and the bodies of reduced-motion blocks, read by brace depth rather than by regex so a
// nested media query cannot end a block early.
const blocks = (css) => {
  const out = [];
  let depth = 0;
  let start = 0;
  let head = '';
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      if (depth === 0) { head = css.slice(start, index).trim(); start = index + 1; }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) { out.push([head, css.slice(start, index)]); start = index + 1; }
    }
  }
  return out;
};
const top = blocks(naskah);

// --- 1. Anything that moves on its own stops for a reader who asked motion to stop -------------------
// A looping animation is the one motion a reader cannot avoid by not touching anything.
const animated = top
  .filter(([head, body]) => !head.startsWith('@') && /(?:^|;|\s)animation:\s*(?!none)/.test(body))
  .flatMap(([head]) => head.split(',').map((selector) => selector.trim()));
assert.ok(animated.length >= 1, 'no animation found in naskah.css — the parse is broken, or the ring stopped turning');
const reduced = top
  .filter(([head]) => /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(head))
  .flatMap(([, body]) => blocks(body))
  .filter(([, body]) => /animation:\s*none/.test(body))
  .flatMap(([head]) => head.split(',').map((selector) => selector.trim()));
for (const selector of animated) {
  assert.ok(reduced.includes(selector),
    `${selector} animates, and nothing under prefers-reduced-motion: reduce turns it off`);
}

// --- 2. The scroll reveal never filters -------------------------------------------------------------
// `filter` makes an element a containing block for fixed and sticky descendants. On the scroll reveal,
// which wraps entire sections, that would pin a sticky child in place for the length of every
// transition — the phone's buy bar included.
const reveal = storefront.match(/\n\[data-reveal\] \{([\s\S]*?)\n\}/);
assert.ok(reveal, '[data-reveal] is readable');
assert.doesNotMatch(reveal[1], /filter:/,
  '[data-reveal] must not filter: it wraps whole sections, and filter breaks sticky descendants inside them');

// --- 3. Full-width without 100vw ----------------------------------------------------------------------
// 100vw counts the scrollbar. On any platform with a classic (non-overlay) scrollbar it is wider than
// the page and hands the body a horizontal scroll. Every section here is full-bleed, so the rule is the
// whole file.
assert.doesNotMatch(naskah, /width:\s*100vw|calc\(50% - 50vw\)/,
  'a full-width section must not use a 100vw breakout — it adds a horizontal scrollbar');

// --- 4. A button answers the press ------------------------------------------------------------------
assert.match(naskah, /\.ng-btn:active:not\(:disabled\) \{\s*transform: scale\(0\.98\);/,
  'pressing a button scales it, so a slow tap does not read as a missed one');
const btn = top.find(([head]) => head === '.ng-btn');
assert.ok(btn, 'the .ng-btn base rule must stay one rule of its own — a split selector list unstyles the button');
assert.match(btn[1], /transition:[^;]*transform/, 'and the press eases rather than jumps');

// --- 5. One rule clips every image wrapper ------------------------------------------------------------
assert.match(storefront, /main :is\(a, figure, picture, div, span\):has\(> img\) \{\s*overflow: hidden;/,
  'a wrapper holding an image clips it, so a hover zoom never bleeds past its box');

// --- 6. Every token resolves on every page -----------------------------------------------------------
// The phone shipped ivory text on an ivory ground once, because its palette lived on a class the phone
// root never carried and a bare var() resolved to nothing. The ng tokens live on :root for that reason
// (the immersive page needed it too); every one this stylesheet uses has to be declared there.
const rootRule = top.find(([head]) => head === ':root');
assert.ok(rootRule, 'naskah.css declares its tokens on :root');
const declared = new Set([...rootRule[1].matchAll(/(--ng-[\w-]+)\s*:/g)].map((m) => m[1]));
const used = new Set([...naskah.matchAll(/var\((--ng-[\w-]+)\s*\)/g)].map((m) => m[1]));
const missing = [...used].filter((token) => !declared.has(token));
assert.deepEqual(missing, [], `these tokens are used bare but not declared on :root: ${missing.join(', ')}`);
assert.ok(used.size >= 8, `only ${used.size} tokens used — the scan is broken`);

console.log(`motionPolish selfcheck OK (${animated.length} animation(s) stop on request, no filter on the reveal, no 100vw, buttons answer the press, ${used.size} tokens all on :root)`);
