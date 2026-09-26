// `node src/utils/productFormCoversTheForm.selfcheck.mjs`
//
// Both product forms decide "are there unsaved changes" by stringifying a snapshot of the form and
// comparing it to the snapshot taken at load. That one boolean drives the beforeunload warning and the
// "discard changes?" confirmation on the way out.
//
// The snapshot was written twice, by hand, and the two lists drifted. The phone's omitted mood, wear and
// intensity — three fields its own form edits, with its own inputs, one of them a whole picker. So
// changing any of them on a phone left the form looking untouched: no warning, no confirmation, and the
// edit gone the moment you navigated away.
//
// Written by hand is the root of it. A field gets added to the form and wired to an input; the snapshot
// twenty lines above is not where anyone looks. So the rule is not "these fields are in the snapshot" —
// it is that the snapshot covers whatever the forms actually edit, and the field list is derived from
// the inputs rather than restated beside them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

const snapshotSource = readFileSync(join(src, 'utils', 'productFormSnapshot.js'), 'utf8')
  .replace(/'@\//g, `'${pathToFileURL(src).href}/`);
const { snapshotProductForm } = await import(
  `data:text/javascript;base64,${Buffer.from(snapshotSource, 'utf8').toString('base64')}`
);

// --- 1. The snapshot, run ---------------------------------------------------------------------------------
const base = { name: 'La Rose', priceNumber: 289000, intensity: 'Medium', wear: {}, mood: '' };
assert.equal(snapshotProductForm(base), snapshotProductForm({ ...base }),
  'the same form twice is not an unsaved change');
for (const [field, changed] of [
  ['mood', 'tenang, harian'],
  ['intensity', 'Strong'],
  ['wear', { work: true }],
  ['restockThreshold', 12],
  ['name', 'La Rose II'],
  // Flipped away from the default Boolean(undefined) === false, or the case proves nothing — the
  // first version of this line compared false against false and failed the code for the test's mistake.
  ['catalogVisible', true],
]) {
  assert.notEqual(snapshotProductForm({ ...base, [field]: changed }), snapshotProductForm(base),
    `editing ${field} must register as an unsaved change — on the phone three of these did not, and the `
    + 'edit was lost on the way out with no warning');
}
assert.equal(snapshotProductForm(), snapshotProductForm({}), 'a missing form must not throw');

// --- 2. Everything the forms edit is in it ------------------------------------------------------------------
// Derived from the inputs: every updateField('x') in either form is a field a person can change, and a
// field a person can change has to be visible to the comparison.
const forms = ['components/product/ProductForm.jsx', 'components/product/MobileProductForm.jsx'];
const snapshotText = readFileSync(join(src, 'utils', 'productFormSnapshot.js'), 'utf8');
const edited = new Set();
for (const form of forms) {
  const text = readFileSync(join(src, form), 'utf8');
  assert.match(text, /snapshotProductForm/,
    `${form} no longer uses the shared snapshot, which is how the two drifted the first time`);
  assert.doesNotMatch(text, /const snapshotProductForm = /,
    `${form} has grown its own snapshot again`);
  for (const match of text.matchAll(/updateField\('([A-Za-z_$][\w$]*)'/g)) edited.add(match[1]);
}
assert.ok(edited.size >= 10,
  `expected to find the editable fields, found ${edited.size} — the scan is broken, not the code`);

// Fields the snapshot deliberately ignores, each for a stated reason rather than by oversight.
const IGNORED = new Set([
  // A note typed to explain one stock correction, cleared on save. It is not part of the product, and
  // counting it would make a form dirty for a field that will not be kept.
  'stockAdjustmentNote',
  // Tags the owner never sees or types; they are derived on save from the visible ones.
  'internalTags',
]);
const missing = [...edited].filter((field) => !IGNORED.has(field) && !new RegExp(`^\\s{2}${field}:`, 'm').test(snapshotText));
assert.deepEqual(missing, [],
  'a field the forms let someone edit is invisible to the unsaved-changes check. Changing it leaves the '
  + `form looking untouched, so leaving the page throws the edit away without asking: ${missing.join(', ')}`);

console.log(`productFormCoversTheForm selfcheck OK (${edited.size} editable fields, all of them visible `
  + 'to the unsaved-changes check)');
