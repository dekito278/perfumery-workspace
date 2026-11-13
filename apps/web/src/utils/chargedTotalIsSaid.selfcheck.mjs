// `node src/utils/chargedTotalIsSaid.selfcheck.mjs`
//
// Ninth visitor audit, 13 Nov 2026. The order endpoint prices the cart itself and the payment page asks
// for ITS total — correctly. But the breakdown under that total (shipping fee, voucher) was this browser's
// own, remembered at checkout, and the total itself changed without a word whenever the server's figure
// differed from the one on the checkout page (a courier rate that moved between quote and submit). The
// buyer saw lines that did not add up to the amount asked for, and a number unlike the one they agreed to.
//
// The rule: the payment page's breakdown comes from the figures the server charged, and a total that moved
// is said before the buyer is asked to pay it. The order is NOT refused over a difference — a refused
// checkout over a few hundred rupiah of courier rate costs more than it protects.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. The endpoint answers with what it charged, and the client keeps it -------------------------------
const endpoint = read('..', 'api', 'orders', 'create.js');
assert.match(endpoint, /jsonResponse\(res, 200, \{ order, itemsSubtotal, shippingFee, voucherDiscount, subtotal \}\)/,
  'the order endpoint no longer returns the figures it charged');
const service = read('services', 'orderService.js');
assert.match(service, /\['itemsSubtotal', 'shippingFee', 'voucherDiscount', 'subtotal'\]/);
assert.match(service, /return \{ \.\.\.normalizeOrder\(data\.order\), serverTotals \};/, 'the charged figures are dropped on the way to the page');

// --- 2. The payment session is written from them ---------------------------------------------------------
const flow = read('hooks', 'useCheckoutFlow.js');
assert.match(flow, /const charged = order\.serverTotals \|\| \{\};/);
const start = flow.indexOf('const charged = order.serverTotals');
const rest = flow.slice(start, flow.indexOf('\n  };\n', start));
const sessions = rest.match(/rememberPaymentSession\(\{[\s\S]*?\n\s*\}\);/g) || [];
assert.ok(sessions.length >= 3, `found ${sessions.length} payment sessions after the order is created — the scan is broken`);
for (const session of sessions) {
  assert.match(session, /shippingFee: chargedShippingFee,/, 'a payment session shows the checkout page\'s shipping fee under the server\'s total');
  assert.match(session, /voucherDiscount: chargedDiscount,/, 'a payment session shows the checkout page\'s discount under the server\'s total');
  assert.match(session, /amount: paymentAmount,/, 'the amount asked for must be the charged one');
}

// --- 3. A total that moved is said, and the order still goes through -------------------------------------
assert.match(flow, /if \(paymentAmount !== checkoutTotalDue\) \{\s*toast\.warning\(`Total pesanan disesuaikan menjadi \$\{formatRupiahPlain\(paymentAmount\)\}/,
  'a total that changed between the checkout page and the order is not said');
assert.ok(!/paymentAmount !== checkoutTotalDue\)[^{]*\{[^}]*throw/.test(flow), 'a moved total must be said, not refused');

// --- 4. The bespoke order follows the same rule (tenth visitor audit, 13 Nov 2026) ------------------------
const bespoke = read('pages', 'BespokePage.jsx');
assert.match(bespoke, /const charged = order\.serverTotals \|\| \{\};/, 'the bespoke order drops the charged figures');
assert.match(bespoke, /if \(paymentAmount !== checkoutTotalDue\) \{\s*toast\.warning\(t\('bsp\.totalMoved'/, 'a moved bespoke total is not said');
const bespokeSessions = bespoke.slice(bespoke.indexOf('const charged = order.serverTotals')).match(/sessionStorage\.setItem\(PAYMENT_SESSION_KEY, JSON\.stringify\(\{[\s\S]*?\}\)\);/g) || [];
assert.ok(bespokeSessions.length >= 2, `found ${bespokeSessions.length} bespoke payment sessions — the scan is broken`);
for (const session of bespokeSessions) {
  assert.match(session, /shippingFee: chargedShippingFee,/, 'a bespoke payment session shows the page\'s shipping fee under the server\'s total');
  assert.match(session, /voucherDiscount: chargedDiscount,/, 'a bespoke payment session shows the page\'s discount under the server\'s total');
}

console.log(`chargedTotalIsSaid selfcheck OK (${sessions.length} payment sessions carry the server's breakdown; a moved total is announced)`);
