// `node src/utils/formulaRevisionLineage.selfcheck.mjs`
//
// "Create PACED revision" makes a brand new, unrelated formula — name "X PACED", code "X-PACED" — and the
// only link back to its parent is a sentence inside `notes`. After three iterations the formula list
// holds four unconnected rows with no way to see what changed between them. The engine that makes this
// product worth using produces output the product cannot tidy up.
//
// The migration that records the link is applied by hand, so everything here must also hold while the
// columns do not exist: the revision is still created, just without ancestry, and the panel stays away.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildLineageChain, diffFormulaItems, groupFormulasByLineage, nextRevisionVersion } from './formulaRevisionLineage.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));
const readRaw = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// --- 1. The version chain must actually count ---------------------------------------------------------
// The old rule returned `${version}-R2` for anything containing "paced", so it went
// 1.0-PACED -> 1.0-PACED-R2 -> 1.0-PACED-R2-R2 -> 1.0-PACED-R2-R2-R2. Revision four called itself R2,
// same as revision three, and the string grew a tail instead of a number.
let version = '1.0';
const chain = [];
for (let i = 0; i < 4; i += 1) { version = nextRevisionVersion(version); chain.push(version); }
assert.deepEqual(chain, ['1.0-PACED', '1.0-PACED-R2', '1.0-PACED-R3', '1.0-PACED-R4'],
  'each revision must get its own number, and the suffix must not accumulate');
assert.equal(nextRevisionVersion(''), 'PACED', 'a formula with no version still gets a first label');
assert.equal(nextRevisionVersion(null), 'PACED');
assert.equal(nextRevisionVersion('   '), 'PACED', 'whitespace is not a version');
assert.equal(nextRevisionVersion('2.3'), '2.3-PACED', 'an ordinary version is preserved in front');
assert.equal(nextRevisionVersion('1.0-R9'), '1.0-R10', 'counting must not stop at one digit');

// --- 2. The chain, and what happens when an ancestor is missing ----------------------------------------
const formulas = [
  { id: 'a', name: 'Root', created_at: '2026-09-01T00:00:00Z' },
  { id: 'b', name: 'Rev 1', parent_formula_id: 'a', created_at: '2026-09-02T00:00:00Z' },
  { id: 'c', name: 'Rev 2', parent_formula_id: 'b', created_at: '2026-09-03T00:00:00Z' },
];
assert.deepEqual(buildLineageChain(formulas, 'c').map((entry) => entry.id), ['a', 'b', 'c'],
  'the chain runs oldest to newest, whichever member you opened');
assert.deepEqual(buildLineageChain(formulas, 'a').map((entry) => entry.id), ['a', 'b', 'c'],
  'opening the root shows the same chain');
assert.deepEqual(buildLineageChain(formulas, 'nope'), [], 'an unknown id has no chain');
assert.deepEqual(buildLineageChain([], 'a'), [], 'no formulas, no chain');

// A parent that was deleted (on delete set null) or simply is not in the list must not drop its child.
const orphaned = [{ id: 'c', name: 'Rev 2', parent_formula_id: 'missing' }];
assert.deepEqual(buildLineageChain(orphaned, 'c').map((entry) => entry.id), ['c'],
  'a revision whose parent is gone is its own root, not a row that vanishes');

// A hand-edited cycle must not hang the page.
const cyclic = [{ id: 'x', parent_formula_id: 'y' }, { id: 'y', parent_formula_id: 'x' }];
assert.equal(groupFormulasByLineage(cyclic).length >= 1, true, 'a cycle must terminate, not spin');

// --- 3. The diff ---------------------------------------------------------------------------------------
// The composer calls it gram_amount and the detail page calls it grams. Reading only one would make every
// diff say "nothing changed" — the most convincing way to be wrong.
const before = [{ item_id: 'a', name: 'Iso E Super', grams: 50 }, { item_id: 'b', name: 'Ambroxan', grams: 50 }];
const after = [{ item_id: 'a', name: 'Iso E Super', gram_amount: 60 }, { item_id: 'c', name: 'Hedione', grams: 10 }];
const diff = diffFormulaItems(before, after);

assert.equal(diff.changed.length, 1);
assert.equal(diff.changed[0].deltaGrams, 10, 'gram_amount on one side and grams on the other is the same field');
assert.equal(diff.changed[0].deltaPercent, 20);
assert.deepEqual(diff.added.map((entry) => entry.label), ['Hedione']);
assert.deepEqual(diff.removed.map((entry) => entry.label), ['Ambroxan']);
assert.equal(diff.removed[0].deltaGrams, -50, 'a removed material is a negative delta, not a blank');
assert.equal(diff.totalDelta, -30);
assert.equal(diff.hasChanges, true);

// Identical compositions must report no change at all, or the panel cries wolf on every revision.
const same = diffFormulaItems(before, [{ item_id: 'b', name: 'Ambroxan', grams: 50 }, { item_id: 'a', name: 'Iso E Super', grams: 50 }]);
assert.equal(same.hasChanges, false, 'reordering rows is not a change');
assert.equal(same.unchanged.length, 2);

// Duplicate rows of one material are summed, not overwritten.
const summed = diffFormulaItems([{ item_id: 'a', name: 'Iso E', grams: 10 }, { item_id: 'a', name: 'Iso E', grams: 15 }], [{ item_id: 'a', name: 'Iso E', grams: 25 }]);
assert.equal(summed.hasChanges, false, 'two rows of 10 and 15 equal one row of 25');

// Biggest move first.
const ordered = diffFormulaItems(
  [{ item_id: 'a', name: 'A', grams: 10 }, { item_id: 'b', name: 'B', grams: 10 }],
  [{ item_id: 'a', name: 'A', grams: 11 }, { item_id: 'b', name: 'B', grams: 40 }],
);
assert.deepEqual(ordered.changed.map((entry) => entry.label), ['B', 'A'], 'the biggest move is what the panel is opened for');

assert.equal(diffFormulaItems().hasChanges, false, 'called with nothing, no crash and no false alarm');
assert.equal(diffFormulaItems(null, null).totalDelta, 0);

// --- 4. The revision must record its parent -----------------------------------------------------------
const hook = read('hooks', 'useFormulaDetailPage.js');
assert.match(hook, /parent_formula_id: formula\.id/, 'a PACED revision must record which formula it came from');
assert.match(hook, /version: nextRevisionVersion\(formula\.version\)/, 'and must use the counting version');

// --- 5. It must still work with the migration unapplied ------------------------------------------------
// This is the half that decides whether the feature is safe to merge before Dekito runs the SQL.
const service = read('services', 'formulasSupabaseService.js');
assert.match(service, /42703/, 'the insert must recognise an undefined column');
assert.match(service, /isMissingLineageColumn\(error\)[\s\S]{0,300}?withoutLineageFields\(payload\)[\s\S]{0,80}?continue;/,
  'a missing lineage column must drop those fields and retry, not fail the whole create');
assert.match(service, /parent_formula_id === undefined \? \{\} : \{/,
  'lineage must only be written when the caller supplies it — this payload is shared with update, and '
  + 'forcing null would erase a revision\'s parent on its first save');

// --- 6. Silent when there is nothing to show ----------------------------------------------------------
const panel = read('components', 'FormulaLineagePanel.jsx');
assert.match(panel, /chain\.length < 2[\s\S]{0,60}?return null;/,
  'a formula with no revisions must render no panel');

// DetailSection paints a bordered card around whatever it wraps, including nothing — so the wrapper has
// to be gated too, or every never-revised formula grows a stray empty box.
const page = read('pages', 'FormulaDetailPage.jsx');
assert.match(page, /lineageChain\.length > 1 \? \(\s*<DetailSection>/,
  'the DetailSection wrapper must be gated as well as the panel inside it');

// --- 7. The migration must carry its own verify and rollback ------------------------------------------
const migration = readRaw('..', '..', '..', 'supabase', 'migrations', '20260914140000_formula_revision_lineage.sql');
assert.match(migration, /on delete set null/, 'deleting a parent must not delete its revisions');
assert.match(migration, /VERIFY/, 'the migration must say how to check it worked');
assert.match(migration, /ROLLBACK/, 'and how to undo it');
assert.match(migration, /add column if not exists parent_formula_id/, 'and be re-runnable');


// --- A revision must be readable: names, never UUIDs --------------------------------------------------
// From the live app, 2026-09-22: a 26-material revision rendered as a wall of
// "546f57b3-d39a-4595-b8ee-0ad4447b5476  0.211 g". Formula item rows carry item_id and grams; the name
// lives in the raw-material catalogue, and the page holds that catalogue already.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOnlyBefore = [{ item_id: '546f57b3-d39a-4595-b8ee-0ad4447b5476', gram_amount: 0.211 }];
const idOnlyAfter = [{ item_id: 'e1358603-04df-48ef-8edf-ad00cfca4622', gram_amount: 33.33 }];

const named = diffFormulaItems(idOnlyBefore, idOnlyAfter, {
  resolveName: (key) => ({
    '546f57b3-d39a-4595-b8ee-0ad4447b5476': 'Iso E Super',
    'e1358603-04df-48ef-8edf-ad00cfca4622': 'Ambroxan',
  }[key] || ''),
});
assert.equal(named.removed[0].label, 'Iso E Super', 'a removed material is named from the catalogue');
assert.equal(named.added[0].label, 'Ambroxan', 'and so is an added one');

// No resolver, or a material the catalogue does not know: say so, and keep the rows apart with a SHORT
// id. A 36-character UUID is not a name — printing it as one is the bug this rule exists for.
const unresolved = diffFormulaItems(idOnlyBefore, idOnlyAfter);
for (const entry of [...unresolved.added, ...unresolved.removed]) {
  assert.doesNotMatch(entry.label, UUID, `"${entry.label}" is a UUID, not a name`);
  // Against the rule, not the wording: pinning "Bahan tanpa nama" failed the first time the sentence was
  // reworded, which is a check punishing an improvement.
  assert.match(entry.label, /[A-Za-z]{3}/, `"${entry.label}" carries no words at all`);
  assert.ok(!UUID.test(entry.label.replace(/[()]/g, '').trim()), `"${entry.label}" is still just an id`);
  assert.ok(entry.label.length <= 32, `"${entry.label}" is too long to read in a list`);
}
assert.notEqual(unresolved.added[0].label, unresolved.removed[0].label,
  'two unnamed materials must not collapse into the same label');

// A row that carries its own name keeps it, resolver or not.
const carriesName = diffFormulaItems([], [{ item_id: 'x', name: 'Hedione', gram_amount: 1 }], { resolveName: () => 'Wrong' });
assert.equal(carriesName.added[0].label, 'Hedione', 'the row\'s own name wins over the lookup');

// And the page actually hands the catalogue over.
assert.match(hook, /diffFormulaItems\(parentItems, items, \{ resolveName: resolveMaterialName \}\)/,
  'the detail page must pass its raw-material index into the diff');
assert.match(hook, /rawMaterialsById\.get\(String\(materialId \|\| ''\)\)/,
  'and resolve through the index it already builds');

console.log('formulaRevisionLineage selfcheck OK (revisions know their parent, and still work without the migration)');
