// `node src/utils/bootRecoveryBudget.selfcheck.mjs`
//
// index.html carries its own recovery from a stale module chunk: catch the failure, unregister the
// service worker, drop the app caches, reload. It is capped at two attempts so a genuinely broken deploy
// cannot spin a phone in a reload loop, and the counter lives in sessionStorage.
//
// The cap only ever went UP. It was reset in exactly one place — the manual "Reset app cache" button —
// so a tab left open across three deploys, which is a normal afternoon on this shop, spent both attempts
// on two stale chunks that each recovered PERFECTLY and met the third with a manual-recovery screen
// instead of the shop. The cap exists to stop a loop; a boot that succeeded is proof there is no loop.
//
// The rule is RUN, not read: the three pieces are lifted out of index.html and executed against a fake
// document and a fake sessionStorage. index.html is not a module and its script is not importable, so
// asserting that the FILE contains a line would be the weakest possible check on a page every visitor
// loads before anything else.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shell = readFileSync(join(webRoot, 'index.html'), 'utf8');

const lift = (pattern, what) => {
  const found = shell.match(pattern);
  assert.ok(found, `could not lift ${what} out of index.html — update this guard, not the shell`);
  return found[0];
};

const source = [
  lift(/var RECOVERY_KEY = '[^']*';/, 'the storage key'),
  lift(/var MAX_RECOVERY_ATTEMPTS = \d+;/, 'the cap'),
  lift(/function getRecoveryAttempts\(\) \{[\s\S]*?\n\t\t\t\t\}/, 'getRecoveryAttempts'),
  lift(/function setRecoveryAttempts\(value\) \{[\s\S]*?\n\t\t\t\t\}/, 'setRecoveryAttempts'),
  lift(/window\.setTimeout\(function \(\) \{[\s\S]*?\}, 14000\);/, 'the boot timer')
    .replace(/^window\.setTimeout\(/, 'const onBootTimer = (')
    .replace(/, 14000\);$/, ');'),
  'export { onBootTimer, getRecoveryAttempts, setRecoveryAttempts, MAX_RECOVERY_ATTEMPTS, RECOVERY_KEY };',
].join('\n');

// The shell's own code, with only the things a browser would have provided.
const run = async ({ bootFallbackStillOnScreen, attempts }) => {
  const store = new Map([['solivagant.pwa.module-recovery.v2', String(attempts)]]);
  const recovered = [];
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
    },
  };
  globalThis.document = {
    getElementById: () => ({
      querySelector: (selector) => (selector === '.app-boot-fallback' && bootFallbackStillOnScreen ? {} : null),
    }),
  };
  globalThis.recoverFromModuleFailure = (reason) => recovered.push(reason);
  const module = await import(`data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`);
  module.onBootTimer();
  return { recovered, left: Number(store.get(module.RECOVERY_KEY)), cap: module.MAX_RECOVERY_ATTEMPTS };
};

// --- 1. The app never started: recover, and do NOT touch the budget ------------------------------------
const stuck = await run({ bootFallbackStillOnScreen: true, attempts: 1 });
assert.deepEqual(stuck.recovered, ['boot-timeout'], 'a shell still showing its boot fallback has not started');
assert.equal(stuck.left, 1, 'and the attempt it already spent must still be counted, or the cap cannot cap');

// --- 2. The app started: the budget refills ------------------------------------------------------------
const booted = await run({ bootFallbackStillOnScreen: false, attempts: 1 });
assert.deepEqual(booted.recovered, [], 'a booted app must not be reloaded out from under the visitor');
assert.equal(booted.left, 0,
  'a boot that succeeded is proof there is no reload loop, so the two attempts have to come back — '
  + 'otherwise a tab open across three deploys meets the third stale chunk with a recovery screen');

// --- 3. Nothing is written when there was nothing to give back -----------------------------------------
const clean = await run({ bootFallbackStillOnScreen: false, attempts: 0 });
assert.equal(clean.left, 0);
assert.deepEqual(clean.recovered, []);

// --- 4. The cap is still a cap -------------------------------------------------------------------------
assert.ok(stuck.cap >= 1 && stuck.cap <= 3,
  `the recovery cap is ${stuck.cap}: high enough and a loop costs a visitor that many reloads, and the `
  + 'point of the cap is that a broken deploy cannot spin a phone forever');

console.log(`bootRecoveryBudget selfcheck OK (cap ${stuck.cap}, spent while the shell is stuck and given back the moment it boots)`);
