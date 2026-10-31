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
  assert.ok(defaults.includes(`${group}: `),
    `${group} is not declared in the defaults at all — the slice below would read the wrong block`);
  // Two legitimate shapes, and the difference matters. An EMPTY array is the group gone, which is what
  // Dekito asked for and what the shop's own table now holds. Rows that are all disabled is the older
  // shape, equally acceptable. What must never pass is a third case: a block this check could not find,
  // where "no option is switched on" would be true because nothing was read at all.
  const emptied = defaults.includes(`${group}: [],`);
  if (emptied) continue;

  const at = defaults.indexOf(`${group}: [`);
  const block = defaults.slice(at, defaults.indexOf('],', at));
  assert.ok(block.includes('enabled:'),
    `${group} is neither emptied nor a list of rows — this check read nothing, so its verdict means nothing`);
  assert.doesNotMatch(block, /enabled: true/,
    `${group} still has an option switched on; Dekito asked for the bottle/cap/label choices to go`);
}

// --- 3. Neither page offers a group it has nothing to put in ------------------------------------------
const desktop = read('pages', 'BespokePage.jsx');
assert.match(desktop, /\]\.filter\(\(group\) => group\.options\.length > 0\)/,
  'the desktop page must drop a choice group with no options rather than render an empty tab');

// The phone wizard's look step retired with the phone storefront (2026-10-31); the desktop rule above is
// the whole of it now.

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

// EVERY line carrying the key, not the first: these pages render in both shops, and the English copy
// named the same three choices. Checking only the Indonesian line would have passed while /en/bespoke
// still said "Choose the direction, size, bottle, cap, label and materials first."
// bsp.flowLead was the phone wizard's and left with it (2026-10-31).
const SENTENCES = ['bsp.floorNote', 'bsp.lead', 'bsp.designFirstTitle', 'bsp.designFirstBody'];
const lines = copy.split('\n');

// WHAT IS BANNED IS THE LIST, NOT THE WORD. A first attempt banned each word outright and fired on the
// English floorNote — "A bespoke BOTTLE is quoted one by one from abroad" — where the word means the
// product, not a choice of bottle shape. No word-level rule can tell those apart, so the rule matches
// the hazard instead: naming TWO OR MORE switched-off groups in one sentence is the enumeration that
// promises a buyer their total rises with choices nobody offers them.
//
// The trade is deliberate and worth stating: a sentence naming exactly one of them still passes. That
// is the price of letting "bottle" go on meaning the thing in the box.
const switchedOff = Object.entries(WORDS).filter(([group]) => {
  const at = defaults.indexOf(`${group}: [`);
  return !defaults.slice(at, defaults.indexOf('],', at)).includes('enabled: true');
});
for (const key of SENTENCES) {
  const carrying = lines.filter((l) => l.includes(`"${key}":`));
  assert.ok(carrying.length >= 2, `${key} should exist in both shops; found ${carrying.length}`);
  for (const line of carrying) {
    const named = switchedOff
      .filter(([, words]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(line.toLowerCase())))
      .map(([group]) => group);
    assert.ok(named.length < 2,
      `${key} lists ${named.join(' + ')} — groups with nothing a buyer can pick:\n  ${line.trim()}`);
  }
}

// And the two sentences this was found by, by name, so no rewrite quietly restores them.
for (const gone of [
  'Naik sesuai botol, cap, label, dan material yang dipilih',
  'Choose the direction, size, bottle, cap, label and materials first',
]) {
  assert.ok(!copy.includes(gone), `the copy brought back: "${gone}"`);
}

// --- 5. The preview names only the parts that exist ---------------------------------------------------
// Its meta strip was four fixed spans falling back to the generic word, so with the three groups off it
// read "Botol · Cap · Label" permanently — categories named, none offered, and no price attached to any
// of them. The sticker on the mockup printed "Label" the same way. Found on the live desktop page after
// the phone had already been checked and passed: the two pages fail differently.
for (const part of ['size', 'bottle', 'cap', 'label', 'material']) {
  // `part?.label` since the redesign: a part that exists but has no name is not printed as an empty box.
  assert.match(desktop, new RegExp(`\\{${part}(\\?\\.label)? \\? <span`),
    `the preview still prints a ${part} span unconditionally, so it names a part that may not exist`);
}
assert.doesNotMatch(desktop, /\{label\?\.label \|\| t\('bsp\.label'\)\}/,
  'the mockup sticker must not fall back to the word "Label"');
assert.match(desktop, /options: exoticMaterialOptions\.length \? \[noneMaterialOption/,
  'a Material tab whose only option is "no add-on" is not a choice and must not be offered');

// --- 6. The step chip says what the step holds ---------------------------------------------------------
// The desktop flow labelled step 3 "Botol" while the only thing in it was the size picker. A label that
// names a choice the panel no longer offers is the same defect as the copy above, one layer out.
const stepLine = desktop.split('\n').find((l) => l.includes('const stepKeys ='));
assert.ok(stepLine, 'the desktop step list has moved; this assertion no longer reads it');
for (const [group, words] of switchedOff) {
  for (const word of words) {
    assert.doesNotMatch(stepLine, new RegExp(`'bsp\\.${word}'`),
      `the step chips still name bsp.${word}, but ${group} has nothing a buyer can pick`);
  }
}

console.log('bespokePriceIsTheBasePrice OK (30 ml 569.000 / 50 ml 939.000, and an empty group is not a tab, a step, or a price)');
