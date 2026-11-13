// `node src/utils/oneCodeField.selfcheck.mjs`
//
// ONE FIELD FOR EVERY CODE (Dekito, 13 Nov 2026: "jangan bikin orang pusing masukin kode"). The checkout used
// to offer four code-ish things at once: Google sign-in, a member-code box, the SOLI customer code with its
// own "Muat" button, and the voucher field. A buyer handed a code by their community could not know which
// box it belonged in. Now there is one field, "Kode", on the cart, the checkout and the bespoke page:
//
//   1. it is tried as a voucher;
//   2. a code that is NOT a voucher (and only that: an expired or too-small-order voucher keeps its own
//      message) is tried as a member code — in the Indonesian shop only, where member codes exist;
//   3. a member code needs an account, so a visitor who is not signed in is asked to sign in, not told
//      the code is wrong.
//
// The hook is React, so the wiring is read; the copy is checked in both languages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const hook = read('hooks', 'useAppliedVoucher.js');
assert.match(hook, /!nextResult\.valid && nextResult\.reason === VOUCHER_VALIDATION_REASONS\.NOT_FOUND\s*&& await tryAsMemberCode\(nextCode\)/,
  'only a code that is not a voucher at all is tried as a member code');
const tryAs = hook.slice(hook.indexOf('const tryAsMemberCode'), hook.indexOf('const applyVoucher'));
assert.match(tryAs, /if \(isInternational\) return false;/, 'abroad there are no member codes: a non-voucher is simply not found');
assert.ok(tryAs.indexOf('if (!currentUser)') < tryAs.indexOf('redeemMemberCode('),
  'a visitor who is not signed in is asked to sign in before anything is redeemed');
assert.match(tryAs, /t\('code\.memberSignIn'/, 'and is told so in words, not "kode tidak ditemukan"');
assert.match(tryAs, /outcome === 'ok'\) \{\s*await refreshTierPrices\(\);/,
  'a member code taken here re-prices the cart and catalogue at once, like the account page does');
assert.match(hook, /smaller: 'member\.codeSmaller'/, 'a smaller code than the one held says so (20261113090000)');
assert.match(tryAs, /MEMBER_RESULT_KEYS\[outcome\]/, 'every refusal from the redeem function gets its own sentence');
assert.match(hook, /codeAccepted: memberJoined \|\| Boolean\(result\.valid\)/,
  'a member code taken is good news, painted as such, though no voucher applied');

// The three pages that take a code all use the one hook and paint by its verdict.
for (const page of ['CartPage.jsx', 'CheckoutPage.jsx', 'BespokePage.jsx']) {
  const source = read('pages', page);
  assert.match(source, /useAppliedVoucher\(/, `${page} takes codes through the one hook`);
  assert.match(source, /voucher\.codeAccepted/, `${page} paints the message by the hook's verdict, not by "a voucher applied"`);
}
const checkout = read('pages', 'CheckoutPage.jsx');
assert.doesNotMatch(checkout, /<MemberCodePanel\b/, 'the checkout has no second code box');
assert.doesNotMatch(checkout, /t\('checkout\.customerCode'\)/, 'nor a SOLI customer-code box');

// Copy: the Indonesian field names both kinds, so a buyer knows a community code goes here too.
for (const key of ['cart.voucherPrompt', 'checkout.voucherEnter']) {
  assert.match(MESSAGES.id[key], /voucher/i, `id.${key} names vouchers`);
  assert.match(MESSAGES.id[key], /member/i, `id.${key} names member codes too — one field for both`);
}
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['code.memberSignIn'], /\{code\}[\s\S]*Google/, `${language}.code.memberSignIn says to sign in`);
  assert.match(MESSAGES[language]['code.unknown'], /\{code\}/, `${language}.code.unknown names the code typed`);
}

// A typed, unapplied code survives a reload (fifth audit, 13 Nov 2026).
{
  const hook = readFileSync(new URL('../hooks/useAppliedVoucher.js', import.meta.url), 'utf8');
  assert.match(hook, /useState\(\(\) => getAppliedVoucherCode\(\) \|\| readCodeDraft\(\)\)/, 'the field starts from the applied code, else the draft');
  assert.match(hook, /useEffect\(\(\) => \{ writeCodeDraft\(inputCode\); \}, \[inputCode\]\);/, 'and the draft follows the typing');
  assert.match(hook, /window\.sessionStorage/, 'per tab, not forever');
}
console.log('oneCodeField selfcheck OK (one field takes a voucher or a member code; the checkout asks for nothing else)');
