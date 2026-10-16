// `node src/utils/bottomNavIsReadable.selfcheck.mjs`
//
// The bar at the bottom of the phone shop is on every buyer screen, and five of its six labels were
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

console.log(`bottomNavIsReadable selfcheck OK (${inactive[1]} on rgb(${backgroundRgb.join(', ')}) = `
  + `${ratio.toFixed(2)}:1, AA for 9px text needs 4.5)`);
