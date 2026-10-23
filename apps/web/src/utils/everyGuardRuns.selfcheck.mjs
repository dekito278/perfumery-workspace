// `node src/utils/everyGuardRuns.selfcheck.mjs`
//
// A guard that nothing runs is a file, not a guard.
//
// HISTORY, because this file has now been wrong twice in the same way.
//
// First time: TEN of the 210 selfchecks in src/utils had never been registered in the `selfcheck`
// script, so they had never run. Nine still passed. The tenth, dokuOrderGuards, had been FAILING since
// audit round 9 tightened the rule underneath it. Nothing could say so: the chain count said 204 and
// nobody had counted the files. The lesson taken then was "derive the count from the directory".
//
// Second time, 2026-10-23: `tools/journal-prerender.selfcheck.mjs` was found red and had been red since
// 13 September — six weeks. It was the ONE chain of 245 absent from the registration script. And this
// guard could not see it, because the fix taken the first time derived the count from a HAND-TYPED LIST
// OF TWO DIRECTORIES (`src/utils`, `tools/api-selfchecks`). `tools/` was not one of them. The guard's
// promise — "every guard runs" — was broader than the subject it actually scanned, which is the most
// productive defect shape in this repo and the one it was itself written to prevent.
//
// So the subject is now the WHOLE TREE, walked. No directory list, and no 12,000-character list of
// chains in package.json either: `npm run selfcheck` delegates to tools/selfcheck.mjs, which finds its
// own subject by walking. A new chain anywhere runs on the next build with nothing to remember.
//
// The remaining risk is that the runner's walk is wrong, in which case the runner and a guard that
// imported it would be wrong together and silent. So this file walks the tree ITSELF, with a separate
// and deliberately dumb implementation, and fails if the two disagree.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { findChains } from '../../tools/selfcheck.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..', '..');

// --- 1. The build must actually run them ------------------------------------------------------------
// The guards being registered is worthless if nothing invokes the registry. Until 2026-10-23 the chains
// ran only when someone typed the command, which is why six weeks could pass.
const pkg = JSON.parse(readFileSync(join(web, 'package.json'), 'utf8'));
const scripts = pkg?.scripts || {};
const RUNNER = 'tools/selfcheck.mjs';

assert.ok(String(scripts.selfcheck || '').includes(RUNNER),
  `the selfcheck script must delegate to ${RUNNER} rather than naming chains one by one — a typed list `
  + 'is how one chain went six weeks without running');
assert.ok(String(scripts.build || '').includes(RUNNER),
  'the BUILD must run the chains. Vercel has no buildCommand, so it runs `npm run build`; if that does '
  + 'not invoke the runner then a red chain cannot stop a deploy and nothing will ever say it is red');

// --- 2. An independent walk, which must agree with the runner's -------------------------------------
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage', '.vercel', '.vite']);
const mine = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue;
    }
    if (info.isDirectory()) walk(full);
    else if (name.endsWith('.selfcheck.mjs')) mine.push(relative(web, full).split(sep).join('/'));
  }
};
walk(web);
mine.sort();

const theirs = findChains().map((file) => relative(web, file).split(sep).join('/')).sort();
assert.deepEqual(theirs, mine,
  'the runner\'s walk and this guard\'s walk disagree about which chains exist. One of them is wrong, '
  + 'and while they disagree nobody can say what is being checked:\n  '
  + `runner found ${theirs.length}, this guard found ${mine.length}\n  `
  + `only in runner: ${theirs.filter((f) => !mine.includes(f)).join(', ') || '(none)'}\n  `
  + `only here:      ${mine.filter((f) => !theirs.includes(f)).join(', ') || '(none)'}`);

// --- 3. The walk must reach every place chains actually live ----------------------------------------
// Derived, not listed: the set of directories is read off the files that were found. If the walk were
// scoped too narrowly — the 2026-10-23 bug — a whole directory would simply be absent from this set,
// so the assertion is that each directory holding chains is one the walk descended into.
const dirsFound = new Set(mine.map((file) => file.split('/').slice(0, -1).join('/')));
assert.ok(dirsFound.size >= 2,
  `chains were found in only ${dirsFound.size} directory, which means the walk stopped early`);
assert.ok(dirsFound.has('tools'),
  'no chain found directly under tools/ — that is precisely the directory the hand-typed list omitted, '
  + 'so its absence here means the blind spot is back');
assert.ok(dirsFound.has('src/utils'), 'no chain found under src/utils, where most of them live');

// --- 4. This file is itself a chain, so the walk has to have found it -------------------------------
assert.ok(mine.includes('src/utils/everyGuardRuns.selfcheck.mjs'),
  'this guard did not find itself, which means it is not in scope and is being read by hand — exactly '
  + 'the state it exists to end');

console.log(`everyGuardRuns selfcheck OK (${mine.length} chains, walked not listed, across ${dirsFound.size} directories; build runs them)`);
