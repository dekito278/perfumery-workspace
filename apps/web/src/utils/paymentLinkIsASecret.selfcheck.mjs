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
import { readFileSync } from 'node:fs';
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
const service = read('src', 'services', 'paymentLinkService.js');
assert.match(service, /if \(!isPaymentToken\(token\)\) return null;/,
  'the lookup checks the shape first, so a URL full of punctuation never reaches the database');

// --- 2. No account number in the repository ----------------------------------------------------------
// Asserted as a SHAPE, because naming the real numbers here would commit them. A run of six or more
// digits in either file is either an account number or something that reads like one.
for (const file of [
  ['src', 'data', 'paymentDetails.js'],
  ['src', 'pages', 'PaymentInstructionsPage.jsx'],
]) {
  const source = read(...file);
  const runs = (source.replace(/VITE_PAY_[A-Z_]+/g, '').match(/\d{6,}/g) || []);
  assert.deepEqual(runs, [],
    `${file.join('/')} contains ${runs.join(', ')} — an account number belongs in the environment, not `
    + 'in a file that ships in every clone');
}
const details = read('src', 'data', 'paymentDetails.js');
assert.match(details, /import\.meta\.env/, 'the details come from the environment');
for (const name of ['VITE_PAY_BANK_ACCOUNT', 'VITE_PAY_WIRE_ACCOUNT', 'VITE_PAY_BANK_HOLDER']) {
  assert.ok(details.includes(name), `${name} is read, so Vercel has somewhere to put it`);
}
// Unset is a state, not a blank line: a half-filled bank block loses a buyer's transfer.
for (const guard of ['bankIsConfigured', 'wireIsConfigured', 'cashIsConfigured']) {
  assert.ok(details.includes(`export const ${guard}`), `${guard} decides all-or-nothing per block`);
}
const page = read('src', 'pages', 'PaymentInstructionsPage.jsx');
for (const guard of ['bankIsConfigured()', 'wireIsConfigured()', 'cashIsConfigured()']) {
  assert.ok(page.includes(guard), `the page asks ${guard} before printing a block`);
}
assert.match(page, /pay\.link\.notConfigured/, 'and says what happens instead when it is unset');

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

// --- 4. One answer for every failure -----------------------------------------------------------------
// A wrong token, a deleted order and a paid one are indistinguishable from outside. The page has exactly
// one message for all of them, and the function hands back nothing rather than a reason.
assert.equal((page.match(/pay\.link\.notFound/g) || []).length, 1,
  'there is one not-available message, not one per cause');
assert.match(service, /return null;/, 'and the service answers with nothing, never with a reason');
assert.ok(!/alreadyPaid|sudahDibayar|expiredLink/.test(page),
  'no message distinguishes a paid order from a wrong token');

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

console.log(`paymentLinkIsASecret: ok (${PAYMENT_TOKEN_LENGTH * 5}-bit token, no account number in the `
  + 'repo, noindex in three trees, one answer for every failure, no person in the function)');
