// `node src/utils/abroadOrdersOnWhatsApp.selfcheck.mjs`
//
// Dekito, 14 Nov 2026: "Sekarang saya merasa nggak ada orang lagi yang menghubungi saya, orang dari luar" —
// since the English cart took the address in a form (10 Nov), buyers abroad stopped writing to him. His
// decision: "pembeli luar saja, formulir alamat hapus". The English cart keeps the basket, the country, the
// shipping and the total; the order is a WhatsApp message carrying all of it, and the address and payment
// are settled in the chat. The Indonesian checkout is unchanged.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cart = readFileSync(join(root, 'pages', 'InternationalCartPage.jsx'), 'utf8');

assert.ok(!existsSync(join(root, 'components', 'storefront', 'InternationalOrderForm.jsx')), 'the address form is back');
assert.doesNotMatch(cart, /InternationalOrderForm|placeInternationalOrder|<input/, 'the English cart takes an address again');
assert.match(cart, /href=\{canOrder \? buildWhatsAppCheckoutUrl\(message, phone\) : '#'\}/, 'the English cart orders on WhatsApp');
assert.match(cart, /t\(needsDestination \? 'intlQuote\.pickFirst' : 'cart\.intl\.order'\)/, 'the button asks for the country first, then orders');

for (const language of ['id', 'en']) {
  const draft = MESSAGES[language]['export.waCartDraft'];
  for (const placeholder of ['{lines}', '{destination}', '{total}']) assert.ok(draft.includes(placeholder), `${language}: the WhatsApp order lost ${placeholder}`);
  for (const key of ['export.waCartDraft', 'export.waCartAsk']) {
    assert.match(MESSAGES[language][key], /(alamat pengiriman saya|delivery address):\n$/, `${language}.${key} no longer asks for the address at its end`);
  }
  assert.match(MESSAGES[language]['cart.intl.order'], /WhatsApp/);
}

// The Indonesian checkout still takes its own address and order.
assert.ok(existsSync(join(root, 'pages', 'CheckoutPage.jsx')));
assert.match(readFileSync(join(root, 'pages', 'CheckoutPage.jsx'), 'utf8'), /id="checkout-address"/, 'the Indonesian checkout lost its address field');

console.log('abroadOrdersOnWhatsApp selfcheck OK (the English cart orders on WhatsApp with basket, country and total; the address is asked in the chat)');
