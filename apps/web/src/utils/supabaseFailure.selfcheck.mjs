// `node src/utils/supabaseFailure.selfcheck.mjs`
//
// The studio's TOTP prompt is pure React: is_admin() does not require aal2 until
// 20260819127000_is_admin_requires_aal2.sql is applied by hand, so whatever this file guards is, today,
// the ONLY thing standing between a stolen password and the studio.
//
// The hole it closes: resolveMfaChallenge answered `null` for "this session needs no second factor" AND
// for "I could not find out". Those are opposite facts with the same answer, and the answer grants access.
// Block one listFactors request in devtools with a valid password and you were inside.
//
// Two halves, and both have to hold:
//   1. isTransientAuthError must call an undecidable failure a real one (below, as behaviour).
//   2. AuthContext must not turn a failure into "no MFA needed" (below, as structure).
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isTransientAuthError } from './supabaseFailure.js';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const auth = stripComments(readFileSync(join(srcRoot, 'contexts', 'AuthContext.jsx'), 'utf8'));

// --- 1. Momentary blips, and nothing else ------------------------------------------------------------
// A multi-tab owner hits `AbortError: Lock broken` from Supabase's own navigator lock routinely. Signing
// them out for it would be a worse bug than the one being fixed, so that one case gets a second try.
assert.equal(isTransientAuthError({ name: 'AbortError' }), true, 'a broken navigator lock is momentary');
assert.equal(isTransientAuthError({ message: 'Acquiring an exclusive Navigator LockManager lock' }), true,
  'lock contention is momentary');
assert.equal(isTransientAuthError({ message: 'Failed to fetch' }), true, 'a dropped request is momentary');
assert.equal(isTransientAuthError({ message: 'Request timed out' }), true, 'a timeout is momentary');

// Everything else must be a real failure — this is the half that denies access.
assert.equal(isTransientAuthError({ code: '42501', message: 'permission denied for table mfa_factors' }), false,
  'an RLS refusal is not a blip; retrying it forever would be the same as granting access');
assert.equal(isTransientAuthError({ status: 500, message: 'Internal Server Error' }), false,
  'a server error is not a blip');
assert.equal(isTransientAuthError(undefined), false,
  'an absent error must not read as momentary — an undecidable state has to fail closed');
assert.equal(isTransientAuthError({}), false, 'an error with nothing on it must not read as momentary');

// --- 2. The undecidable answer must be its own value, not null ---------------------------------------
assert.match(auth, /const MFA_UNRESOLVED = Symbol\(/,
  'AuthContext needs a value that means "could not decide" and is distinguishable from "no MFA needed"');
assert.match(auth, /nextMfaChallenge === MFA_UNRESOLVED\)\s*\{\s*finishLoading\(null, null, false\);/,
  'an undecidable MFA state must end the session, not restore it');

// --- 3. resolveMfaChallenge may never answer "no MFA needed" on a failure ------------------------------
const resolver = auth.slice(auth.indexOf('const resolveMfaChallenge ='), auth.indexOf('const denyUnresolvedSession ='));
assert.ok(resolver.length > 100, 'could not locate resolveMfaChallenge — this check is asserting nothing');
assert.doesNotMatch(resolver, /return null/,
  'resolveMfaChallenge must not answer null on a failure: null means "no second factor required" and '
  + 'grants access immediately');
assert.match(resolver, /isTransientAuthError\(/, 'the retry must be limited to momentary failures');
assert.match(resolver, /return denyUnresolvedSession\(\)/, 'a non-momentary failure must deny');
assert.match(auth, /denyUnresolvedSession = async[\s\S]{0,400}?supabase\.auth\.signOut\(\)/,
  'denying must also clear the persisted token, or a reload restores the same undecidable session');

// --- 4. supabase-js puts API failures in `error` — it does not throw -----------------------------------
// This is the subtle half. Even with everything above in place, an unchecked `{ data: null, error }` from
// listFactors() leaves verifiedTotp undefined, and `!verifiedTotp` is read as "nothing enrolled" → null →
// access. The fail-closed wrapper never even sees it.
const attempt = auth.slice(auth.indexOf('const attemptResolveMfaChallenge ='), auth.indexOf('const resolveMfaChallenge ='));
assert.ok(attempt.includes('listFactors()'), 'could not locate the factor lookup — this check is asserting nothing');
for (const [name, call] of [['factorsError', 'listFactors'], ['assuranceError', 'getAuthenticatorAssuranceLevel']]) {
  assert.match(attempt, new RegExp(`${name}[\\s\\S]{0,600}?throw ${name};`),
    `a failed ${call}() must throw, not fall through as "no second factor enrolled"`);
}
assert.match(attempt, /rememberedAssuranceError[\s\S]{0,200}?throw rememberedAssuranceError;/,
  'the remember-this-device path checks assurance too, and an unreadable answer there must fail closed');

// --- 5. login() was already closed; keep it that way --------------------------------------------------
assert.match(auth, /factorsError[\s\S]{0,200}?throw factorsError;[\s\S]{0,1200}?catch \(error\) \{[\s\S]{0,300}?setSession\(null\);/,
  'login() must still clear the session when the factor lookup fails, rather than stranding an aal1 login');

console.log('supabaseFailure selfcheck OK (an undecidable MFA state denies access instead of granting it)');
