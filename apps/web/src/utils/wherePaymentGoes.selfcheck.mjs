// `node src/utils/wherePaymentGoes.selfcheck.mjs`
//
// The account a buyer sends money to, and the name of the bank it sits in.
//
// BTPN was renamed PT Bank SMBC Indonesia Tbk. The old name sat in the international transfer block —
// the one an overseas buyer copies into a wire form — and a wire naming a bank that no longer has that
// name is a transfer that gets queried or returned. That is the stall this shop has been losing orders
// to, written into a constant.
//
// Measured when it was found: 0 of 35 production orders carried frozen bank details, so no buyer had
// been sent the old name through an order record. The next export order would have frozen it in.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const cart = read('services', 'cartService.js');

// --- 1. No retired bank name, anywhere a buyer can read ----------------------------------------------
// Asserted across the whole source tree rather than on one constant: the name was also typed into
// WhatsApp drafts and order notes in the past, and a rename has to reach every copy.
const RETIRED = [/\bBTPN\b/];
for (const file of ['services/cartService.js', 'pages/ExportShippingCalculatorPage.jsx', 'pages/PaymentPage.jsx']) {
  const source = read(...file.split('/'));
  // The comment explaining the rename is allowed to name the old bank; nothing else is.
  const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const pattern of RETIRED) {
    assert.ok(!pattern.test(code),
      `${file} still names the retired bank (${pattern}). It was renamed PT Bank SMBC Indonesia Tbk, and `
      + 'a wire form naming the old one is a transfer that gets queried');
  }
}
assert.match(cart, /PT Bank SMBC Indonesia Tbk \(Jenius\)/, 'the current name is the fallback');

// --- 2. One set of variables, not two -----------------------------------------------------------------
// /pay/<token> reads VITE_PAY_*. The cart's two payment blocks now read the SAME names, so setting them
// once in Vercel fills both — two sets would mean half the shop updated after a bank change.
const details = read('data', 'paymentDetails.js');
for (const name of ['VITE_PAY_BANK_NAME', 'VITE_PAY_BANK_ACCOUNT', 'VITE_PAY_BANK_HOLDER',
  'VITE_PAY_WIRE_BANK', 'VITE_PAY_WIRE_BIC', 'VITE_PAY_WIRE_ACCOUNT', 'VITE_PAY_WIRE_ADDRESS']) {
  assert.ok(details.includes(name), `${name} is read by the payment page`);
  assert.ok(cart.includes(name), `${name} is read by the cart too — one set of variables, not two`);
}

// --- 3. The environment wins, and §0 is finally met ---------------------------------------------------
// Settled 2026-10-23: all eight VITE_PAY_* variables are set in Production, so the sensitive literals
// came out of the source. What the brief names — "nomor rekening, kontak" — now exists in Vercel and
// nowhere in this repository.
assert.match(cart, /const payEnv = \(name, fallback = ''\) =>/,
  'an unset variable must read as empty rather than undefined');
for (const field of ['bankName', 'accountNumber', 'accountName', 'swift']) {
  assert.match(cart, new RegExp(`${field}: payEnv\\('VITE_PAY_`),
    `${field} comes from the environment first`);
}

// NO FALLBACK FOR THE THINGS §0 NAMES. A second argument here would put the value back in the repo,
// which is the whole thing the brief was written against.
for (const sensitive of ['VITE_PAY_BANK_ACCOUNT', 'VITE_PAY_WIRE_ACCOUNT', 'VITE_PAY_BANK_HOLDER']) {
  assert.match(cart, new RegExp(`payEnv\\('${sensitive}'\\)`),
    `${sensitive} must be read with no fallback — §0 keeps it out of the source`);
  assert.doesNotMatch(cart, new RegExp(`payEnv\\('${sensitive}',`),
    `${sensitive} has a fallback again, so the value is back in the repository`);
}

// AND NOT ANYWHERE ELSE EITHER. Scoping this to the two payment files was too narrow, which the first
// repo-wide sweep proved within the hour: the real BCA number was still sitting in a COMMENT in
// closedOrderPayment.selfcheck, quoting what a broken payment page printed in September. A number in a
// comment is a number in the repository — the one thing §0 asks not to happen, and precisely the case
// this rule's own sabotage test plants on purpose.
//
// A standalone run of ten or eleven digits is the shape of an Indonesian bank account. Measured across
// src, api and tools on 2026-10-23 there were four; three were these, and the fourth was the leak.
const NOT_AN_ACCOUNT = {
  4294967296: '2^32, a numeric bound',
  '08120000000': 'a placeholder phone number — every digit after the prefix is zero',
  '0123456789': 'a placeholder, digits in order',
};
const scan = (dir) => {
  let found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { found = found.concat(scan(full)); continue; }
    if (!/\.(jsx?|mjs)$/.test(entry.name)) continue;
    for (const m of readFileSync(full, 'utf8').matchAll(/(?<![0-9A-Za-z_-])(\d{10,11})(?![0-9])/g)) {
      if (!NOT_AN_ACCOUNT[m[1]]) found.push(`${entry.name}: ${m[1]}`);
    }
  }
  return found;
};
const looksLikeAnAccount = [src, join(src, '..', 'api'), join(src, '..', 'tools')]
  .filter((dir) => existsSync(dir))
  .flatMap(scan);
assert.deepEqual(looksLikeAnAccount, [],
  'these carry what looks like a bank account number, in code or in a comment:\n  '
  + `${looksLikeAnAccount.join('\n  ')}\n`
  + 'If a number is genuinely not an account, add it to NOT_AN_ACCOUNT with the reason it is not.');

// WHAT STAYED is published by the banks themselves and is not what §0 is about. Keeping these means a
// preview deploy still renders a recognisable block instead of a row of blanks that reads as a bug.
for (const [name, fallback] of [['VITE_PAY_BANK_NAME', 'BCA'], ['VITE_PAY_WIRE_BIC', 'SUNIIDJA']]) {
  assert.match(cart, new RegExp(`payEnv\\('${name}', '`),
    `${name} keeps its published fallback (${fallback})`);
}

// --- 4. The bank address, which a wire form asks for and this block never had -------------------------
assert.match(cart, /bankAddress: payEnv\('VITE_PAY_WIRE_ADDRESS', ''\)/,
  'no fallback for the address: one invented here would be worse than none');
const tool = read('pages', 'ExportShippingCalculatorPage.jsx');
assert.match(tool, /bankAddress: INTERNATIONAL_TRANSFER_PAYMENT\.bankAddress/,
  'and it is frozen onto the order with the rest, so an order written today does not depend on the '
  + 'constant still saying the same thing in March');

console.log('wherePaymentGoes: ok (no retired bank name, one set of VITE_PAY_* across the cart and '
  + '/pay, environment first with a recorded fallback, bank address carried)');
