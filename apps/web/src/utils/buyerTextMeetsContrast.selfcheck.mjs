// `node src/utils/buyerTextMeetsContrast.selfcheck.mjs`
//
// Small text on a brand colour, where the two halves live in different files and neither is wrong on
// its own. Each pair below was measured on the live phone shop before it was fixed.
//
// 1. THE BOTTOM NAVIGATION. The bar at the bottom of the phone shop is on every buyer screen, and five of its six labels were
// grey #8b949e on a 98%-white bar at 9px bold: a contrast ratio of 3.08:1, where WCAG AA asks 4.5 for
// text that size. Measured on the live shop, not estimated. The sixth — the active one — is near-black
// and reads 17.41.
//
// Nothing in the repo could have said so: the colour is a Tailwind arbitrary value in the layout and the
// background is a rule in mobile.css, two files apart, and neither is wrong on its own. So this computes
// the ratio from those two sources rather than pinning the hex, which means a future palette change is
// checked instead of merely noticed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const channel = (value) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
export const contrastRatio = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};
const hex = (value) => {
  const text = value.replace('#', '');
  const full = text.length === 3 ? [...text].map((c) => c + c).join('') : text;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

// Both halves, read where they are actually written.
const layout = read('layouts', 'MobileCommerceLayout.jsx');
const inactive = layout.match(/active \? '[^']*' : 'text-\[(#[0-9a-fA-F]{3,6})\]'/);
assert.ok(inactive, 'cannot find the inactive label colour in the commerce bottom nav — this check reads '
  + 'it out of the layout, so a refactor that moves it has to update this line too');

const mobileCss = read('styles', 'mobile.css');
const navBlock = mobileCss.slice(mobileCss.indexOf('\n.mobile-bottom-nav {'));
const background = navBlock.slice(0, navBlock.indexOf('}')).match(/background:\s*rgba?\(([^)]+)\)/);
assert.ok(background, 'cannot find the bottom bar background in mobile.css');
const backgroundRgb = background[1].split(',').slice(0, 3).map((n) => Number(n.trim()));

// 9px bold is not "large text" under WCAG, so the bar for it is 4.5, not 3.
const ratio = contrastRatio(hex(inactive[1]), backgroundRgb);
assert.ok(ratio >= 4.5,
  `the inactive labels in the phone bottom nav read ${ratio.toFixed(2)}:1 (${inactive[1]} on `
  + `rgb(${backgroundRgb.join(', ')})), and WCAG AA asks 4.5 for 9px text. Those five labels are on `
  + 'every buyer screen there is');

// The sanity check in the other direction: a known-failing pair must fail, or the arithmetic above is
// not doing anything. #8b949e on white is exactly the 3.08 that was measured on the live shop.
assert.ok(contrastRatio(hex('#8b949e'), [255, 255, 255]) < 4.5,
  'the contrast maths has stopped failing the colour this guard was written for, so it would now pass '
  + 'anything');
assert.equal(Math.round(contrastRatio(hex('#8b949e'), [255, 255, 255]) * 100) / 100, 3.08);
assert.equal(Math.round(contrastRatio(hex('#000000'), [255, 255, 255]) * 100) / 100, 21);

// 2. THE SELECTED FILTER CHIP, on the catalogue and the articles screens. White on the decorative
// brass #b08b4f read 3.16:1 at 11px bold. The palette already carries a darker brass for small text —
// storefront.css names it --editorial-brass-text and says why — and white on that reads 5.08. The rule
// here is the ratio, so swapping either colour is checked rather than trusted.
const chips = read('components', 'mobile-ui', 'MobileFilterChips.jsx');
const selected = chips.match(/active\s*\n?\s*\?\s*'[^']*bg-\[(#[0-9a-fA-F]{3,6})\][^']*text-(\w+)/);
assert.ok(selected, 'cannot read the selected chip colours out of MobileFilterChips — this check reads '
  + 'the class list, so a refactor has to update it here too');
assert.equal(selected[2], 'white', 'the selected chip label is no longer white; re-measure the pair');
const chipRatio = contrastRatio([255, 255, 255], hex(selected[1]));
assert.ok(chipRatio >= 4.5,
  `the selected filter chip reads ${chipRatio.toFixed(2)}:1 (white on ${selected[1]}) at 11px, and WCAG `
  + 'AA asks 4.5. It is the control that says which category the buyer is looking at');

// The decorative brass must still be refused, or this rule has stopped meaning anything.
assert.ok(contrastRatio([255, 255, 255], hex('#b08b4f')) < 4.5,
  'white on the decorative brass has stopped failing, so the arithmetic is wrong');

// 3. THE SMALL-TEXT BRASS, AGAINST THE BACKGROUND IT IS ACTUALLY ON.
// The token carried its own claim — "WCAG AA ~4.6:1 on ivory" — and the colour did not reach it:
// #8a6a35 on --editorial-ivory reads 4.45, under the 4.5 that 11px text needs. It cleared on paper
// (4.81) and on white (5.01), which is where the number must have come from; the home page's own
// background is the ivory, and every `.editorial-eyebrow` on it sat at 4.45.
//
// Read out of the stylesheet so the claim cannot drift from the colour again: whatever the token is,
// it is measured against the background the storefront actually paints behind it.
const storefront = read('styles', 'storefront.css');
const tokenValue = (name) => {
  const match = storefront.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  assert.ok(match, `--${name} is no longer a hex in storefront.css — this check reads it from there`);
  return match[1];
};
const brassText = tokenValue('editorial-brass-text');
const ivory = tokenValue('editorial-ivory');
const paper = tokenValue('editorial-paper');
assert.match(storefront, /\.editorial-eyebrow \{[\s\S]{0,160}?color: var\(--editorial-brass-text\)/,
  'the eyebrow no longer takes its colour from the small-text brass — re-measure the pair this check holds');
for (const [name, background] of [['ivory', ivory], ['paper', paper]]) {
  const value = contrastRatio(hex(brassText), hex(background));
  assert.ok(value >= 4.5,
    `the small-text brass ${brassText} reads ${value.toFixed(2)}:1 on the ${name} ${background}, and the `
    + 'eyebrows it paints are 11px. WCAG AA asks 4.5 for text that size');
}
// And the decorative brass stays decorative: it is NOT good enough for small text, which is the whole
// reason there are two of them.
assert.ok(contrastRatio(hex(tokenValue('editorial-brass')), hex(ivory)) < 4.5,
  'the decorative brass now passes for small text, so the two tokens have collapsed into one and the '
  + 'distinction this pair exists for is gone');

console.log(`buyerTextMeetsContrast selfcheck OK (small-text brass ${brassText} clears AA on both `
  + `storefront backgrounds, bottom nav ${inactive[1]} = ${ratio.toFixed(2)}:1, `
  + `selected chip white on ${selected[1]} = ${chipRatio.toFixed(2)}:1; AA needs 4.5)`);
