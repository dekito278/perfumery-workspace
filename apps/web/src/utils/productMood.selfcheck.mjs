// `node src/utils/productMood.selfcheck.mjs`
import assert from 'node:assert/strict';
import { isPlaceholderMood, moodForEditing } from './productMood.js';

// The stored default, in each language it has been written in.
assert.equal(isPlaceholderMood('Custom perfume profile'), true);
assert.equal(isPlaceholderMood('Profil parfum bespoke'), true);
assert.equal(isPlaceholderMood('  custom PERFUME profile  '), true, 'case and padding must not smuggle it through');
assert.equal(isPlaceholderMood(''), true);
assert.equal(isPlaceholderMood(null), true);
assert.equal(isPlaceholderMood(undefined), true);

// A mood someone actually chose survives.
assert.equal(isPlaceholderMood('Tenang, harian'), false);
assert.equal(isPlaceholderMood('Hangat malam'), false);

// An editor opens empty on a placeholder, and untouched on a real value.
assert.equal(moodForEditing('Custom perfume profile'), '');
assert.equal(moodForEditing('Tenang, harian'), 'Tenang, harian');
assert.equal(moodForEditing(undefined), '');

// --- the rule is only worth anything where an editor actually opens ---------------------------------
//
// This guard used to test the helper and stop there, and the helper was never the problem. The DESKTOP
// product form spread the stored mood straight from the product and never called moodForEditing at all,
// so every product opened with 'Profil parfum bespoke' already typed into the Mood box — the exact
// thing the helper's own header says must not happen. The phone did it correctly. Two hand-written
// copies of the same builder, drifted on one field.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Where the placeholder comes from, read from the service rather than repeated here. If the stored
// default is ever changed to something PLACEHOLDER_MOODS does not know, the forms quietly go back to
// pre-filling it, and this is the assertion that notices.
const catalog = readFileSync(join(src, 'services', 'productCatalogService.js'), 'utf8');
const storedDefault = catalog.match(/mood: input\.mood \|\| '([^']+)'/)?.[1];
assert.ok(storedDefault, 'could not read the mood normalizeProduct stores by default — update this guard');
assert.equal(isPlaceholderMood(storedDefault), true,
  `normalizeProduct fills an empty mood with "${storedDefault}", which moodForEditing does not recognise `
  + 'as a placeholder — every product would open with it pre-typed into the Mood box');
assert.equal(moodForEditing(storedDefault), '', 'and so an editor must still open empty on it');

// --- and every editor that opens a mood box starts from the one builder -------------------------------
// Subject derived: a file under components/product that renders a mood input. Both layouts qualify, and
// a third would the day it is written.
const formDir = join(src, 'components', 'product');
const moodEditors = readdirSync(formDir)
  .filter((name) => name.endsWith('.jsx'))
  .filter((name) => /updateField\('mood'|form\.mood/.test(stripComments(readFileSync(join(formDir, name), 'utf8'))));
assert.ok(moodEditors.length >= 2,
  `only ${moodEditors.length} product form renders a mood input — the scan is broken, not the code`);

for (const name of moodEditors) {
  const source = stripComments(readFileSync(join(formDir, name), 'utf8'));
  assert.match(source, /toProductFormState/,
    `${name} builds its own editing state instead of the shared one, which is how the desktop form came `
    + 'to pre-fill the placeholder while the phone did not');

  // No second builder hiding in the file. `mood:` may appear once, in the blank product a NEW item
  // starts from — that one has no stored value to clean. Sliced by balancing braces, not by a window.
  const emptyAt = source.search(/const empty\w* = \{/);
  assert.ok(emptyAt >= 0, `${name}: could not find the blank-product constant — update this guard`);
  let depth = 0;
  let emptyEnd = emptyAt;
  for (let i = source.indexOf('{', emptyAt); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) { emptyEnd = i + 1; break; }
    }
  }
  const outsideBlank = source.slice(0, emptyAt) + source.slice(emptyEnd);
  assert.doesNotMatch(outsideBlank, /\bmood:\s/,
    `${name} sets a mood field outside its blank-product constant — that is a second builder, and the `
    + 'two of them are what drifted');
}

// The shared builder is what actually applies it.
const shared = stripComments(readFileSync(join(src, 'utils', 'productFormState.js'), 'utf8'));
assert.match(shared, /mood: moodForEditing\(product\.mood\)/,
  'the shared form state no longer cleans the stored mood — every editor would pre-fill the placeholder');

console.log(`productMood selfcheck OK (stored default "${storedDefault}" opens empty, ${moodEditors.length} editors on one builder)`);
