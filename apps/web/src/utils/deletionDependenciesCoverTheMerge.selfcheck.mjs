// `node src/utils/deletionDependenciesCoverTheMerge.selfcheck.mjs`
//
// Two lists in rawMaterialsService name the same thing — every record that points at a raw material:
//
//   mergeRawMaterials                     repoints them at the master before dropping the duplicate
//   getRawMaterialDeletionDependencies    counts them, so the confirm dialog can say what will block
//
// They have to be the same list. The second one's own header says "Every `on delete restrict` foreign
// key to raw_materials, so the confirm dialog lists what will actually block the delete" — written in
// audit round 8, when it checked formula_items only and told the librarian a material was ready to
// delete while accords, batches and usage records still pointed at it. The delete then failed at the
// database with a raw constraint error.
//
// It was still one short of the merge: raw_materials.dilution_solvent_id, a material diluted with
// another material. It IS a foreign key to raw_materials.id (confirmed against the live PostgREST
// schema, 2026-10-11) and the merge repoints it. Zero rows carry it on production today, which is the
// only reason nobody has met it — the Studio material form offers the field, so one save is all it
// takes.
//
// So the rule is not "these seven". It is: whatever the merge repoints, the dialog counts. Both lists
// are read out of the code, so a reference added to either side without the other fails here.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'services', 'rawMaterialsService.js'), 'utf8');

// ── The merge's list: every (table, column) it repoints at the master ─────────────────────────────
const mergeBlock = source.match(/const tableUpdates = \[([\s\S]*?)\n    \];/);
assert.ok(mergeBlock, "could not find the merge's repointing list — this guard's parse is broken, not the merge");
const repointed = [...mergeBlock[1].matchAll(/\.from\('(\w+)'\)\s*\n\s*\.update\(\{ (\w+): masterId \}\)/g)]
  .map((match) => `${match[1]}.${match[2]}`);
assert.ok(repointed.length >= 6, `only ${repointed.length} repointed references parsed — the parse is broken`);

// What the merge repoints is a COLUMN it sets to the master. The column it filters on is the one that
// holds the reference, and for every one of these they are the same column — except the polymorphic
// formula_items.item_id, which is filtered by item_type as well.
const filteredColumns = [...mergeBlock[1].matchAll(/\.from\('(\w+)'\)[\s\S]{0,200}?\.eq\('(\w+)', duplicateId\)/g)]
  .map((match) => `${match[1]}.${match[2]}`);
assert.deepEqual(
  [...new Set(repointed)].sort(),
  [...new Set(filteredColumns)].sort(),
  'the merge writes a column it does not filter on, or filters one it does not write — read it again before trusting either list',
);

// ── The dialog's list: every (table, column) it counts ───────────────────────────────────────────
const checksBlock = source.match(/const checks = \[([\s\S]*?)\n  \];/);
assert.ok(checksBlock, "could not find the dependency checks — this guard's parse is broken, not the service");
const counted = [...checksBlock[1].matchAll(/\['[^']*', '(\w+)', '(\w+)'/g)].map((match) => `${match[1]}.${match[2]}`);
assert.ok(counted.length >= 7, `only ${counted.length} dependency checks parsed — the parse is broken`);

// ── Same list, both directions ───────────────────────────────────────────────────────────────────
for (const reference of new Set(repointed)) {
  assert.ok(
    counted.includes(reference),
    `the merge repoints ${reference} but the delete dialog does not count it — a material it still holds would be called ready to delete, and the database would refuse with a raw constraint error`,
  );
}
for (const reference of new Set(counted)) {
  assert.ok(
    repointed.includes(reference),
    `the delete dialog counts ${reference} but the merge does not repoint it — merging a duplicate would leave that reference behind, and the delete at the end of the merge would fail`,
  );
}

// And the one the list was missing is named explicitly, so this cannot pass by both lists losing it.
assert.ok(counted.includes('raw_materials.dilution_solvent_id'),
  'a material diluted with another material must still be counted as a blocker');
assert.ok(repointed.includes('raw_materials.dilution_solvent_id'),
  'and still repointed by the merge');

// ── The merge's own safety argument has to keep holding ──────────────────────────────────────────
// It has no transaction. Its comment says the destructive step is LAST, so any failure before it leaves
// the duplicate intact and the whole merge retryable. That is the only thing standing between a
// silently-refused repoint and a dangling reference, so the order is pinned.
const mergeFn = source.slice(source.indexOf('const tableUpdates = ['));
const deleteAt = mergeFn.indexOf(".from('raw_materials')\n      .delete()");
const repointAt = mergeFn.indexOf('const results = await Promise.all(tableUpdates);');
assert.ok(repointAt !== -1 && deleteAt !== -1, "could not find the merge's repoint and delete steps");
assert.ok(
  repointAt < deleteAt,
  'the merge drops the duplicate before repointing what points at it',
);

console.log(`deletionDependenciesCoverTheMerge: ok — ${new Set(repointed).size} references, repointed and counted by the same list`);
