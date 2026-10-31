// The three answers on the product page must describe the shop that exists.
//
// This shop has no FAQ, no shipping page and no policy page — the whole route table was read. Until
// BuyerAnswers there was no way to learn what shipping costs, how you pay, or how a parcel is followed
// without reaching the checkout and finding out. Copy like that goes stale silently: nobody rereads a
// paragraph when they change a payment method.
//
// So the rules below hold the SENTENCES to the CODE that does the thing, not to my memory of it. The
// payment list is lifted out of cartService; if Dekito turns QRIS on, this guard fails and the answer
// has to be rewritten before the build passes.
//
// Two defects the existing guards caught while this was being written, kept here so they stay caught:
//   - the first version described the domestic checkout to everybody, so an overseas reader was told to
//     pick an Indonesian courier and transfer rupiah for a parcel this checkout cannot price or send
//   - the tracking answer told the buyer to ask us, with no way to ask beside it

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES } from '../i18n/messages.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');
const component = read('../components/storefront/BuyerAnswers.jsx');
// The markup checks read the CODE. The first version passed its own docstring: the comment explaining
// why these are plain <details> satisfied the rule that they must be plain <details>, so swapping the
// real element for a <div> changed nothing. A guard that can be satisfied by the sentence describing it
// is a guard that only ever proves someone wrote the sentence.
const markup = component.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// --- 1. It is on every product page, found by walking rather than by naming two files ----------------
const PAGES = path.resolve(HERE, '../pages');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const productPages = walk(PAGES).filter((file) => /ProductDetailPage\.jsx$/.test(path.basename(file)));
// Floor lowered when the phone storefront retired (2026-10-31): every screen counted here had a phone twin.
assert.ok(productPages.length >= 1, `only ${productPages.length} product page(s) found — the walk lost them`);
for (const file of productPages) {
  // The delimiter matters: /<BuyerAnswers/ alone also matches <BuyerAnswersX, so renaming the component
  // out of a page left this green.
  assert.match(fs.readFileSync(file, 'utf8'), /<BuyerAnswers[\s/>]/,
    `${path.basename(file)} does not carry the answers, so its buyers still have nowhere to read them`);
}

// --- 2. It opens without JavaScript -------------------------------------------------------------------
// <details>/<summary>, not an accordion component: correct for keyboard and screen readers with no ARIA
// of mine, and the browser's own find-in-page reaches inside a closed one.
assert.match(markup, /<details/, 'the answers must be plain <details>');
assert.match(markup, /<summary/, 'each question must be a <summary>, or it is not focusable');

// --- 3. The payment answer names the methods the shop ACTUALLY offers ---------------------------------
// Lifted from the file that defines them. A list in this guard would be a second copy that keeps passing
// after the real one changes — which is how copy goes stale in the first place.
const cart = read('../services/cartService.js');
const methodsBlock = cart.match(/export const checkoutPaymentMethods = \[([\s\S]*?)\n\];/);
assert.ok(methodsBlock, 'could not lift checkoutPaymentMethods out of cartService — fix this guard, not the app');
// A floor before the conditional below it. The first version only checked the DOKU wording
// `if (offersDoku)` — so misspelling the id in cartService turned the check OFF instead of red, and the
// guard passed by having nothing left to prove. Assert the method is THERE, then read the copy.
//
// The list mixes two shapes: named constants (MANUAL_TRANSFER_PAYMENT, QRIS_PAYMENT) and one inline
// object for DOKU. Counting `id:` alone finds one entry and says the parse broke, which is how this
// floor first failed — the shape of the data, not the data, was wrong.
assert.match(methodsBlock[1], /MANUAL_TRANSFER_PAYMENT/,
  'manual transfer left checkoutPaymentMethods — answers.paymentA still offers it. Rewrite the answer.');
assert.match(methodsBlock[1], /id: 'doku'/,
  'DOKU left checkoutPaymentMethods — answers.paymentA still offers it. Rewrite the answer.');
const offersDoku = /id: 'doku'/.test(methodsBlock[1]);
const qrisStillBehindFlag = /QRIS_ENABLED \? \[QRIS_PAYMENT\] : \[\]/.test(methodsBlock[1]);

for (const language of ['id', 'en']) {
  const answer = MESSAGES[language]['answers.paymentA'];
  assert.ok(answer, `${language}.answers.paymentA is missing — the page would print the key`);
  if (offersDoku) {
    assert.match(answer, /DOKU/, `${language}: the shop offers DOKU and the answer does not mention it`);
  }
  assert.match(answer, /transfer/i, `${language}: manual transfer is always offered and must be named`);
}
assert.ok(qrisStillBehindFlag,
  'QRIS left its env flag — a third way to pay is live and answers.paymentA still names two. Rewrite it.');

// --- 4. The English shop is not told about the Indonesian till ----------------------------------------
// The overseas flow is a cart in dollars, a destination, DHL shipping, and WhatsApp as the till. Naming
// a domestic courier or a rupiah transfer there describes a checkout that cannot serve that buyer.
const FORBIDDEN_ABROAD = /\b(DOKU|rekening|bank account|kurir|courier(?!ed))\b/i;
for (const language of ['id', 'en']) {
  for (const key of ['answers.shippingIntlA', 'answers.payIntlA']) {
    const answer = MESSAGES[language][key];
    assert.ok(answer, `${language}.${key} is missing`);
    assert.doesNotMatch(answer, FORBIDDEN_ABROAD,
      `${language}.${key} describes the domestic checkout to an overseas buyer: ${answer}`);
  }
  assert.match(MESSAGES[language]['answers.payIntlA'], /WhatsApp/,
    `${language}: the overseas order is settled on WhatsApp and the answer must say so`);
  assert.match(MESSAGES[language]['answers.shippingIntlA'], /DHL/,
    `${language}: one courier carries the overseas parcels and the answer must name it`);
}
assert.match(component, /const \{ isInternational \} = useStorefrontRegion\(\)/,
  'the component must ask which shop it is in, or both shops get the same answers');
assert.match(component, /isInternational\s*\?\s*\[/, 'and branch on it');

// --- 5. Nothing is promised that the shop does not do -------------------------------------------------
// 0 of 35 orders on production carry a tracking number; the portal has always said tracking goes through
// WhatsApp. An answer offering a waybill would be a promise this shop has never once kept.
for (const language of ['id', 'en']) {
  assert.doesNotMatch(MESSAGES[language]['answers.trackingA'], /\b(resi|waybill|tracking number|nomor lacak)\b/i,
    `${language}: the tracking answer offers a number this shop does not issue`);
  assert.match(MESSAGES[language]['answers.trackingA'], /WhatsApp/,
    `${language}: say where tracking actually happens`);
}

// --- 6. Every answer exists in both shops -------------------------------------------------------------
const used = [...component.matchAll(/t\('(answers\.[A-Za-z]+)'\)/g)].map((match) => match[1]);
assert.ok(used.length >= 8, `only ${used.length} answer key(s) read from the component — the scan is broken`);
for (const key of new Set(used)) {
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language][key], `${language}.${key} is missing — one shop would print the raw key`);
  }
}

// --- 7. The sentence that asks the buyer to contact us carries the way to do it -----------------------
// contactPrompt enforces this across the shop; repeated here against THIS component so a reworded answer
// cannot quietly lose its button.
// BOTH branches, counted. The first version matched once and was satisfied by the English branch while
// the Indonesian one had quietly lost its button.
const carried = markup.match(/t\('answers\.trackingA'\), ask: <AskAtelierButton/g) || [];
assert.equal(carried.length, 2,
  `the tracking answer carries AskAtelierButton in ${carried.length} of the 2 shops — a sentence telling `
  + 'the buyer to ask us, beside no way to ask, is the defect contactPrompt exists for');
