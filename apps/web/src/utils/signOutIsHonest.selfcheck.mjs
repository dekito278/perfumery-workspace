// `node src/utils/signOutIsHonest.selfcheck.mjs`
//
// AuthContext.logout throws when Supabase refuses the sign-out, and it throws BEFORE it clears anything:
// the session object, the remembered MFA and the sb-* token in localStorage all survive. So a screen that
// navigates to /login without waiting for that promise — or waits and swallows the throw — leaves the
// owner looking at a login screen on a session that is still perfectly valid.
//
// Three screens offered a sign-out and they disagreed. The phone awaited, caught, said so and stayed put.
// The MFA notice awaited and swallowed the rejection. The Studio sidebar — the button Dekito actually
// uses — did neither: `logout(); navigate('/login');`, unconditionally, on a promise it never looked at.
// Press Keluar on a flaky connection, walk away from a borrowed laptop, and the next person presses Back.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. The premise: logout throws BEFORE it clears anything -------------------------------------------
// If this ever stops being true the fix below is solving a problem that no longer exists, and the guard
// should be the thing that notices.
const auth = read('contexts', 'AuthContext.jsx');
const logoutBody = auth.match(/const logout = async \(\) => \{[\s\S]*?\n  \};/)?.[0];
assert.ok(logoutBody, 'could not read logout to check what it does on failure');
const throwsAt = logoutBody.indexOf('throw new Error');
const clearsAt = logoutBody.indexOf('setSession(null)');
assert.ok(throwsAt > 0 && clearsAt > 0, 'logout must both throw on failure and clear the session on success');
assert.ok(throwsAt < clearsAt,
  'logout throws BEFORE it clears the session — that is why a caller who ignores the throw leaves a live '
  + 'session behind a login screen. If that order changed, this guard is out of date, not the app.');

// --- 2. The rule, RUN: a failed sign-out does not navigate ---------------------------------------------
const hook = read('hooks', 'useSignOut.js');
const signOutBody = hook.match(/const signOut = async \(\) => \{[\s\S]*?\n  \};/)?.[0];
assert.ok(signOutBody, 'could not lift signOut to run it — update this guard');
const buildSignOut = new Function(
  'logout', 'toast', 'navigate', 'setSigningOut', 'redirectTo',
  `${signOutBody}\nreturn signOut;`,
);

const attempt = async ({ failWith }) => {
  const calls = { navigated: [], success: [], error: [], signingOut: [] };
  const signOut = buildSignOut(
    async () => { if (failWith) throw new Error(failWith); },
    { success: (m) => calls.success.push(m), error: (m) => calls.error.push(m) },
    (to, options) => calls.navigated.push([to, options]),
    (value) => calls.signingOut.push(value),
    '/login',
  );
  await signOut();
  return calls;
};

const failed = await attempt({ failWith: 'Failed to fetch' });
assert.deepEqual(failed.navigated, [],
  'a sign-out that failed must NOT show a login screen — the session is still live, and that is the one '
  + 'outcome this can never produce');
assert.deepEqual(failed.error, ['Failed to fetch'], 'and it says what went wrong, in the words it got');
assert.deepEqual(failed.success, [], 'nothing claims success');
assert.deepEqual(failed.signingOut, [true, false], 'the button comes back, or it can never be pressed again');

const succeeded = await attempt({ failWith: null });
assert.deepEqual(succeeded.navigated, [['/login', { replace: true }]],
  'a sign-out that worked goes to the login screen, and replaces the entry so Back cannot return');
assert.deepEqual(succeeded.success, ['Berhasil keluar']);
assert.deepEqual(succeeded.error, []);

// --- 3. Every screen that signs out goes through it ----------------------------------------------------
// Derived, not listed — and derived from what a sign-out SCREEN is rather than from one variable name.
// The first version of this looked for components reaching for `logout` out of useAuth, which stopped
// finding them the moment they stopped naming it. Either word means the screen offers a sign-out, and
// there is exactly one place allowed to decide what a refused one does.
const offenders = [];
let screens = 0;
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (!entry.name.endsWith('.jsx')) continue;
    const source = read(...rel.split('/'));
    if (!/\b(?:logout|signOut)\b/.test(source)) continue;
    screens += 1;
    if (/useSignOut\(/.test(source)) continue;
    offenders.push(rel);
  }
};
walk('components');
walk('pages');
walk('layouts');
assert.ok(screens >= 3, `only ${screens} screens mention a sign-out — the walk lost them`);
assert.deepEqual(offenders, [],
  'these sign somebody out without going through useSignOut, so each one decides for itself whether a '
  + `failed sign-out still shows a login screen:\n  ${offenders.join('\n  ')}`);

// Only the context defines it; only the hook calls it.
assert.match(hook, /await logout\(\);/, 'the hook is the one place that awaits it');

console.log(`signOutIsHonest selfcheck OK (${screens} screens sign out through one hook; a refused sign-out never shows a login screen)`);
