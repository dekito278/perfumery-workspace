// `node src/utils/oneCompositionRule.selfcheck.mjs`
//
// Four screens compose a formula: CreateFormulaPage and EditFormulaPage on the desktop, and their two
// phone twins. A formula is not a document — it is what batch production scales, what the material
// ledger deducts against, and what COGS is computed from — so the four have to agree about what a valid
// composition is.
//
// Three of the rules were already shared, and the history shows how: audit round 7 found that the phone
// skipped validateFormulaItems entirely, so an incomplete dilution (a percentage with no solvent) saved
// silently and came back wrong. Both phone screens were taught to call it, with a comment saying so.
//
// One rule was not, because it was not in that function. "Duplicate material" lives inside
// validateComposerFields, which only the two desktop composers call. So the phone would save a formula
// naming the same material on two rows — and the desktop then refused to save that same formula at all,
// flagging a row with no way to fix it but deletion. The rule was written with real care, down to keying
// the error by row id rather than index so it survives an insert (audit round 8), and half the screens
// could not ask it.
//
// The rule here: every screen that writes a composition asks the same questions. Both are derived —
// the screens by walking disk for the ones that submit composition items, the questions by running the
// shared validators rather than reading them.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// The rule itself, run. useFormulaComposer.js is a React hook module whose import graph reaches the
// supabase client, so its imports are stripped one line at a time and replaced with stubs. Two of them
// are real: rowErrorKey, because the whole audit-round-8 fix is about what key an error gets, and
// pruneOrphanRowErrors, which it sits beside. validateFormulaItems is a SPY — this guard is about the
// duplicate rule, and section 2 is what checks that the per-row validator is still called at all.
const calls = [];
const stubs = `
import { pruneOrphanRowErrors, rowErrorKey } from '${pathToFileURL(join(src, 'utils', 'formulaValidationErrors.js')).href}';
const validateFormulaItems = (items) => { globalThis.__itemChecks.push(items); return []; };
const useState = () => [null, () => {}];
const useCallback = (fn) => fn;
const useMemo = (fn) => fn();
const useRef = () => ({ current: null });
const useEffect = () => {};
`;
globalThis.__itemChecks = calls;
const hookSource = stubs + readFileSync(join(src, 'hooks', 'useFormulaComposer.js'), 'utf8')
  .replace(/^import\b[^\n]*from '[^']+';\n/gm, '');
const { duplicateMaterialErrors, validateComposerFields } = await import(
  `data:text/javascript;base64,${Buffer.from(hookSource, 'utf8').toString('base64')}`
);

// --- 1. The question, answered ---------------------------------------------------------------------------
const rows = (...ids) => ids.map((item_id, index) => ({ item_id, row_key: `r${index}` }));

assert.deepEqual(duplicateMaterialErrors(rows('vanilla', 'iso-e', 'musk')), {},
  'three different materials is a formula, not a mistake');
assert.deepEqual(duplicateMaterialErrors(rows('vanilla', 'iso-e', 'vanilla')), { item_r2: 'Duplicate material' },
  'the SECOND mention is the error — flagging the first would ask the perfumer to delete the row they meant');
assert.deepEqual(duplicateMaterialErrors(rows('a', 'a', 'a')), {
  item_r1: 'Duplicate material',
  item_r2: 'Duplicate material',
}, 'every repeat is flagged, not just the first');
// Keyed by the row, not its position: this is what audit round 8 fixed, and it only holds while the rows
// carry their own keys.
assert.deepEqual(duplicateMaterialErrors([
  { item_id: 'a', row_key: 'kept' },
  { item_id: 'a', row_key: 'added-later' },
]), { 'item_added-later': 'Duplicate material' }, 'the error names the row, so inserting above it does not move it');
// An empty row is not a duplicate of another empty row — it is a row nobody has filled in yet, and
// validateFormulaItems is what refuses that.
assert.deepEqual(duplicateMaterialErrors([{ item_id: '' }, { item_id: null }, { item_id: undefined }]), {},
  'unfilled rows are not duplicates of each other');
for (const nothing of [null, undefined, []]) {
  assert.deepEqual(duplicateMaterialErrors(nothing), {}, 'a missing composition must not throw on a form');
}
// And the desktop validator still asks it, rather than having been left with its own copy.
const desktop = validateComposerFields({
  name: 'x', code: 'x', formulaItems: rows('a', 'a'), activeFormulaItems: rows('a', 'a'),
});
assert.equal(desktop.item_r1, 'Duplicate material',
  'validateComposerFields no longer reports duplicates — the desktop composers have stopped asking');
assert.equal(calls.length, 1,
  'validateComposerFields stopped running the per-row checks; the desktop composers ask nothing else');
assert.deepEqual(validateComposerFields({
  name: ' ', code: ' ', formulaItems: [], activeFormulaItems: [],
}).name, 'Formula name is required', 'and a nameless formula is still refused');

// --- 2. Every screen that submits a composition asks it ---------------------------------------------------
// Found on disk: a screen that builds composition items for submission is a screen that writes a formula.
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) screens.push(full);
  }
};
walk(join(src, 'pages'));

const composers = screens.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return /createFormula\(|updateFormula\(/.test(text) && /validateFormulaItems|validateComposerFields/.test(text);
});
assert.ok(composers.length >= 4,
  `expected the four formula composers, found ${composers.length} — the scan is broken, not the code`);
assert.ok(composers.some((file) => file.includes(`${join('pages', 'mobile')}`)),
  'no phone composer was found; this guard exists because the phone was the half that could not ask');

for (const file of composers) {
  const where = file.slice(src.length + 1);
  const text = readFileSync(file, 'utf8');
  assert.match(text, /duplicateMaterialErrors\(|validateComposerFields\(/,
    `${where} saves a formula without asking whether a material is listed twice. The other composers `
    + 'refuse that formula, so this screen writes something its own siblings will not let anyone edit');
  assert.match(text, /validateFormulaItems|validateComposerFields/,
    `${where} saves a composition without the per-row checks — an incomplete dilution saves silently, `
    + 'which is the audit-round-7 bug this file already carries a comment about');
}

console.log(`oneCompositionRule selfcheck OK (${composers.length} screens write formulas, every one of `
  + 'them asking the same questions)');
