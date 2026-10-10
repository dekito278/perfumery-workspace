// `node src/utils/memberNudgeIsHonest.selfcheck.mjs`
//
// The cart offered "Harga member · hemat Rp X · Masuk" to everyone, signed in or not.
//
// The saving is real arithmetic — the cart's line prices against the member prices on the products, and
// all 19 products carry one. What nobody carries is the TIER. Measured on production 2026-10-11:
// 43 of 43 customers are 'retail', including the 8 who have linked a Google account. The tier lives on
// the customer row and only Dekito can grant it.
//
// So a customer who had already signed in was told to sign in, with a link to the account page they
// were signed into, to collect a saving that signing in cannot produce. The two CHECKOUT screens never
// had this problem: their nudge sits inside the sign-in button itself, so it disappears the moment there
// is a session. The two CART screens showed it unconditionally.
//
// Dekito's decision, 11 Oct 2026: keep the offer for a visitor who has not signed in, where the call to
// action is honest, and drop it once they have.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { memberSavingForCart, shouldPromptSignInForMemberPrice } from './memberPriceNudge.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// ── 1. The predicate, run over the four states a viewer can be in ────────────────────────────────
assert.equal(shouldPromptSignInForMemberPrice({ saving: 25000, signedIn: false }), true,
  'a visitor who has not signed in is offered the member price — the call to action is honest there');
assert.equal(shouldPromptSignInForMemberPrice({ saving: 25000, signedIn: true }), false,
  'someone already signed in must not be told to sign in: only the tier on their customer row can '
  + 'change the price, and all 43 customers on production are retail');
assert.equal(shouldPromptSignInForMemberPrice({ saving: 0, signedIn: false }), false,
  'and with nothing to save there is nothing to offer');
assert.equal(shouldPromptSignInForMemberPrice({ saving: 0, signedIn: true }), false);
// Defaults and junk: a missing argument must not turn the offer on.
assert.equal(shouldPromptSignInForMemberPrice(), false, 'no arguments is not an offer');
assert.equal(shouldPromptSignInForMemberPrice({}), false);
assert.equal(shouldPromptSignInForMemberPrice({ saving: -500, signedIn: false }), false,
  'a negative saving is not a saving');
assert.equal(shouldPromptSignInForMemberPrice({ saving: NaN, signedIn: false }), false);

// A signed-in MEMBER needs no special case, and this is why: their lines already carry the member
// price, so the arithmetic answers 0 and the line was never drawn.
// The index is slug -> variantId -> { member, reseller }, as tierPricesForLine reads it.
const index = { 'la-rose': { '': { member: 200000 } } };
assert.equal(memberSavingForCart([{ productSlug: 'la-rose', priceNumber: 250000, quantity: 1 }], index), 50000,
  'a retail line against a member price is a real saving');
assert.equal(memberSavingForCart([{ productSlug: 'la-rose', priceNumber: 200000, quantity: 1 }], index), 0,
  "a member's own line has nothing left to save");

// ── 2. Both carts ask the predicate, and neither draws the line any other way ────────────────────
for (const file of ['pages/CartPage.jsx', 'pages/mobile/MobileCartPage.jsx']) {
  const source = read(...file.split('/'));
  assert.match(
    source,
    /shouldPromptSignInForMemberPrice\(\{ saving: memberSaving, signedIn: Boolean\(currentUser\) \}\)/,
    `${file} must ask whether the offer is honest for THIS viewer`,
  );
  assert.match(source, /useAuth\(\)/, `${file} must know whether anyone is signed in`);
  // The condition that draws the line is the predicate's answer, not the raw saving. A file that still
  // branches on `memberSaving > 0` around the CTA would show it to everyone again.
  const cta = source.indexOf("why.member.cta");
  assert.notEqual(cta, -1, `${file} no longer carries the member sign-in call to action`);
  const block = source.slice(Math.max(0, cta - 700), cta);
  assert.match(block, /offerMemberSignIn \?/, `${file} draws the sign-in offer from something other than the predicate`);
  assert.ok(
    !/\{memberSaving > 0 \? \(/.test(block) && !/items\.length && memberSaving > 0 \? \(/.test(block),
    `${file} still branches on the raw saving around the call to action`,
  );
}

// ── 3. The two checkout screens were always right, and must stay that way ────────────────────────
// Their nudge is the label of the sign-in button, so a session removes it. Pinned, because moving that
// line out of the ternary would reintroduce the bug on the louder screen.
for (const file of ['pages/CheckoutPage.jsx', 'pages/mobile/MobileCheckoutPage.jsx']) {
  const source = read(...file.split('/'));
  const at = source.indexOf('checkout.signInSaving');
  assert.notEqual(at, -1, `${file} no longer names the member saving at sign-in`);
  const before = source.slice(Math.max(0, at - 1200), at);
  assert.match(
    before,
    /currentUser \?/,
    `${file} must only offer the saving on the branch where nobody is signed in`,
  );
}

console.log('memberNudgeIsHonest: ok — the offer is made to visitors who can still act on it, and to nobody else');
