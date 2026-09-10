// `node src/utils/checkoutFailureHonesty.selfcheck.mjs`
//
// submitOrder creates the order first and prepares the payment session second. For QRIS and card that
// second step is a network call to DOKU, so it fails on any DOKU timeout or outage — and the catch used
// to answer every failure with "Gagal menyimpan pesanan", for an order that api/orders/create.js had
// already written with the service role. A buyer who believes that submits again and pays twice.
//
// The rollback that used to sit in that catch could never fire from a buyer's browser: it writes
// storefront_orders, which is admin-only, so RLS filtered it and it only warned.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hook = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'useCheckoutFlow.js'),
  'utf8',
);

const catchStart = hook.indexOf('} catch (error) {', hook.indexOf('const submitOrder'));
const catchBody = hook.slice(catchStart, hook.indexOf('} finally {', catchStart));
assert.ok(catchStart > 0 && catchBody, 'submitOrder no longer has the catch this guard describes');

// "The order was not saved" may only be said while that is true.
const noOrderYet = catchBody.indexOf('if (!createdOrder)');
const claimsFailure = catchBody.indexOf('Gagal menyimpan pesanan');
assert.ok(noOrderYet >= 0, 'the catch must separate "no order yet" from "order placed, payment step failed"');
assert.ok(
  claimsFailure > noOrderYet && claimsFailure < catchBody.indexOf('createdOrder.orderNumber'),
  'the "Gagal menyimpan pesanan" message must sit inside the !createdOrder branch and nowhere else',
);

// Once the order exists the buyer goes to the payment page, and is told not to order again.
assert.match(catchBody, /navigate\(`\$\{paymentPath\}\?order=/,
  'an order that exists must send the buyer to its payment page, not back to an error');
assert.match(catchBody, /Jangan checkout ulang/,
  'the message must tell the buyer not to submit again — that is the duplicate order this prevents');
assert.doesNotMatch(catchBody, /updateOrderStatus\(/,
  'the buyer-side cancel cannot work (storefront_orders UPDATE is admin-only); the reservation sweep owns '
  + 'an unpaid order');

// A browser that refuses storage must not be able to turn a placed order into an error.
const helper = hook.slice(hook.indexOf('const rememberPaymentSession'), hook.indexOf('const getFriendlyShippingError'));
assert.match(helper, /try \{[\s\S]*sessionStorage\.setItem\([\s\S]*\} catch/,
  'rememberPaymentSession must be the one place that touches sessionStorage, and must catch');
assert.equal((hook.match(/sessionStorage\.setItem\(/g) || []).length, 1,
  'every payment session write must go through rememberPaymentSession — a bare setItem can throw a placed '
  + 'order onto the error path');
assert.equal((hook.match(/rememberPaymentSession\(\{/g) || []).length, 3,
  'all three payment paths (manual transfer, QRIS, card) hand over the session the same way');

console.log('checkoutFailureHonesty selfcheck OK (a placed order is never reported as unsaved)');
