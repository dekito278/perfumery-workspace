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
//
// The rule moved again on 10 Nov 2026: signing in no longer makes anyone a member — a member code or a paid
// order here does. So the honest offer is now to whoever is NOT A MEMBER, signed in or not, and it leads to
// the account page, which says how to become one and takes the code.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { memberSavingForCart, shouldOfferMemberPrice } from './memberPriceNudge.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// ── 1. The predicate, run over the states a viewer can be in ──────────────────────────────────────
assert.equal(shouldOfferMemberPrice({ saving: 25000, isMember: false }), true,
  'someone who is not a member yet is offered the member price, signed in or not — signing in alone no longer gives it');
assert.equal(shouldOfferMemberPrice({ saving: 25000, isMember: true }), false,
  'a member is not offered what they already have');
assert.equal(shouldOfferMemberPrice({ saving: 0, isMember: false }), false,
  'and with nothing to save there is nothing to offer');
assert.equal(shouldOfferMemberPrice({ saving: 0, isMember: true }), false);
// Defaults and junk: a missing argument must not turn the offer on.
assert.equal(shouldOfferMemberPrice(), false, 'no arguments is not an offer');
assert.equal(shouldOfferMemberPrice({}), false);
assert.equal(shouldOfferMemberPrice({ saving: -500, isMember: false }), false,
  'a negative saving is not a saving');
assert.equal(shouldOfferMemberPrice({ saving: NaN, isMember: false }), false);

// A signed-in MEMBER needs no special case, and this is why: their lines already carry the member
// price, so the arithmetic answers 0 and the line was never drawn.
// The index is slug -> variantId -> { member, reseller }, as tierPricesForLine reads it.
const index = { 'la-rose': { '': { member: 200000 } } };
assert.equal(memberSavingForCart([{ productSlug: 'la-rose', priceNumber: 250000, quantity: 1 }], index), 50000,
  'a retail line against a member price is a real saving');
assert.equal(memberSavingForCart([{ productSlug: 'la-rose', priceNumber: 200000, quantity: 1 }], index), 0,
  "a member's own line has nothing left to save");

// ── 2. Both carts ask the predicate, and neither draws the line any other way ────────────────────
for (const file of ['pages/CartPage.jsx']) {
  const source = read(...file.split('/'));
  assert.match(
    source,
    /shouldOfferMemberPrice\(\{ saving: memberSaving, isMember: tier === 'member' \|\| tier === 'reseller' \}\)/,
    `${file} must ask whether the offer is honest for THIS viewer, from the tier the server resolved`,
  );
  assert.match(source, /const \{ tier \} = useTierPrices\(\);/, `${file} must read the server-resolved tier, not the session`);
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
for (const file of ['pages/CheckoutPage.jsx']) {
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

console.log('memberNudgeIsHonest: ok — the offer is made to whoever is not a member yet, and to nobody else');
