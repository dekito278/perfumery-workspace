// `node src/utils/bespokeCheckout.selfcheck.mjs`
//
// Second visitor audit, 13 Nov 2026: the bespoke checkout was an older form than the main one — a SOLI code
// field the main checkout dropped (#595), "Email / WhatsApp" in one box, "TOTAL TRANSFER" under a DOKU
// payment, a line describing the interface instead of the order, and a payment form that opened for an
// empty brief (the English WhatsApp button sent "Scent: -").
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(src, 'pages', 'BespokePage.jsx'), 'utf8');

assert.doesNotMatch(page, /t\('bsp\.customerCode'\)|lookupCustomerByCode/, 'no SOLI code field on the bespoke checkout');
assert.match(page, /<input type="tel" inputMode="tel" autoComplete="tel" className="ng-field" value=\{form\.contact\}/, 'the contact is a WhatsApp number');
assert.match(page, /t\(isManualPayment \? 'bsp\.transferTotal' : 'checkout\.total'\)/, '"Total transfer" only when paying by transfer');
assert.match(page, /onClick=\{\(\) => \{ if \(needsScentFirst\(\)\) return; setCheckoutOpen\(true\); \}\}/, 'no payment form for an empty brief');
assert.match(page, /onClick=\{\(event\) => \{ if \(needsScentFirst\(\)\) event\.preventDefault\(\); \}\}/, 'and no WhatsApp brief saying "Scent: -"');
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['bsp.contact'], /WhatsApp/, `${language}: the field is named for WhatsApp`);
  assert.doesNotMatch(MESSAGES[language]['bsp.contactSectionBody'], /desain|design is chosen/i, `${language}: the lead describes the order, not the interface`);
}
console.log('bespokeCheckout selfcheck OK (one contact, the right total, no checkout without a brief)');
