// `node src/utils/everyGuardRuns.selfcheck.mjs`
//
// A guard that is not in the `selfcheck` script is a file, not a guard.
//
// TEN of the 210 selfchecks in src/utils had never been registered, so they had never run: batchScaling,
// dokuOrderGuards, guidanceAdvisories, journalMarkdown, likePattern, localDay, mergeStock, numberInputs,
// orderNotes, voucherValidation. Nine still passed. The tenth, dokuOrderGuards, had been FAILING since
// audit round 9 tightened the rule underneath it — the guard still asserted that a DOKU 'paid' verdict
// carrying no amount was acceptable, which is exactly the hole round 9 closed on purpose. Nothing could
// say so: the chain count said 204 and nobody had counted the files.
//
// `git log -S` shows neither file was ever in package.json, so this was not a regression. They were
// written, committed, and never wired up — including one I rewrote myself earlier in the same session,
// running it by hand each time and believing that meant it was covered.
//
// So the count is derived from the directory, not from a number anybody maintains.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..', '..');
const script = JSON.parse(readFileSync(join(web, 'package.json'), 'utf8'))?.scripts?.selfcheck || '';
assert.ok(script, 'package.json has no selfcheck script at all');

// Every directory that holds guards, and how each one is spelled in the script.
const GUARD_DIRS = [
  ['src/utils', (name) => `node src/utils/${name}`],
  ['tools/api-selfchecks', (name) => `node tools/api-selfchecks/${name}`],
];

const unregistered = [];
let counted = 0;
for (const [dir, command] of GUARD_DIRS) {
  const files = readdirSync(join(web, dir)).filter((name) => name.endsWith('.selfcheck.mjs'));
  assert.ok(files.length, `no guards found under ${dir} — this check is looking in the wrong place`);
  for (const name of files) {
    counted += 1;
    if (!script.includes(command(name))) unregistered.push(`${dir}/${name}`);
  }
}

assert.deepEqual(unregistered, [],
  'these guards exist and never run. Add each to the selfcheck script in apps/web/package.json — and '
  + 'expect at least one of them to be red, because nothing has been checking it:\n  '
  + unregistered.join('\n  '));

// And the script must not point at guards that no longer exist, or `npm run selfcheck` dies on the
// first missing file and every chain after it is never reached.
const named = [...script.matchAll(/node ((?:src|tools)\/[^\s]+\.selfcheck\.mjs)/g)].map((match) => match[1]);
assert.ok(named.length >= counted, `the script names ${named.length} guards but ${counted} files exist`);
const onDisk = new Set(GUARD_DIRS.flatMap(([dir]) => readdirSync(join(web, dir))
  .filter((name) => name.endsWith('.selfcheck.mjs'))
  .map((name) => `${dir}/${name}`)));
const dangling = [...new Set(named)].filter((path) => !onDisk.has(path));
assert.deepEqual(dangling, [],
  `the selfcheck script names guards that are not on disk, so the run stops there:\n  ${dangling.join('\n  ')}`);

// The proof: this file is itself a guard, so it has to be in the script it reads.
assert.ok(script.includes('node src/utils/everyGuardRuns.selfcheck.mjs'),
  'this guard is not registered either, which means it is not running and you are reading its output by '
  + 'hand — exactly the state it exists to end');

console.log(`everyGuardRuns selfcheck OK (${counted} guard files, all registered, none dangling)`);
