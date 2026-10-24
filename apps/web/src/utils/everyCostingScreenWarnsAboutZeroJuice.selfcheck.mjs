// `node src/utils/everyCostingScreenWarnsAboutZeroJuice.selfcheck.mjs`
//
// Every screen that costs a bottle must say when the juice was costed at nothing.
//
// useProductionCostPage sets `profileError` when a formula is chosen but its cost profile fails to
// load. Its own comment says why it exists: "so the page can warn instead of silently costing the
// juice at Rp 0 (material cost falls back to 0 when the profile is null)".
//
// The desktop page warns. The phone page read the SAME hook and never rendered it — so on the phone a
// failed load produced a COGS and a per-ml figure quietly missing the most expensive input, on the
// screen Dekito actually uses when he is away from the laptop, and those are the numbers a price gets
// set from. Found 2026-10-25 auditing files no chain had ever named.
//
// The subject is COUNTED, not listed: every file that calls the hook has to render the flag. A third
// costing screen added later is covered the day it is written.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

const HOOK = 'useProductionCostPage';

// --- 1. The hook still has the flag, and still explains itself ---------------------------------------
const hook = readFileSync(join(src, 'hooks', `${HOOK}.js`), 'utf8');
assert.match(hook, /const \[profileError, setProfileError\]/,
  'the hook no longer tracks a failed cost profile — if that is deliberate, this whole guard is stale '
  + 'and the screens below have nothing to warn about');
assert.match(hook, /profileError,/, 'the hook no longer returns profileError, so no screen can warn');
assert.match(hook, /setProfileError\(true\)/, 'nothing ever raises the flag, so it can never warn');

// --- 2. Every screen that reads the hook must render the flag -----------------------------------------
const consumers = walk(src)
  .filter((file) => /\.jsx$/.test(file))
  .filter((file) => readFileSync(file, 'utf8').includes(HOOK));
assert.ok(consumers.length >= 2,
  `only ${consumers.length} screen reads ${HOOK}. There were two — desktop and phone — so one has been `
  + 'removed or renamed and this guard is looking at the wrong thing');

const silent = consumers.filter((file) => !/\bprofileError\b/.test(readFileSync(file, 'utf8')));
assert.deepEqual(silent.map((file) => relative(src, file).split(sep).join('/')), [],
  'these screens cost a bottle from this hook and never mention profileError. When the cost profile '
  + 'fails they show a COGS with the juice counted at Rp 0 and say nothing, which is the number a '
  + 'price is set from');

// --- 3. The warning has to be announced, not just drawn ------------------------------------------------
// A coloured box a screen reader skips is not a warning. role="alert" is what the desktop uses.
for (const file of consumers) {
  const body = readFileSync(file, 'utf8');
  const name = relative(src, file).split(sep).join('/');
  // Anchored on the RENDER, not on the first mention: every one of these files also destructures
  // profileError at the top, and an earlier version of this check measured from there and read the
  // component's state declarations instead of its markup.
  const render = body.indexOf('{profileError ?');
  assert.notEqual(render, -1,
    `${name} mentions profileError but never renders on it — destructuring a flag is not warning with it`);
  assert.match(body.slice(render, render + 700), /role="alert"/,
    `${name} renders the zero-juice warning without role="alert", so it is a coloured box rather than `
    + 'something announced');
}

// --- 4. And it has to say what is actually wrong -------------------------------------------------------
// "Something went wrong" would let the reader assume the numbers are merely stale rather than short by
// the cost of the juice.
for (const file of consumers) {
  const body = readFileSync(file, 'utf8');
  const name = relative(src, file).split(sep).join('/');
  // Inside the warning, not anywhere in the file. The first version of this rule searched the whole
  // source, so blanking the phrase out of the message still passed on a page that happened to say
  // "Rp 0" somewhere else — a sabotage run caught it going green on a broken message.
  const render = body.indexOf('{profileError ?');
  const warning = body.slice(render, render + 700);
  assert.match(warning, /Rp 0/,
    `${name} does not tell the reader, IN THE WARNING, that the juice was costed at Rp 0 — without `
    + 'that it reads as a loading hiccup rather than a number that is wrong');
}

console.log(`everyCostingScreenWarnsAboutZeroJuice selfcheck OK (${consumers.length} costing screens, all announce the Rp 0 fallback)`);
