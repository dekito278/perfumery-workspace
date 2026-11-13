// `node src/utils/typedCodeIsNotDropped.selfcheck.mjs`
//
// Ninth visitor audit, 13 Nov 2026: a buyer types a voucher code, does not press "Pakai", and presses
// "Buat Pesanan". The order went through at full price — the checkout sends only the APPLIED voucher —
// and nothing on the page said the code had been ignored. The buyer finds out on the payment page, or
// not at all.
//
// The rule: an order is not placed while the code field holds a code that is not the one taking money off.
// The page says so beside the field and takes the buyer there; applying the code or clearing the field
// lets the order through.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The hook knows which typed code is not applied ---------------------------------------------------
const hook = read('hooks', 'useAppliedVoucher.js');
assert.match(hook, /const typedCode = normalizeVoucherCode\(inputCode\);/);
assert.match(hook, /const unappliedCode = typedCode && typedCode !== \(result\.valid \? voucherCode : ''\) \? typedCode : '';/,
  'a code counts as applied only while it is the valid, applied one');
assert.match(hook, /return \{[\s\S]*?\bunappliedCode,/, 'the hook does not hand the unapplied code to the pages');

// The same rule, run: typed-and-applied passes; typed-only, a different code, or an applied code that
// stopped qualifying, do not; an empty field always passes.
const normalize = (value) => String(value || '').trim().toUpperCase();
const unapplied = (inputCode, voucherCode, valid) => {
  const typedCode = normalize(inputCode);
  return typedCode && typedCode !== (valid ? voucherCode : '') ? typedCode : '';
};
assert.equal(unapplied('halo10', 'HALO10', true), '');
assert.equal(unapplied('HALO10', '', false), 'HALO10');
assert.equal(unapplied('LAIN', 'HALO10', true), 'LAIN');
assert.equal(unapplied('HALO10', 'HALO10', false), 'HALO10');
assert.equal(unapplied('   ', '', false), '');

// --- 2. The checkout refuses, says why beside the field, and points there --------------------------------
const checkout = read('pages', 'CheckoutPage.jsx');
assert.match(checkout, /if \(!canSubmitCheckout \|\| voucher\.unappliedCode\) \{/, 'the checkout places an order over a typed, unapplied code');
assert.match(checkout, /id="checkout-voucher"[\s\S]{0,900}aria-invalid=\{triedSubmit && voucher\.unappliedCode && !voucher\.loading \? 'true' : undefined\}/,
  'the code field is not marked, so the focus step cannot take the buyer to it');
assert.match(checkout, /role="alert">\{t\('checkout\.errVoucherUnapplied', \{ code: voucher\.unappliedCode \}\)\}/,
  'nothing beside the field says the code has not been applied');

// --- 3. The bespoke order, the other page with a code field, refuses the same way -------------------------
const bespoke = read('pages', 'BespokePage.jsx');
assert.match(bespoke, /if \(voucher\.unappliedCode && !voucher\.loading\) return t\('checkout\.errVoucherUnapplied', \{ code: voucher\.unappliedCode \}\);/);

for (const language of ['id', 'en']) {
  const text = MESSAGES[language]['checkout.errVoucherUnapplied'];
  assert.ok(text && text.includes('{code}'), `${language}.checkout.errVoucherUnapplied must name the code`);
}

console.log('typedCodeIsNotDropped selfcheck OK (a typed code is applied or cleared before an order is placed)');
