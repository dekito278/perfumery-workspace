// `node src/utils/paymentLinkIsASecret.selfcheck.mjs`
//
// /pay/<token> shows what is owed on ONE order to anyone holding the link. Three things therefore have
// to be true at once, and none of them is visible by reading the page:
//
//   1. The token is the only address. The order NUMBER cannot be it — DKT-MPGB5BF0 is printed on every
//      invoice and quoted in every WhatsApp thread.
//   2. No account number lives in the repository. Dekito's brief, §0: sensitive data goes in the
//      environment. A number committed here is in every clone and every screenshot of a diff.
//   3. The page is not an oracle. A wrong token, a missing order and an order already paid all get the
//      same answer, because telling them apart tells a guesser when they are close.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PAYMENT_TOKEN_LENGTH, PAYMENT_TOKEN_MIN_BITS, createPaymentToken, isPaymentToken, tokenCharsFor,
} from './paymentLinkToken.js';

const src = dirname(fileURLToPath(import.meta.url));
const web = join(src, '..', '..');
const read = (...parts) => readFileSync(join(web, ...parts), 'utf8');

// --- 1. The token carries more than the brief asks for -----------------------------------------------
assert.ok(PAYMENT_TOKEN_LENGTH * 5 >= PAYMENT_TOKEN_MIN_BITS,
  `${PAYMENT_TOKEN_LENGTH} base32 characters carry ${PAYMENT_TOKEN_LENGTH * 5} bits; the brief asks for `
  + `at least ${PAYMENT_TOKEN_MIN_BITS}`);
assert.equal(tokenCharsFor(128), 26, '128 bits needs 26 characters in a 32-symbol alphabet');
assert.equal(PAYMENT_TOKEN_LENGTH, 32, 'and we mint 32, which is 160 bits');

// Run it with a known byte sequence: the mapping is asserted, not the distribution.
const token = createPaymentToken((length) => Uint8Array.from({ length }, (_, index) => (index * 7) % 256));
assert.equal(token.length, PAYMENT_TOKEN_LENGTH);
assert.ok(isPaymentToken(token), 'what the generator makes, the validator accepts');
// Every byte value must land somewhere — a modulo that skipped symbols would shrink the keyspace.
const everyByte = createPaymentToken((length) => Uint8Array.from({ length }, (_, index) => index));
assert.equal(new Set(everyByte).size, 32, 'all 32 symbols are reachable, so the 160 bits are real');
// No letters that get misread off a screenshot or over the phone.
for (const confusable of ['I', 'L', 'O', 'U']) {
  assert.ok(!everyByte.includes(confusable), `${confusable} is not in the alphabet`);
}
// Math.random is never acceptable here, so there is no default source at all.
assert.throws(() => createPaymentToken(), /random source/, 'the generator refuses to invent randomness');
assert.throws(() => createPaymentToken(null), /random source/);
// The validator is the gate before any lookup.
for (const junk of ['', 'ABC', null, undefined, 42, `${token}X`, token.toLowerCase(), 'I'.repeat(32)]) {
  assert.equal(isPaymentToken(junk), false, `${JSON.stringify(junk)} is not a token`);
}
// --- 2. The page is retired, and holds nothing ---------------------------------------------------------
// 15 Nov 2026 (Dekito: the payment-link page is no longer used — buyers abroad pay on WhatsApp). /pay/<token>
// is a notice now: no lookup, no account, no upload. What it must never do again is look an order up from
// a link or print an account, so that is asserted on the page as it stands.
const page = read('src', 'pages', 'PaymentInstructionsPage.jsx');
assert.doesNotMatch(page, /useParams|storefront_payment_link|findOrderByPaymentToken|supabase/,
  'the retired page looks nothing up');
assert.doesNotMatch(page, /VITE_PAY_|accountNumber|uploadPaymentProof|paypal/i, 'and prints no account and takes no file');
assert.match(page, /t\('pay\.link\.retiredTitle'\)/, 'it says the link is no longer in use');
assert.match(page, /<AskAtelierButton/, 'and offers the chat the payment moved to');
assert.ok(!existsSync(join(web, 'src', 'services', 'paymentLinkService.js')), 'the lookup service is gone');
assert.ok(!existsSync(join(web, 'src', 'data', 'paymentDetails.js')), 'and so are the page\'s payment details');
const templates = read('src', 'services', 'notificationTemplateService.js');
assert.doesNotMatch(templates, /\/pay\/\$\{/, 'no Studio message hands the retired link out');

// --- 3. Not indexed, not linked ----------------------------------------------------------------------
assert.match(page, /<meta name="robots" content="noindex,nofollow" \/>/,
  'the page tells a crawler not to index it');
const robots = read('public', 'robots.txt');
for (const path of ['Disallow: /pay/', 'Disallow: /en/pay/']) {
  assert.ok(robots.includes(path), `robots.txt must carry "${path}" — one tree covered is not enough`);
}
// /mobile/ is disallowed wholesale, so the phone tree needs no line of its own; asserted so that
// blanket is not removed without someone noticing this depended on it.
assert.ok(robots.includes('Disallow: /mobile/'), 'the phone tree stays closed by its blanket rule');
const app = read('src', 'App.jsx');
assert.match(app, /<Route path="\/pay\/:token"/, 'the route exists');
const sitemapSource = read('tools', 'seo-artifacts.mjs');
assert.ok(!sitemapSource.includes("'/pay"), 'and it is not advertised in the sitemap');

// --- 5. The function returns no person ---------------------------------------------------------------
const migration = read('..', '..', 'supabase', 'migrations', '20261021120000_payment_link.sql');
const returns = migration.slice(migration.indexOf('returns table'), migration.indexOf('language sql'));
for (const forbidden of ['customer_name', 'contact', 'checkout_draft', 'customer_code', 'internal_notes']) {
  assert.ok(!returns.includes(forbidden),
    `storefront_payment_link must not return ${forbidden} — a leaked link is then worth an amount and an `
    + 'order number, not a person');
}
assert.match(returns, /order_number/, 'it does return the order number, which is on the invoice anyway');
assert.match(migration, /not in \('paid', 'settled', 'refunded'\)/,
  'and it stops answering once the money has arrived — a live link after payment invites paying twice');
assert.match(migration, /not in \('cancelled', 'canceled', 'expired'\)/, 'or once the order is off');
assert.match(migration, /char_length\(coalesce\(p_token, ''\)\) >= 26/,
  'a one-character guess costs the same as a full one');

// --- 6. The column reaches the database --------------------------------------------------------------
// toOrderDatabasePayload names its columns by hand, and a field missing from that list is written
// nowhere, silently. It has happened in that file before.
const orders = read('src', 'services', 'orderService.js');
assert.match(orders, /payment_token: order\.paymentToken \|\| null,/,
  'the hand-listed column mapper carries payment_token, or every link would 404');
const exportOrder = read('src', 'utils', 'exportOrder.js');
assert.match(exportOrder, /paymentToken: makeToken\(\)/, 'and the export order mints one');
const tool = read('src', 'pages', 'ExportShippingCalculatorPage.jsx');
assert.match(tool, /createPaymentToken\(browserRandomBytes\)/,
  'from the browser crypto source, not from Math.random');

console.log(`paymentLinkIsASecret: ok (${PAYMENT_TOKEN_LENGTH * 5}-bit token, the retired page holds nothing, noindex, no person in the function)`);
