// `node src/utils/materialLibraryLock.selfcheck.mjs`
//
// "May I click this material?" was answered twice, by the two pages that render the same library:
//
//   Edit:   selectedIds.has(material.id) && currentRowItemId !== material.id
//   Create: selectedIds.has(material.id)
//
// On Create the material sitting in your ACTIVE row was greyed out too, and that contradicted two things
// at once. The composer's handler accepts re-picking it -- handleLibrarySelect refuses only a material
// added in ANOTHER row -- and Create's own badge labels that row "Selected", a word written for a state
// its disabled rule forbade. A button reading "Selected" that could not be clicked.
//
// Edit's rule agreed with the handler, so Edit's rule is the rule, and it has one home now.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { materialIsLockedForRow } from './materialLibraryLock.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

const inFormula = (...ids) => new Set(ids);

// --- 1. The row you are editing stays clickable -------------------------------------------------------
// The case Create got wrong, and the whole reason this file exists.
assert.equal(
  materialIsLockedForRow({
    material: { id: 'iso-e' },
    currentRowItemId: 'iso-e',
    selectedRawMaterialIdsSet: inFormula('iso-e', 'hedione'),
  }),
  false,
  'the material already in the active row must stay clickable — the composer accepts re-picking it, and '
  + 'the badge calls it "Selected"',
);

// --- 2. A material already used in another row is locked ----------------------------------------------
assert.equal(
  materialIsLockedForRow({
    material: { id: 'hedione' },
    currentRowItemId: 'iso-e',
    selectedRawMaterialIdsSet: inFormula('iso-e', 'hedione'),
  }),
  true,
  'a material sitting in a different row must be locked — that is what the handler refuses',
);

// --- 3. Anything not in the formula is free -----------------------------------------------------------
assert.equal(
  materialIsLockedForRow({
    material: { id: 'ambroxan' },
    currentRowItemId: 'iso-e',
    selectedRawMaterialIdsSet: inFormula('iso-e', 'hedione'),
  }),
  false,
  'an unused material is never locked',
);
// An empty formula: nothing is locked, whatever the active row says.
assert.equal(
  materialIsLockedForRow({ material: { id: 'x' }, currentRowItemId: '', selectedRawMaterialIdsSet: inFormula() }),
  false,
);

// --- 4. Never throws on the shapes a half-filled composer really produces -----------------------------
// The first row of a new formula has no item_id at all, and the set is built from state that starts empty.
assert.equal(materialIsLockedForRow(), false, 'called with nothing');
assert.equal(materialIsLockedForRow({}), false, 'no material');
assert.equal(materialIsLockedForRow({ material: {} , selectedRawMaterialIdsSet: inFormula('x') }), false,
  'a material with no id is not locked');
assert.equal(materialIsLockedForRow({ material: { id: 'x' } }), false, 'no set yet — the composer starts empty');
assert.equal(materialIsLockedForRow({ material: { id: 'x' }, selectedRawMaterialIdsSet: {} }), false,
  'something that is not a Set must not throw');
assert.equal(
  materialIsLockedForRow({ material: { id: 'x' }, currentRowItemId: undefined, selectedRawMaterialIdsSet: inFormula('x') }),
  true,
  'an empty active row does not unlock a material used elsewhere',
);

// --- 5. One home: the library reads it, and no page passes its own ------------------------------------
// The prop is gone. While it existed, the two pages filled it in differently and nothing noticed.
const library = read('components', 'FormulaMaterialLibrary.jsx');
assert.match(library, /materialIsLockedForRow\(\{/,
  'the material library must take its lock rule from materialLibraryLock.js');
assert.ok(!/getDisabledState/.test(library),
  'the library has a getDisabledState prop again, which is how the two pages came to disagree');
for (const page of ['CreateFormulaPage.jsx', 'EditFormulaPage.jsx']) {
  assert.ok(!/getDisabledState/.test(read('pages', page)),
    `${page} is passing the library its own lock rule again`);
}

// --- 6. And the coverage fraction has one denominator -------------------------------------------------
// Same class, same module: three surfaces print guidanceBackedCount over a total, and the board stats
// used to divide by the page's row count instead of the simulation's own eligibleItemCount.
const detailData = read('utils', 'formulaDetailData.js');
assert.match(detailData, /guidanceBackedCount\}\/\$\{workbookSimulation\.eligibleItemCount\}/,
  'the workbook board must divide guidanceBackedCount by the count it was taken from');
assert.ok(!/itemCount,/.test(detailData.slice(detailData.indexOf('buildWorkbookBoardStats'))),
  'buildWorkbookBoardStats takes a row count again');

console.log('materialLibraryLock selfcheck OK (one lock rule for both composer pages, and one denominator '
  + 'for the guidance fraction)');
