// `node src/utils/paymentTracksTheOrder.selfcheck.mjs`
//
// Sixth visitor audit, 13 Nov 2026: "Lacak pesanan" on the payment page went to /customer — the account
// page, where a guest met a Google sign-in. It goes to /track-order/<order number>, which looks the order
// up by itself; with no number, to the empty tracking page.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../pages/PaymentPage.jsx', import.meta.url), 'utf8');
assert.match(page, /const trackingPathFor = \(orderNumber\) => \(orderNumber \? `\/track-order\/\$\{encodeURIComponent\(orderNumber\)\}` : '\/track-order'\);/);
assert.doesNotMatch(page, /orderTrackingPath = `\/customer/, 'no tracking link leads to the account page');
assert.doesNotMatch(page, /to=\{`\/customer\?code=\$\{customerCode\}`\}/, 'nor the success panel');
assert.doesNotMatch(page, /<Link to="\/customer"[^>]*>\s*\{t\('track\.title'\)\}/, 'nor the "order not found" panel');
assert.equal((page.match(/const orderTrackingPath = trackingPathFor\(/g) || []).length, 2, 'both payment views');

const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
assert.match(app, /<Route path="\/track-order\/:code" element=\{<PublicTrackingPage \/>\} \/>/, 'the address it links to exists');

console.log('paymentTracksTheOrder selfcheck OK (tracking from the payment page opens the order, not a sign-in)');
