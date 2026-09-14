// `node src/utils/internationalCheckout.selfcheck.mjs`
//
// An international buyer who reaches this checkout cannot complete it, and until now nothing said so.
//
// Shipping destinations come from RajaOngkir — an Indonesian domestic courier API. A search for a foreign
// city returns an EMPTY LIST with HTTP 200 and no error, so the buyer types their city, sees nothing come
// back, and never learns why. There is no country field anywhere in the form.
//
// Two numbers also have to be reconciled: the product page quotes them the international price, the cart
// totals the Indonesian one. Both are true; which applies depends on where the parcel goes.
//
// This is the guard for the notice that says all of that BEFORE the address form, and for the rule that
// it must not block anyone.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The premise, held in the code it is about ---------------------------------------------------------
// If a country field ever appears, or destinations stop coming from a domestic-only API, this notice
// becomes a lie and should be revisited rather than left standing.
const destinations = read('..', 'api', 'shipping', 'destinations.js');
assert.match(destinations, /rajaongkir/i, 'destinations still come from the Indonesian domestic courier API');
for (const form of [['pages', 'CheckoutPage.jsx'], ['pages', 'mobile', 'MobileCheckoutPage.jsx']]) {
  const source = read(...form);
  assert.doesNotMatch(source, /autoComplete="country"|name="country"|<select[^>]*country/i,
    `${form.join('/')} still has no country field — the day it gets one, this notice needs rewriting`);
}

// --- 2. It informs; it must never block ---------------------------------------------------------------------
// The region is a language and pricing choice, not proof of location. An Indonesian who reads English, or
// anyone shipping to an Indonesian address, must still be able to buy — refusing a real order on a guess
// is worse than the confusion it would prevent.
const notice = read('components', 'storefront', 'InternationalCheckoutNotice.jsx');
assert.match(notice, /if \(!isInternational\) return null;/, 'silent in the Indonesian shop');
assert.doesNotMatch(notice, /disabled|preventDefault|navigate\(|return <Navigate/,
  'the notice must not disable, redirect, or intercept anything');
assert.match(notice, /role="note"/, 'it is a note, not an alert or a dialog');
// Rendered, not merely present in the message file. A sabotage deleted the paragraph and the old
// assertion — which only checked the string existed — passed. This is the sentence that stops an
// Indonesian reading English from concluding they cannot order at all.
assert.match(notice, /\{t\('intl\.domesticOk'\)\}/, 'the notice renders the domestic-address line');
assert.match(MESSAGES.en['intl.domesticOk'], /Indonesia/,
  'and it says out loud that a domestic address can carry on through checkout');
assert.match(MESSAGES.id['intl.domesticOk'], /Indonesia/);
// Every line of the notice has to be on screen, for the same reason.
for (const key of ['intl.noticeTitle', 'intl.noticeBody', 'intl.domesticOk', 'intl.noticeCta']) {
  assert.ok(notice.includes(`t('${key}')`), `${key} is rendered, not just defined`);
}

// --- 3. It reconciles the two prices the same visitor has just seen ---------------------------------------------
// Without this, the product page said Rp 2.630.000 and the cart says Rp 750.000, and the buyer has to
// guess which one they will be charged.
assert.match(MESSAGES.en['intl.noticeBody'], /Indonesian prices/i, 'the cart total is named as the Indonesian price');
assert.match(MESSAGES.en['intl.noticeBody'], /international price/i, 'and the product-page number as the international one');
assert.match(MESSAGES.id['intl.noticeBody'], /harga Indonesia/i);
assert.match(MESSAGES.id['intl.noticeBody'], /harga internasional/i);

// --- 4. And it offers the way out, in the language they were reading ----------------------------------------------
assert.match(notice, /buildWhatsAppCheckoutUrl\(t\('intl\.noticeMessage'\), whatsapp\)/,
  'the WhatsApp draft is written in the shop\'s language');
assert.match(MESSAGES.en['intl.noticeMessage'], /Hello SOLIVAGANT/);
assert.match(MESSAGES.id['intl.noticeMessage'], /Halo SOLIVAGANT/);
assert.match(notice, /getStorefrontWhatsAppNumber\(\)/, 'the number has one source');
assert.match(notice, /whatsapp \? \(/, 'and the button is hidden when none is configured — a dead link is worse than none');
assert.doesNotMatch(notice, /\d{9,}/, 'no hardcoded number');

// --- 5. Before the address form, on all four surfaces ---------------------------------------------------------------
// Two carts and two checkouts. Missing from one of them is the dead end this exists to close, on exactly
// the surface nobody tested.
for (const page of [
  ['pages', 'CartPage.jsx'],
  ['pages', 'mobile', 'MobileCartPage.jsx'],
  ['pages', 'CheckoutPage.jsx'],
  ['pages', 'mobile', 'MobileCheckoutPage.jsx'],
]) {
  assert.match(read(...page), /<InternationalCheckoutNotice /, `${page.join('/')} shows the notice`);
}
// On the desktop checkout it has to come BEFORE the form, not under it.
const checkout = read('pages', 'CheckoutPage.jsx');
assert.ok(checkout.indexOf('<InternationalCheckoutNotice') < checkout.indexOf('<form className="checkout-form"'),
  'the notice comes before the form — said after the search fails, it is an apology rather than a warning');

console.log('internationalCheckout selfcheck OK (a buyer who cannot finish this checkout is told before the form, not after an empty search, and nobody is blocked on a guess)');
