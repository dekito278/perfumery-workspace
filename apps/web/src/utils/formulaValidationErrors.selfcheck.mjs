// `node src/utils/formulaValidationErrors.selfcheck.mjs`
//
// The composer kept row errors in ONE object under TWO key schemes that could not clear each other:
// the renderer and validateComposerFields used `item_${row_key}`, every per-field handler used
// `item_${index}`. Both feed `hasErrors`, which greys out the save button.
//
// The two failures that produced:
//   * a bad gram amount was stored under item_<index> and looked for under item_<row_key> — so it
//     rendered NOWHERE while still disabling the button. A grey button and no red text anywhere.
//   * "Duplicate material" was stored under item_<row_key> and cleared under item_<index>, so fixing
//     the duplicate never cleared it. validateComposerFields only re-runs on submit, and submit is what
//     the error disables — a dead end whose only exit is a reload that costs the whole composition.
//
// Desktop only: the mobile composer pages have their own flow and never touch validationErrors.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hasBlockingErrors, isRowErrorKey, pruneOrphanRowErrors, rowErrorKey } from './formulaValidationErrors.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(srcRoot, ...parts), 'utf8'));

// --- 1. Sweeping orphans, keeping everything else ----------------------------------------------------
const rows = [{ row_key: 'formula-item-a' }, { row_key: 'formula-item-b' }];
const errors = {
  name: 'Formula name is required',
  ingredients: 'Amount must be greater than 0',
  [rowErrorKey('formula-item-a')]: 'Duplicate material',
  [rowErrorKey('formula-item-gone')]: 'Amount must be a number',
};

const pruned = pruneOrphanRowErrors(errors, rows);
assert.equal(pruned[rowErrorKey('formula-item-gone')], undefined, 'an error for a deleted row must be swept');
assert.equal(pruned[rowErrorKey('formula-item-a')], 'Duplicate material', 'a live row keeps its error');
assert.equal(pruned.name, 'Formula name is required', 'a field error is not a row error and must survive');
assert.equal(pruned.ingredients, 'Amount must be greater than 0', 'the ingredients summary must survive');

// --- 2. Orphans must not block the save --------------------------------------------------------------
// This is the whole point. The old count included keys that render nowhere, so the button greyed out
// with nothing on screen to explain why and no way to re-run validation.
assert.equal(hasBlockingErrors({ [rowErrorKey('formula-item-gone')]: 'x' }, rows), false,
  'an error belonging to a row that no longer exists renders nowhere, so it must not block the save');
assert.equal(hasBlockingErrors({ [rowErrorKey('formula-item-b')]: 'x' }, rows), true,
  'an error on a row that IS on screen must still block the save');
assert.equal(hasBlockingErrors({ name: 'required' }, rows), true, 'a field error still blocks');
assert.equal(hasBlockingErrors({}, rows), false, 'no errors, no block');

// Reordering must change nothing — that is what indices could not survive.
assert.deepEqual(pruneOrphanRowErrors(errors, [...rows].reverse()), pruned,
  'sorting rows by gram must not change which errors are live');

// --- 3. Identity is preserved when nothing is dropped ------------------------------------------------
// Callers run this inside setState; a fresh object every keystroke would re-render for no reason.
const clean = { [rowErrorKey('formula-item-a')]: 'Duplicate material' };
assert.equal(pruneOrphanRowErrors(clean, rows), clean, 'return the original object when nothing is swept');

// --- 4. A row with no row_key must not have its error binned -----------------------------------------
// The writers fall back to the index. If the sweep did not mirror that fallback it would drop a REAL
// error on the next keystroke and hand back a re-enabled save button.
assert.deepEqual(pruneOrphanRowErrors({ item_0: 'Duplicate material' }, [{}]), { item_0: 'Duplicate material' },
  'a keyless row stores its error under the index, and the sweep must honour the same fallback');
assert.equal(isRowErrorKey('item_0'), true);
assert.equal(isRowErrorKey('ingredients'), false, 'the ingredients summary is not a row error');
assert.equal(isRowErrorKey('name'), false);

// --- 5. Nothing may key a composer row error by index any more ----------------------------------------
const composer = read('hooks', 'useFormulaComposer.js');
assert.doesNotMatch(composer, /nextErrors\[`item_\$\{[^}]*index\}`\]/,
  'useFormulaComposer must key row errors through rowErrorKey(row_key), not by position');
assert.doesNotMatch(composer, /errors\[`item_\$/, 'validateComposerFields must go through rowErrorKey too');
// The blanket rule: no hand-built row key anywhere in the composer. A single one is enough to split the
// namespace again, and a per-handler search can be fooled by a slice that runs into the next handler.
assert.doesNotMatch(composer, /`item_\$\{/,
  'useFormulaComposer must build every row error key with rowErrorKey(), never by interpolation');

const handlerBody = (name) => {
  const start = composer.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `could not locate ${name} — this check is asserting nothing`);
  const end = composer.indexOf('\n  const ', start + 1);
  return composer.slice(start, end === -1 ? undefined : end);
};

for (const handler of ['updateGramAmount', 'updateDilutionConfig', 'applyPaceRecommendation']) {
  const body = handlerBody(handler);
  assert.ok(body.length > 100, `${handler} body came back empty — this check is asserting nothing`);
  assert.match(body, /rowErrorKey\([^)]*row_key/, `${handler} must address row errors by row_key, not by position `
    + '(rowErrorKey(index) would pass through the builder and still write into the wrong namespace, where '
    + 'the sweep bins it as an orphan and the save button re-enables on an error nobody ever saw)');
}

// --- 6. Changing a row's material must clear that row's error -----------------------------------------
// Without this the duplicate fix is only half done: the error outlives the duplicate, and the only thing
// that could clear it (validateComposerFields) runs on a submit the error itself disables.
const updateItem = composer.slice(composer.indexOf('const updateItem ='), composer.indexOf('const handleLibrarySelect ='));
assert.ok(updateItem.length > 100, 'could not locate updateItem — this check is asserting nothing');
assert.match(updateItem, /delete nextErrors\[editedRowErrorKey\]/,
  'updateItem must clear the edited row\'s error, or a fixed duplicate keeps the save button grey forever');

// --- 7. Removing a row must sweep, and the renderer and pages must agree ------------------------------
const removeItem = composer.slice(composer.indexOf("const removeFormulaItem ="), composer.indexOf('const updateItem ='));
assert.match(removeItem, /pruneOrphanRowErrors\(/, 'removing a row must sweep its error, however the list shifts');

const editor = read('components', 'FormulaItemTableEditor.jsx');
assert.match(editor, /validationErrors\[rowErrorKey\(/, 'the table must read errors through the same key builder');
assert.doesNotMatch(editor, /validationErrors\[`item_\$/, 'no hand-built row error keys in the table');

for (const page of ['pages/CreateFormulaPage.jsx', 'pages/EditFormulaPage.jsx']) {
  const source = read(...page.split('/'));
  assert.match(source, /hasBlockingErrors\(validationErrors, formulaItems\)/,
    `${page} must ignore orphaned row errors when deciding whether to grey out the save button`);
  assert.doesNotMatch(source, /Object\.keys\(validationErrors\)\.length > 0/,
    `${page} must not count orphans as blockers`);
}

console.log('formulaValidationErrors selfcheck OK (one key scheme; an invisible error cannot lock the save button)');
