// `node src/utils/bespokePriceIsTheBasePrice.selfcheck.mjs`
//
// Bespoke stopped being an itemised build on 2026-10-23. Dekito's instruction: the 30 ml price is
// 569.000 — the same as a tier B bottle from the catalogue — and the bottle, cap and label choices
// "gausah ada". 50 ml follows his own ratio between the two sizes (395.000 / 240.000 = 1,646), applied
// to the new base: 939.000.
//
// SWITCHING THE OPTIONS OFF IS A DATA CHANGE, AND THE DATA CHANGE ALONE WOULD HAVE BROKEN THE PHONE.
// MobileBespokePage's look step demanded all three fields to count as complete:
//
//     isComplete: () => Boolean(form.bottleType && form.capDesign && form.labelDesign)
//
// With no option to pick, that step can never be finished, and the bespoke flow dead-ends on it — on
// the surface this shop is actually run from. The desktop page would have shown three tabs opening
// onto an empty panel, which is milder and still wrong.
//
// bespokeFloorPrice had a quieter version of the same bug: cheapestEnabled() fell back to options[0]
// when nothing was enabled, so a switched-off group still pushed its first row's price into the "mulai
// dari" figure — a number no buyer could choose, added to a price they could see.
//
// The rule, which outlives today's prices: a group with no enabled option costs nothing, is not a tab,
// and is not a step that must be completed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bespokeFloorPrice, cheapestEnabled } from './bespokeOrder.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. A group with nothing enabled costs nothing ----------------------------------------------------
assert.deepEqual(cheapestEnabled([{ price: 10000, enabled: false }, { price: 50000, enabled: false }]), {},
  'a group with every option disabled must price as nothing, not as its first row');
assert.equal(cheapestEnabled([]).price, undefined, 'an empty group has no price');
assert.equal(cheapestEnabled([{ price: 9, enabled: false }, { price: 7, enabled: true }]).price, 7,
  'and with one enabled option it is still the cheapest ENABLED one');

const settings = {
  bottleSizes: [{ price: 569000, enabled: true }, { price: 939000, enabled: true }],
  bottleTypes: [{ price: 10000, enabled: false }, { price: 50000, enabled: false }],
  capDesigns: [{ price: 5000, enabled: false }],
  labelDesigns: [{ price: 0, enabled: false }, { price: 75000, enabled: false }],
};
assert.equal(bespokeFloorPrice(settings), 569000,
  'the floor is the cheapest size and nothing else — a disabled group must add nothing');

// --- 2. The prices Dekito set, read off the bundled defaults ------------------------------------------
// The defaults are what a visitor sees for the instant before the table answers, and tools/build.mjs
// warns when they drift from it. A stale number here is a price promised and not honoured.
const defaults = read('services', 'bespokeSettingsService.js');
const sizes = defaults.slice(defaults.indexOf('bottleSizes: ['), defaults.indexOf('bottleTypes: ['));
assert.match(sizes, /"30 ml", price: 569000/, '30 ml must be 569.000');
assert.match(sizes, /"50 ml", price: 939000/, '50 ml must be 939.000');
for (const group of ['bottleTypes', 'capDesigns', 'labelDesigns']) {
  const block = defaults.slice(defaults.indexOf(`${group}: [`), defaults.indexOf('],', defaults.indexOf(`${group}: [`)));
  assert.ok(block.includes('enabled:'), `${group} has no rows to check`);
  assert.doesNotMatch(block, /enabled: true/,
    `${group} still has an option switched on; Dekito asked for the bottle/cap/label choices to go`);
}

// --- 3. Neither page offers a group it has nothing to put in ------------------------------------------
const desktop = read('pages', 'BespokePage.jsx');
assert.match(desktop, /\]\.filter\(\(group\) => group\.options\.length > 0\)/,
  'the desktop page must drop a choice group with no options rather than render an empty tab');

const phone = read('pages', 'mobile', 'MobileBespokePage.jsx');
assert.match(phone, /hidden: !\(bottleTypeOptions\.length \|\| capDesignOptions\.length \|\| labelDesignOptions\.length\)/,
  'the look step must mark itself hidden when it has nothing to show');
assert.match(phone, /\]\.filter\(\(step\) => !step\.hidden\)/,
  'and the flow must actually drop the hidden step');
assert.doesNotMatch(phone, /isComplete: \(\) => Boolean\(form\.bottleType && form\.capDesign && form\.labelDesign\)/,
  'the look step must not demand three fields the buyer has no way to fill');

// --- 4. The copy may not name a choice the buyer cannot make ------------------------------------------
// Switching the options off left two sentences behind that the live page still printed, word for word:
//   "Sebelum ongkir. Naik sesuai botol, cap, label, dan material yang dipilih."
//   "Cerita aroma, pilihan botol, delivery, dan payment dalam flow singkat."
// Both were true on 22 October and false on the 23rd, and that is the hazard: a note promising the total
// rises with a choice the buyer is never offered reads as a cost being hidden from them.
//
// The rule is tied to the DATA, not to today's wording: a group with no enabled option in the fallback
// may not be named in the two sentences that describe what the price depends on.
//
// Reviving a group is therefore a TWO-line change here, not one: section 2 above refuses any enabled
// bottle/cap/label option because that is Dekito's decision of 2026-10-23, and it fails first. Drop the
// group from section 2's list and this section lets its word back into the copy by itself.
const WORDS = { bottleTypes: ['botol', 'bottle'], capDesigns: ['cap', 'tutup'], labelDesigns: ['label'] };
const copy = read('i18n', 'messages.js');
for (const key of ['bsp.floorNote', 'bsp.flowLead']) {
  const line = copy.split('\n').find((l) => l.includes(`"${key}":`));
  assert.ok(line, `${key} is missing from the messages`);
  for (const [group, words] of Object.entries(WORDS)) {
    const at = defaults.indexOf(`${group}: [`);
    const block = defaults.slice(at, defaults.indexOf('],', at));
    if (block.includes('enabled: true')) continue;
    for (const word of words) {
      assert.doesNotMatch(line.toLowerCase(), new RegExp(`\\b${word}\\b`),
        `${key} still names "${word}", but ${group} has nothing a buyer can pick`);
    }
  }
}

console.log('bespokePriceIsTheBasePrice OK (30 ml 569.000 / 50 ml 939.000, and an empty group is not a tab, a step, or a price)');
