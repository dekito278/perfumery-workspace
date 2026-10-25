// A build that cannot run must not be allowed to deploy.
//
// 2026-10-25: every Vercel preview deployment of this shop was a dead page. The entry chunk carried
// `export{…410 names…}` and declared none of them, so the browser stopped at
// "Uncaught SyntaxError: Export 'AUDIT_KEYS_THAT_MATTER' is not defined in module" and the app never
// booted. The build had exited 0, Vercel reported pass, the GitHub check went green, and I had been
// merging on that green check. It only ever proved the build command exited 0.
//
// Measured against the real artefacts before this guard was written:
//
//   the dead preview chunk (147 kB)   403 names exported and never defined
//   the live production index (788 kB)  0
//   the local index (788 kB)            0
//
// So: no false positives on two healthy 788 kB chunks, and it would have refused the broken build.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { undefinedExportsIn } from './chunkExportsAreDefined.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// --- 1. The hollow chunk, which is the whole point ----------------------------------------------------
const hollow = undefinedExportsIn('const q=1;export{AUDIT_KEYS_THAT_MATTER as eQ,formatClientContext as eP};');
assert.equal(hollow.count, 2, 'a name only ever mentioned in the export list is a name the chunk does not have');
assert.deepEqual(hollow.names, ['AUDIT_KEYS_THAT_MATTER', 'formatClientContext']);

// --- 2. Sound chunks, by each of the ways a name can legitimately be there -----------------------------
for (const [what, source] of [
  ['declared with const', 'const a=1;export{a as b};'],
  ['declared as a function', 'function a(){}export{a as b};'],
  ['imported, then re-exported', 'import{x as y}from"./o.js";export{y as z};'],
  ['minified with a $ name', 'const $a=1;export{$a as b};'],
  ['exported inline', 'export const a=1;'],
  ['nothing exported', 'export{};'],
  ['only default', 'const a=1;export{a as default};'],
]) {
  assert.equal(undefinedExportsIn(source).count, 0, `${what} is sound and must not be reported`);
}

// --- 3. The substring trap ----------------------------------------------------------------------------
// `ab` must not count as an occurrence of `a`, or a hollow export hides behind a longer neighbour.
assert.equal(undefinedExportsIn('const ab=1;export{a as b};').count, 1,
  'a longer name that merely contains the missing one must not satisfy it');
assert.equal(undefinedExportsIn('const a=1,ab=2;export{a as b,ab as c};').count, 0);

// --- 4. It reports the SIZE of the damage, capped ------------------------------------------------------
// The browser names only the first missing export; the count is what says the chunk is wholly hollow
// rather than one symbol short.
const many = undefinedExportsIn(`export{${Array.from({ length: 40 }, (_, i) => `n${i} as e${i}`).join(',')}};`, 3);
assert.equal(many.count, 40, 'the count is the real number, not the number shown');
assert.equal(many.names.length, 3, 'the list is capped so a hollow chunk does not print hundreds of names');

// --- 5. The build actually runs it, on the output, after a successful compile --------------------------
// Without this the rules above could all be right and never consulted — which is exactly how the broken
// build shipped: nothing in the pipeline looked at what it had just produced.
const build = fs.readFileSync(path.resolve(HERE, '../../tools/build.mjs'), 'utf8');
assert.match(build, /import \{ undefinedExportsIn \} from '\.\.\/src\/utils\/chunkExportsAreDefined\.js';/,
  'tools/build.mjs must import the check');
assert.match(build, /assertChunksDefineWhatTheyExport = \(\) => \{[\s\S]*?undefinedExportsIn\(/,
  'the check must be read inside the build assertion, not merely imported');
assert.match(build, /if \(viteResult\.status === 0\) \{\s*\n\s*assertChunksDefineWhatTheyExport\(\);/,
  'it must run as soon as the compile succeeded, before the build is allowed to finish');
assert.match(build, /\[bundle\] no chunks emitted/,
  'an empty assets directory must fail rather than pass by vacuity — zero chunks is zero evidence');
// Read the function's OWN body, not from its name to the end of the file. The first version of this
// rule searched the rest of build.mjs, where other checks have their own process.exit(1) — so deleting
// this one's exit left the rule green. Same defect this repo keeps producing: a promise wider than the
// text it actually reads.
const bodyStart = build.indexOf('assertChunksDefineWhatTheyExport = () => {');
assert.ok(bodyStart > 0, 'the build assertion is gone — fix this guard, not the app');
const body = build.slice(bodyStart, build.indexOf('\n};', bodyStart));
assert.ok(!body.includes('assertDeferredChunksStayLazy'), 'the slice overran into the next check — fix this guard');
// Narrower still: the HOLLOW-CHUNK branch has to exit. The body holds two exits — the other belongs to
// the zero-chunks floor — so asserting "the body exits somewhere" stayed green after the one that
// matters was deleted. Twice in one guard, the same defect: match the branch, not the neighbourhood.
const hollowBranch = body.slice(body.indexOf('if (count) {'), body.lastIndexOf('}'));
assert.ok(hollowBranch.includes('console.error'), 'the hollow-chunk branch is gone — fix this guard');
assert.ok(!hollowBranch.includes('no chunks emitted'), 'the branch slice swallowed the floor — fix this guard');
assert.match(hollowBranch, /process\.exit\(1\)/,
  'a hollow chunk must stop the build, not print a warning nobody reads');
