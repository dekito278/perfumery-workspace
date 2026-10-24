// `node src/utils/twelveFunctionCeiling.selfcheck.mjs`
//
// The deployment may hold at most twelve serverless functions.
//
// Vercel's Hobby plan stops at 12. Going over does not fail the BUILD — it builds perfectly, then
// fails while deploying outputs, with a message nobody reads until they go looking. So the thing that
// catches it has to be here, before the push.
//
// This repo has now hit it twice. The first time, three material-import routes pushed the count to 13;
// api/imports/index.js still carries the scar in its opening comment, serving all three behind one
// `source` parameter. The second time was me, adding the Telegram webhook on 2026-10-25 — and nothing
// in the repo stopped it, because the only record of the ceiling was a comment inside the file that
// had already paid for it.
//
// A comment is not a guard. This is.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const apiDir = join(web, 'api');

// Counted from the filesystem, because that is exactly how Vercel counts: one function per file under
// api/, whatever it is named and however deeply nested.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return /\.(js|mjs|ts)$/.test(entry.name) ? [full] : [];
});

const functions = walk(apiDir).map((file) => relative(apiDir, file).split(sep).join('/')).sort();
const CEILING = 12;

assert.ok(functions.length <= CEILING,
  `${functions.length} serverless functions, and the Hobby plan allows ${CEILING}. The build will SUCCEED `
  + 'and then fail while deploying outputs. Fold two that belong together behind one entry point — '
  + 'api/imports/index.js and api/shipping/rates.js are both examples — or the plan has to change:\n  '
  + functions.join('\n  '));

// Not a floor, a tripwire: if the count ever drops well below, someone removed an endpoint and this
// file's arithmetic should be re-read rather than trusted.
assert.ok(functions.length >= 8,
  `only ${functions.length} functions found — this guard is probably looking in the wrong directory, `
  + 'and a ceiling check that counts nothing passes forever');

// --- The fold that bought the room must stay folded ---------------------------------------------------
// Someone re-splitting these into two files would put the count back at 13, and the failure would come
// at deploy time again.
const rates = readFileSync(join(apiDir, 'shipping', 'rates.js'), 'utf8');
assert.match(rates, /request\.method === 'GET'/,
  'api/shipping/rates.js no longer serves the destination search on GET — if that moved back to its own '
  + 'file the deployment is over the ceiling again');
assert.ok(!functions.includes('shipping/destinations.js'),
  'shipping/destinations.js is back as its own function, which is the 13th');

// And the URL it used to own must still resolve, or the storefront's destination picker goes dark.
const vercel = JSON.parse(readFileSync(join(web, 'vercel.json'), 'utf8'));
const rewrites = vercel.rewrites || [];
const destinationRule = rewrites.findIndex((rule) => rule.source === '/api/shipping/destinations');
const catchAll = rewrites.findIndex((rule) => rule.source === '/api/(.*)');
assert.notEqual(destinationRule, -1,
  '/api/shipping/destinations has no rewrite, so the destination search 404s — its file is gone');
assert.ok(catchAll === -1 || destinationRule < catchAll,
  'the destinations rewrite sits AFTER the /api catch-all, so unmatched-API wins and the destination '
  + 'search answers 404 instead of reaching the function');

console.log(`twelveFunctionCeiling selfcheck OK (${functions.length}/${CEILING} functions, destinations folded and still routed)`);
