// `node src/utils/storefrontRegion.selfcheck.mjs`
//
// Which shop a visitor is looking at used to be decided entirely by guessing at their browser. The guess
// is a good one — a German customer has a German browser — but it could not be argued with: Dekito could
// not see his own international shop from Indonesia, a VPN does not change it (a VPN moves the IP, not
// the clock or the language), and a visitor read wrong had no way to say so.
//
// Now the visitor can choose, and the choice wins. This is the rule that decides between the two, and
// the wiring that keeps every part of the page agreeing on the answer.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  REGION_EN,
  REGION_ID,
  REGION_STORAGE_KEY,
  isValidRegion,
  resolveRegion,
} from './storefrontRegion.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. A stored choice always wins ---------------------------------------------------------------------
// Including a choice of Indonesia by someone the detection thinks is abroad. That is exactly the person
// the switch exists for; second-guessing them makes it a suggestion rather than a control.
assert.equal(resolveRegion(REGION_ID, true), REGION_ID, 'choosing Indonesia beats a detection that says otherwise');
assert.equal(resolveRegion(REGION_EN, false), REGION_EN, 'and choosing international beats one that says Indonesia');

// --- 2. With no choice, the guess decides — and Indonesia is the default -----------------------------------
assert.equal(resolveRegion(null, true), REGION_EN, 'a browser that looks foreign starts on the international shop');
assert.equal(resolveRegion(null, false), REGION_ID);
for (const nothing of [undefined, '', 'xx', 'ID', 'EN', 0, {}, []]) {
  assert.equal(resolveRegion(nothing, false), REGION_ID,
    `${JSON.stringify(nothing)} is not a stored choice, so the guess decides`);
}
assert.equal(isValidRegion('ID'), false, 'the stored value is lowercase; a stray case is not a choice');
assert.equal(REGION_STORAGE_KEY, 'solivagant.storefront.region.v1');

// --- 3. Blocked storage must not break the switch ----------------------------------------------------------
// Private windows throw on both read and write. The choice still has to apply to this page view.
const util = read('utils', 'storefrontRegion.js');
assert.match(util, /export const readStoredRegion[\s\S]{0,400}?\} catch \{[\s\S]{0,200}?return null;/,
  'a read that throws means "no choice yet", not a crash');
assert.match(util, /export const writeStoredRegion[\s\S]{0,400}?\} catch \{[\s\S]{0,260}?return false;/,
  'a write that throws is reported, not thrown');

// --- 4. One shared answer, not one per component ------------------------------------------------------------
// Each component resolving its own would let the header say Indonesia while the price panel says
// international, and the two would disagree for a whole page view.
const hook = read('hooks', 'useStorefrontRegion.js');
assert.match(hook, /const listeners = new Set\(\);/, 'one value, published to every subscriber');
assert.match(hook, /useEffect\(\(\) => \{[\s\S]{0,400}?publish\(resolveRegion\(readStoredRegion\(\), detectOverseasVisitor\(\)\)\);/,
  'resolved in an effect, never during render — the product pages are prerendered');
assert.match(hook, /let current = REGION_ID;/,
  'and until that effect runs the answer is Indonesia, which is what the prerendered HTML already says');
assert.match(hook, /writeStoredRegion\(next\);\s*publish\(next\);/,
  'a choice is stored and published — blocked storage still changes this page view');

// --- 5. The price panel follows the CHOICE, not the raw guess --------------------------------------------------
const priceHook = read('hooks', 'useOverseasPrice.js');
assert.match(priceHook, /const \{ isInternational: overseasVisitor \} = useStorefrontRegion\(\);/,
  'the export price panel reads the chosen region');
assert.doesNotMatch(priceHook, /detectOverseasVisitor/,
  'and no longer detects for itself — the guess reaches it only through the region');

// --- 6. A control, not a gate ---------------------------------------------------------------------------------
// A question before the shop costs visitors who would have looked, and an Indonesian who taps
// "international" by mistake is shown prices 3,5x higher and leaves.
const widget = read('components', 'storefront', 'RegionSwitch.jsx');
assert.doesNotMatch(widget, /Dialog|Modal|overlay|fixed inset-0/,
  'the switch must never become a gate in front of the shop');
assert.match(widget, /aria-pressed=\{region === option\.value\}/, 'the current choice is announced, not just coloured');
assert.match(widget, /aria-label="Wilayah harga \/ Pricing region"/, 'labelled in both languages, since it is the one control both read');

// On both storefronts. Desktop and mobile drifting apart is this repo's commonest defect, and a switch on
// one of them teaches the visitor the other surface has no choice.
assert.match(read('components', 'storefront', 'PublicHeader.jsx'), /<RegionSwitch /, 'in the desktop header');
assert.match(read('layouts', 'MobileCommerceLayout.jsx'), /<RegionSwitch \/>/, 'and in the mobile one');

console.log('storefrontRegion selfcheck OK (the visitor chooses and the choice wins; the guess is only the default, and it is a switch rather than a gate)');
