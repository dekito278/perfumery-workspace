// `node src/utils/noDefaultIsNotUnanswered.selfcheck.mjs`
//
// A question the shop never asked is not a question the buyer declined to answer.
//
// The bespoke brief collapses blank rows into one line — "Tidak diisi: Mood, Budget, …" — and keeps a set
// of labels out of it, with the reason written beside the set: "Voucher, fee and total are absent because
// the order had none, not because anybody declined to answer."
//
// Exotic material belongs in that sentence and was left out of it. bespokeFloorPrice sums FOUR of the five
// option groups and skips this one, for the reason written beside cheapestEnabled: "it is the one group
// with no default — a buyer who picks nothing pays nothing for it." The file states the rule twice and the
// set omitted the one item both describe.
//
// Measured 2026-10-02: storefront_bespoke_options has rows in four collections and NONE in exoticMaterials,
// so no buyer has ever been shown the question. The single order written since blanks were collapsed reads
// "Tidak diisi: Mood, Budget, Avoided notes, Story, Exotic material, Reference scent" — one choice nobody
// was offered, listed alongside five the buyer really did skip.
//
// Derived, not listed: the groups that carry no default are the ones the FLOOR PRICE excludes, and their
// brief labels come from the i18n catalogue. Add a sixth option group tomorrow and this still holds.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

// --- 1. Which groups have no default, from the floor price itself -------------------------------------
const settings = strip(readFileSync(join(src, 'services', 'bespokeSettingsService.js'), 'utf8'));
const collections = /optionCollections = \[([^\]]*)\]/.exec(settings);
assert.ok(collections, 'bespokeSettingsService must still name its option collections');
const allGroups = [...collections[1].matchAll(/'(\w+)'/g)].map((match) => match[1]);
assert.ok(allGroups.length >= 5, `expected the five option groups; found ${allGroups.join(', ')}`);

const bespoke = strip(readFileSync(join(src, 'utils', 'bespokeOrder.js'), 'utf8'));
const floor = /bespokeFloorPrice = \(settings = \{\}\) => \(\s*\[([^\]]*)\]/.exec(bespoke);
assert.ok(floor, 'bespokeOrder must still compute a floor price from the option groups');
const priced = [...floor[1].matchAll(/settings\.(\w+)/g)].map((match) => match[1]);

const noDefault = allGroups.filter((group) => !priced.includes(group));
console.log(`  option groups: ${allGroups.length}, in the floor price: ${priced.length}`);
console.log(`  no default (a buyer may pick nothing): ${noDefault.join(', ') || '(none)'}`);
assert.ok(noDefault.length >= 1,
  'every option group is now in the floor price, so nothing is optional — if that is deliberate, this '
  + 'chain is what needs changing, not the rule');

// Their brief labels come from ORDER_NOTE_KEYS, which exists for exactly this: "every label either
// builder emits must be listed". Not from the i18n catalogue — a first version looked there and got
// "Material eksotis", because these labels are structured data in the notes column, not UI copy, and the
// Indonesian block comes first in messages.js.
const noteKeys = strip(readFileSync(join(src, 'utils', 'orderNotes.js'), 'utf8'));
const registry = /ORDER_NOTE_KEYS = \[([\s\S]*?)\]/.exec(noteKeys);
assert.ok(registry, 'orderNotes must still register the labels both builders emit');
const registered = [...registry[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
const flatten = (value) => value.toLowerCase().replace(/[^a-z]/g, '');
const labels = noDefault.map((group) => {
  const singular = flatten(group.replace(/ies$/, 'y').replace(/s$/, ''));
  const found = registered.find((key) => flatten(key) === singular);
  assert.ok(found,
    `the option group ${group} has no label in ORDER_NOTE_KEYS, so a line naming it would be glued onto `
    + 'the previous row by parseOrderNoteRows');
  return found;
});
console.log(`  brief labels: ${labels.join(', ')}`);

// --- 2. Both writers must treat them as answers, not gaps ---------------------------------------------
const optional = /const optional = new Set\(\[([^\]]*)\]\)/.exec(bespoke);
assert.ok(optional, 'buildBespokeNotes must still keep a set of labels out of the "Tidak diisi" line');
const excused = [...optional[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
const blamed = labels.filter((label) => !excused.includes(label));
assert.deepEqual(blamed, [],
  'the brief names these as something the buyer left blank, but they are groups with NO DEFAULT — the '
  + 'floor price itself excludes them because picking nothing is the expected answer:\n  ' + blamed.join('\n  '));

// And the checkout draft, which prints a line per field rather than collapsing them.
const draft = bespoke.slice(bespoke.indexOf('export const buildBespokeCheckoutDraft'));
const draftBody = draft.slice(0, draft.indexOf('\n];'));
assert.ok(draftBody.length > 400, 'buildBespokeCheckoutDraft is gone — update this chain, not the rule');
const unconditional = labels.filter((label) => {
  const line = new RegExp(`formatLine\\('${label}', ([^)]*)\\)`).exec(draftBody);
  if (!line) return false;
  // Conditional in the idiom this function already uses for the customer code.
  return !new RegExp(`\\?\\s*formatLine\\('${label}'`).test(draftBody);
});
assert.deepEqual(unconditional, [],
  'the checkout draft prints these with a "-" whatever the buyer did, for groups the shop may offer no '
  + 'options for at all:\n  ' + unconditional.join('\n  '));

// --- 3. The collapse itself still works, run rather than read -----------------------------------------
// Both are already exported by the module, so re-exporting them is a duplicate-export SyntaxError. Only
// the imports have to go: the alias '@/...' is not resolvable outside vite.
const shim = bespoke.replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const { buildBespokeNotes, buildBespokeCheckoutDraft } = await import(
  `data:text/javascript;base64,${Buffer.from(shim, 'utf8').toString('base64')}`
);

const notes = buildBespokeNotes({
  deliveryAddress: 'Jl. Mawar 1', perfumeName: 'Senja', preferredNotes: 'Oud, vanila',
  bottleType: 'Botol bening', capDesign: 'Cap Basic', labelDesign: 'Label Basic', size: '30 ml',
});
for (const label of labels) {
  assert.doesNotMatch(notes, new RegExp(`Tidak diisi:[^\\n]*${label}`),
    `${label} is still named as unanswered on a brief that never offered it`);
  assert.doesNotMatch(notes, new RegExp(`^${label}: -$`, 'm'), `${label} still gets a placeholder row of its own`);
}
// The ones the buyer really did skip are still named — the signal this collapse exists to keep.
assert.match(notes, /Tidak diisi:[^\n]*Mood/, 'a question the buyer was asked and skipped must still be named');
assert.match(notes, /Tidak diisi:[^\n]*Story/);
// And a chosen exotic material is reported, so the fix did not hide a real answer.
const chosen = buildBespokeNotes({ perfumeName: 'Senja', exoticMaterial: 'Oud Kalimantan' });
assert.match(chosen, /Exotic material: Oud Kalimantan/, 'a material the buyer DID pick must still appear');
assert.match(buildBespokeCheckoutDraft({ exoticMaterial: 'Oud Kalimantan' }), /Exotic material: Oud Kalimantan/);
assert.doesNotMatch(buildBespokeCheckoutDraft({ perfumeName: 'Senja' }), /Exotic material/,
  'and the draft says nothing about it when nothing was chosen');

console.log(`noDefaultIsNotUnanswered selfcheck OK (${labels.length} group with no default, named as an answer in both writers)`);
