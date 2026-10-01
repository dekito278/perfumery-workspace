// `node src/utils/bulkTellsTheTruth.selfcheck.mjs`
//
// A bulk action reports what actually happened to each member of the selection.
//
// Eight of the nine used Promise.all, which rejects on the FIRST failure. Mark five orders paid, let the third
// fail, and the owner is told "Gagal mark paid massal" — while four of them ARE paid, because the other
// requests were already in flight and still completed. He reloads, sees work he was told had failed, and
// never learns which single order needs attention.
//
// MobileOrdersPage had already settled ONE of its two bulk actions and counted the failures, with the
// reason written beside it: "Promise.all rejects on the first failure and would leave the rest unreported."
// Its own sibling two functions above was still Promise.all, and so were all six on the other screens.
// The fix existed; the mirror was never done — not even inside the file that had it.
//
// The counting now lives in settleBulk, RUN here rather than read, so a ninth copy cannot appear.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// --- 1. settleBulk, run against both outcomes ---------------------------------------------------------
const { settleBulk } = await import(pathToFileURL(join(src, 'utils', 'orderBulkActions.js')).href);

const allGood = await settleBulk([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]);
assert.deepEqual(allGood, { total: 3, ok: 3, failed: 0, reason: '' });

// The case the old shape got wrong: some succeed, one fails, and the result has to carry BOTH numbers.
const mixed = await settleBulk([
  Promise.resolve(1),
  Promise.reject(new Error('Stok tidak cukup')),
  Promise.resolve(3),
  Promise.reject(new Error('Koneksi gagal')),
]);
assert.equal(mixed.total, 4);
assert.equal(mixed.ok, 2, 'the successes must be counted, not thrown away with the first rejection');
assert.equal(mixed.failed, 2);
assert.equal(mixed.reason, 'Stok tidak cukup', 'the first real reason reaches the toast');

// An empty selection is not a failure, and nothing claims otherwise.
assert.deepEqual(await settleBulk([]), { total: 0, ok: 0, failed: 0, reason: '' });
assert.deepEqual(await settleBulk(), { total: 0, ok: 0, failed: 0, reason: '' });
// A rejection with no message must not report an empty reason as if it were a success.
const bare = await settleBulk([Promise.reject(new Error(''))]);
assert.equal(bare.failed, 1, 'a rejection with no message is still a failure');

// --- 2. Nobody fans out over a selection with Promise.all any more -------------------------------------
//
// Swept, not listed: the next screen to add a bulk action has to be caught by this.
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx$/.test(entry.name)) screens.push(rel);
  }
};
walk('pages');
assert.ok(screens.length >= 30, `expected to sweep the Studio screens; found ${screens.length}`);

const failFast = [];
const bulkActions = [];
for (const rel of screens) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  // A bulk action fans one call out over a selection. Matched on the SHAPE — a map over something
  // selected — rather than on a list of function names, so a new one is caught by what it does.
  for (const match of source.matchAll(/(Promise\.all|Promise\.allSettled|settleBulk)\(\s*(selected\w*)\.map\(/g)) {
    bulkActions.push(`${rel}: ${match[2]}`);
    if (match[1] === 'Promise.all') failFast.push(`${rel}: ${match[1]}(${match[2]}.map(...))`);
  }
}
console.log(`  bulk actions over a selection (${bulkActions.length}):`);
for (const entry of bulkActions) console.log(`    ${entry}`);
assert.ok(bulkActions.length >= 9,
  `expected the nine bulk actions across the four order screens; found ${bulkActions.length}. Either they `
  + 'stopped mapping over a selection, or this sweep no longer sees them.');
assert.deepEqual(failFast, [],
  'these stop at the first failure and report the whole batch as failed, while the rest of the selection '
  + 'has already been written:\n  ' + failFast.join('\n  '));

// --- 3. And the count has to reach the owner, PER ACTION ----------------------------------------------
//
// Checked per file first, which a sabotage walked through: OrdersPage has two bulk actions, and the honest
// one's `moves.failed` satisfied a file-wide search while its sibling was put back to announcing the
// selection's length. Settling and then reporting the length is the same silence with an extra step.
//
// So each action is checked inside ITS OWN function body, sliced from the call to the end of the enclosing
// arrow function.
const silent = [];
for (const rel of new Set(bulkActions.map((entry) => entry.split(':')[0]))) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/(?:Promise\.all|Promise\.allSettled|settleBulk)\(\s*(selected\w*)\.map\(/g)) {
    const end = source.indexOf('\n  };', match.index);
    const body = source.slice(match.index, end === -1 ? source.length : end);
    if (!/\.failed\b/.test(body)) silent.push(`${rel}: ${match[1]}`);
  }
}
assert.deepEqual(silent, [],
  'these settle their bulk action and then never look at how many failed, which is the same silence with '
  + 'an extra step:\n  ' + silent.join('\n  '));

console.log(`bulkTellsTheTruth selfcheck OK (${bulkActions.length} bulk actions, none fail-fast, every screen reports its failures)`);
