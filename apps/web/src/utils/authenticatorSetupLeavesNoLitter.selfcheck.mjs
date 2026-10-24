// `node src/utils/authenticatorSetupLeavesNoLitter.selfcheck.mjs`
//
// Starting two-factor setup must not leave a half-finished factor on the account.
//
// supabase.auth.mfa.enroll creates the factor IMMEDIATELY, in `unverified` state, before the person
// has typed a digit. Abandon the page at the QR step — close the tab, change phones, give up after
// three mistyped codes — and that factor stays forever. The settings screen cannot show it: loadFactors
// keeps only `status === 'verified'`. So nothing on screen says it is there.
//
// They stack one per attempt, and Supabase caps enrolled factors per user. Reach the cap and enrol
// starts failing, on a screen that reports no authenticator and offers nothing to delete. For a
// one-person studio that lands at the worst moment — while trying to secure the account.
//
// Measured on the live project 2026-10-25: one verified factor, no litter. The mechanism is real and
// has simply not bitten yet, because the first enrolment succeeded on the first try. This keeps it
// that way.
//
// The screen was never covered by any guard before this: 108 of the 260 page and component files are
// named by no chain at all, and this was the one among them with the power to lock Dekito out.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const context = readFileSync(join(here, '..', 'contexts', 'AuthContext.jsx'), 'utf8');
const page = readFileSync(join(here, '..', 'pages', 'AuthenticatorSetupPage.jsx'), 'utf8');

/** The body of the brace-delimited block that starts at `from`, balanced rather than regexed. */
const blockFrom = (text, from) => {
  const open = text.indexOf('{', from);
  assert.notEqual(open, -1, 'no block where one was expected');
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error('unbalanced braces');
};

// --- 1. The cleanup exists, and removes ONLY what was never verified --------------------------------
const cleanupAt = context.indexOf('const discardUnverifiedAuthenticators');
assert.notEqual(cleanupAt, -1,
  'nothing clears abandoned enrolments, so every cancelled setup leaves an invisible factor behind');
const cleanup = blockFrom(context, cleanupAt);
assert.match(cleanup, /mfa\.unenroll/, 'the cleanup never actually removes anything');
assert.match(cleanup, /status\s*!==\s*'verified'/,
  'the cleanup does not restrict itself to UNVERIFIED factors. Removing a verified one here would '
  + 'strip working two-factor protection with no code typed — the exact thing disableAuthenticator '
  + 'demands proof of possession for');

// --- 2. Starting setup runs it FIRST ------------------------------------------------------------------
// Order matters: cleaning up after enrolling would delete the factor just created, which is still
// unverified at that moment.
const startAt = page.indexOf('const startSetup');
assert.notEqual(startAt, -1, 'the setup screen no longer has a startSetup');
const start = blockFrom(page, startAt);
const cleanIdx = start.indexOf('discardUnverifiedAuthenticators');
const enrolIdx = start.indexOf('enrollAuthenticator');
assert.notEqual(cleanIdx, -1, 'startSetup does not clear abandoned enrolments before making another');
assert.notEqual(enrolIdx, -1, 'startSetup no longer enrols');
assert.ok(cleanIdx < enrolIdx,
  'the cleanup runs AFTER enrolling, so it deletes the factor just created — which is unverified at '
  + 'that moment and matches its own filter. Setup would never complete');

// --- 3. The screen still hides unverified factors, which is WHY the cleanup is needed ----------------
// Not a complaint: showing a half-made factor as if it were protection would be worse. This pins the
// pairing, so that if the filter is ever relaxed the reason for the cleanup is re-read rather than
// assumed.
assert.match(page, /status === 'verified'/,
  'the settings list no longer filters to verified factors. If it now shows unverified ones, re-read '
  + 'discardUnverifiedAuthenticators: its whole reason was that they were invisible here');

// --- 4. Turning two-factor OFF still needs a live code ------------------------------------------------
// The cleanup must not become a back door. Guarded because it sits next to a path that deliberately
// does the opposite.
const disableAt = context.indexOf('const disableAuthenticator');
assert.notEqual(disableAt, -1, 'disableAuthenticator is gone');
const disable = blockFrom(context, disableAt);
assert.match(disable, /\/\^\\d\{6\}\$\//,
  'disabling two-factor no longer demands a six digit code, so any lingering session could strip it');
assert.match(disable, /mfa\.verify/,
  'the code is asked for but never verified, which is the same as not asking');

console.log('authenticatorSetupLeavesNoLitter selfcheck OK (abandoned enrolments cleared first, verified ones untouched, disable still needs a code)');
