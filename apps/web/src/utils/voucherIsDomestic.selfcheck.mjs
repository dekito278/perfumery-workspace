// `node src/utils/voucherIsDomestic.selfcheck.mjs`
//
// Vouchers apply to deliveries inside Indonesia. Dekito's decision, 2026-09-25, and the same shape as the
// member price he ruled on the day before.
//
// The arithmetic is why it matters. A voucher takes its cut from whatever subtotal it is handed, and an
// international subtotal is the domestic one times 2.2 or 3.5. So a 10% code written as "about Rp 36.000
// off a bottle" becomes Rp 126.000 off the same bottle going to Berlin — and a code with a minimum spend
// meant to encourage a second bottle is cleared by one. Nothing in the code prevented this: the endpoint
// validated the voucher and never asked where the parcel was going.
//
// Three things have to agree, and the order of authority matters: the SERVER refuses, because the code
// travels in the request; the checkout stops asking, so nobody is quoted a total that will be refused;
// and the greeting card's note says so, because that is where the code comes from.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { destinationFor } from './internationalDestination.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// --- 1. The server refuses, and refuses on the DESTINATION ---------------------------------------------
// Not on the shop's language: an Indonesian reading the English shop and shipping to Bekasi keeps their
// voucher. destinationFor is what separates the two, and it answers null for home.
assert.equal(destinationFor('ID'), null, 'an Indonesian address is not a destination abroad');
assert.ok(destinationFor('DE'), 'Germany is');
assert.ok(destinationFor('SG'), 'and so is Singapore, shipping included or not');

const endpoint = readFileSync(join(root, '..', 'api', 'orders', 'create.js'), 'utf8');
const refusal = endpoint.slice(endpoint.indexOf('if (voucherCode && destination)'), endpoint.indexOf('if (voucherCode) {'));
assert.ok(refusal, 'the endpoint no longer refuses a voucher on an international order — the discount '
  + 'comes off a subtotal 3.5x the one the code was written for, and the browser chooses the code');
assert.match(refusal, /jsonResponse\(res, 422/,
  'it must refuse rather than drop the voucher silently: dropping it charges the buyer more than the '
  + 'total they confirmed, which is the audit-round-7 bug in a new hat');
assert.match(refusal, /reason: 'domestic_only'/, 'and name the reason, so the checkout can explain it');

// --- 2. The checkout stops asking, so nobody is quoted a total the server will not honour ---------------
const hook = read('hooks', 'useCheckoutFlow.js');
assert.match(hook, /const activeVoucherCode = destination \? '' : voucherCode;/,
  'the checkout must drop the code once a destination abroad is chosen');
assert.match(hook, /const discountAmount = destination\s*\n\s*\? 0/,
  'and drop the discount with it — a total showing a discount the server refuses is a total that moves '
  + 'at the last moment');
// Every place the code leaves this hook must send the dropped one, not the original.
const sent = hook.match(/voucherCode[,:]/g) || [];
const sentActive = hook.match(/voucherCode: activeVoucherCode/g) || [];
assert.ok(sentActive.length >= 4,
  `expected every submit path to send the narrowed code, found ${sentActive.length} of ${sent.length}`);

for (const page of [['pages', 'CheckoutPage.jsx'], ['pages', 'mobile', 'MobileCheckoutPage.jsx']]) {
  const source = read(...page);
  assert.match(source, /destination \?[\s\S]{0,200}checkout\.voucherDomesticOnly/,
    `${page.join('/')} still offers a voucher box for a parcel leaving the country — the code it takes `
    + 'will be refused at submit, after the buyer has filled in everything else');
}

// --- 3. And the card the code comes from says where it works -------------------------------------------
for (const locale of ['id', 'en']) {
  const message = MESSAGES[locale]['checkout.voucherDomesticOnly'];
  assert.ok(message, `checkout.voucherDomesticOnly is missing in ${locale}`);
  assert.match(message, /Indonesia/i, `${locale} must say where a voucher does apply`);
}
assert.notEqual(MESSAGES.id['checkout.voucherDomesticOnly'], MESSAGES.en['checkout.voucherDomesticOnly'],
  'each shop says it in its own language');
assert.match(MESSAGES.en['welcome.voucherBody'], /inside Indonesia/i,
  'the greeting card note is where a card-holder abroad learns this before the checkout refuses them');

console.log('voucherIsDomestic selfcheck OK (the server refuses, the checkout stops asking, and the card '
  + 'says where the code works)');
