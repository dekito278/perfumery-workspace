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

// --- The form is not "incomplete" just because it is being submitted ------------------------------------
// canSubmitCheckout used to include `&& !saving`, so pressing the button turned the form incomplete. The
// red line "Lengkapi: data checkout." appeared the instant the order started being created, named
// nothing — nothing WAS missing, so the field list came out empty and fell through to a generic phrase —
// and stayed for the whole ~20 seconds DOKU took, directly above a button reading "Memproses...". On the
// phone the summary bar flipped from the total to "Lengkapi dulu" in amber for the same twenty seconds.
//
// Whether the button is pressable is a different question. Both surfaces answer it where the button is.
{
  const start = hook.indexOf('const canSubmitCheckout = Boolean(');
  assert.notEqual(start, -1, 'the checkout still decides whether the form is complete');
  const body = hook.slice(start, hook.indexOf(');', start));
  assert.doesNotMatch(body, /\bsaving\b/,
    'canSubmitCheckout must not depend on `saving` — submitting the form is not the same as the form '
    + 'being incomplete, and the buyer is told to fill in what they just filled in');
  // Each button still refuses a second press on its own.
  for (const [file, pattern] of [
    ['CheckoutPage.jsx', /disabled=\{[^}]*\bsaving\b/],
    [join('mobile', 'MobileCheckoutPage.jsx'), /disabled=\{[^}]*\bsaving\b/],
  ]) {
    const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', file), 'utf8');
    assert.match(page, pattern, `${file}: the submit button must still be disabled while saving`);
  }

  // And whatever makes the form incomplete has to be NAMEABLE. The notice reads "Lengkapi: {fields}"
  // from a list built separately, and a condition missing from that list produces a red line that names
  // nothing to act on. This is the "keep in sync" comment above the list, enforced.
  const conditions = new Set(
    (body.match(/\b[a-zA-Z_$][\w$]*\b/g) || [])
      .filter((name) => !['Boolean', 'const', 'canSubmitCheckout', 'length', 'trim', 'items'].includes(name)),
  );
  assert.ok(conditions.size >= 6, 'the scan must actually find the conditions');

  const desktop = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'CheckoutPage.jsx'), 'utf8');
  const desktopList = desktop.slice(desktop.indexOf('const missingFields = ['), desktop.indexOf('].filter(Boolean)'));
  for (const name of conditions) {
    assert.ok(desktopList.includes(name),
      `CheckoutPage's missingFields never mentions ${name}, so blocking on it shows a red line that names nothing`);
  }

  // The phone's list is allowed to leave out the payment method for one reason only: it cannot be empty,
  // because useCheckoutFlow defaults it. If that default ever goes, the exemption goes with it.
  const mobile = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'mobile', 'MobileCheckoutPage.jsx'), 'utf8');
  const mobileList = mobile.slice(mobile.indexOf('const checkoutRequirements = ['), mobile.indexOf('];', mobile.indexOf('const checkoutRequirements = [')));
  assert.match(hook, /useState\(savedDraft\.selectedPaymentMethod \|\| MANUAL_TRANSFER_PAYMENT\.id\)/,
    'the payment method is defaulted; the phone list leaves it out on exactly that basis');
  for (const name of conditions) {
    if (name === 'selectedPaymentMethod') continue;
    assert.ok(mobileList.includes(name),
      `MobileCheckoutPage's checkoutRequirements never mentions ${name}, so the phone blocks on something it never names`);
  }
}

// The same honesty, one screen later. The payment panel flips to "blocked" on a timer, and a timer that
// is shorter than a real load tells the buyer the shop is broken while it is working. Measured on a real
// checkout: DOKU's page took about 20 seconds to appear, against a 12-second timer — so the shop called
// it blocked eight seconds before it opened.
//
// A genuinely blocked iframe never fires onLoad at all, so this timer only has to outlast a slow load.
// There is no reason for it to be tight, and every second it is too short is a buyer being told a lie.
{
  const page = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'PaymentPage.jsx'),
    'utf8',
  );
  const frame = page.slice(page.indexOf('const PaymentFrame'), page.indexOf('const statusCopy'));
  const timer = frame.match(/setFrameStatus\(\(current\) => \(current === 'loading' \? 'failed'[\s\S]{0,80}?\}, (\d+)\)/);
  assert.ok(timer, 'PaymentFrame still gives up on the payment panel after a timeout');
  assert.ok(Number(timer[1]) >= 25000,
    `PaymentFrame calls the payment panel blocked after ${Number(timer[1]) / 1000}s. DOKU was measured at `
    + 'about 20s on a real checkout, so anything under 25s tells a buyer the shop is broken while it is '
    + 'still loading. A blocked iframe never fires onLoad, so waiting longer costs nothing.');
}

console.log('checkoutFailureHonesty selfcheck OK (a placed order is never reported as unsaved)');
