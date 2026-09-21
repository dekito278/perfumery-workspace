// `node src/utils/paymentDeadline.selfcheck.mjs`
//
// A manual-transfer buyer is told to transfer to a bank account. They are not told that the order is
// cancelled 24 hours later and the stock given back — api/orders/expire-reservations.js does exactly
// that, on a schedule, and the payment page's deadline line only ever read payment_expires_at, which
// DOKU sets and manual transfer does not.
//
// The rule is not "show a deadline". It is: the deadline SHOWN is the deadline ENFORCED. A date on the
// screen that the cron does not act on frightens people for nothing; a cron that acts on a date nobody
// was shown costs them a transfer into a cancelled order.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { paymentDeadlineAt } from './paymentDeadline.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));
const readRepo = (...parts) => stripComments(readFileSync(join(root, '..', ...parts), 'utf8'));

const TTL = 24;
const HOUR = 60 * 60 * 1000;
const created = '2026-09-20T10:00:00.000Z';
const reserved = { paymentStatus: 'pending', inventoryDeducted: true, createdAt: created, paymentProofStatus: 'missing' };

// --- 1. The manual-transfer case, which had no deadline at all -------------------------------------------
assert.equal(paymentDeadlineAt(reserved, TTL), new Date(new Date(created).getTime() + TTL * HOUR).toISOString(),
  'a reserved, unpaid order expires at created_at + the TTL — the buyer must see that date');

// --- 2. Every case where the cron does NOT act, the page must promise nothing -----------------------------
assert.equal(paymentDeadlineAt({ ...reserved, paymentProofStatus: 'submitted' }, TTL), '',
  'proof submitted and waiting for review: the cron never touches this order');
assert.equal(paymentDeadlineAt({ ...reserved, paymentStatus: 'paid' }, TTL), '', 'a paid order has no deadline');
assert.equal(paymentDeadlineAt({ ...reserved, status: 'cancelled' }, TTL), '', 'a cancelled one neither');
assert.equal(paymentDeadlineAt({ ...reserved, inventoryDeducted: false }, TTL), '',
  'no stock reserved and no explicit window: the cron leaves it alone on purpose — a bespoke request still being discussed must not be cancelled by a clock');
assert.equal(paymentDeadlineAt({ ...reserved, createdAt: '' }, TTL), '', 'no created_at, nothing to count from');
assert.equal(paymentDeadlineAt(reserved, 0), '', 'no TTL, nothing to promise');
assert.equal(paymentDeadlineAt(null, TTL), '');

// --- 3. An explicit window always wins, deducted or not ---------------------------------------------------
const explicit = '2026-09-20T12:00:00.000Z';
assert.equal(paymentDeadlineAt({ ...reserved, paymentExpiresAt: explicit }, TTL), explicit, 'DOKU sets its own');
assert.equal(paymentDeadlineAt({ ...reserved, inventoryDeducted: false, paymentExpiresAt: explicit }, TTL), explicit,
  'and a stockless order with an explicit window does expire — the cron says so');
assert.equal(paymentDeadlineAt({ ...reserved, paymentExpiresAt: 'not a date' }, TTL), '', 'an unreadable date promises nothing');

// --- 4. Shown = enforced: the same conditions, read out of the cron itself --------------------------------
const cron = readRepo('api', 'orders', 'expire-reservations.js');
assert.match(cron, /const ACTIVE_PAYMENT_STATUSES = \['unpaid', 'pending'\]/, 'the cron still acts on these two statuses');
assert.match(cron, /\['missing', 'rejected'\]\.includes\(order\.payment_proof_status\)/, 'and still stops once proof is in');
assert.match(cron, /order\.inventory_deducted\s*\?\s*getReservationExpiryDate\(order\)/, 'and still treats non-deducted orders differently');
const client = read('utils', 'paymentDeadline.js');
assert.match(client, /\['unpaid', 'pending'\]/, 'the page reads the same two statuses');
assert.match(client, /\['missing', 'rejected'\]/, 'the same proof rule');
assert.match(client, /if \(!session\.inventoryDeducted\) return '';/, 'and the same silence for orders the cron ignores');

// --- 4b. The anon lookup must actually RETURN what the rule reads ----------------------------------------
// The buyer on this page is anonymous: the session comes from storefront_payment_session_lookup, which
// builds a fixed jsonb object. A field left out of that object is not null-by-accident, it does not exist
// — so the rule reads undefined and the page stays silent for exactly the audience it was written for.
// Third time in this repo that a frozen column list has quietly emptied a feature (the public products
// view, the English copy columns), so it is a check now rather than a lesson.
const migrations = readdirSync(join(root, '..', '..', '..', 'supabase', 'migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const defining = migrations.filter((name) => readFileSync(join(root, '..', '..', '..', 'supabase', 'migrations', name), 'utf8')
  .includes('create or replace function public.storefront_payment_session_lookup'));
assert.ok(defining.length, 'the anon payment-session lookup must still be defined by a migration');
const latest = readFileSync(join(root, '..', '..', '..', 'supabase', 'migrations', defining[defining.length - 1]), 'utf8');
const returned = new Set([...latest.matchAll(/'([a-z_]+)',\s*o\.[a-z_]+/g)].map((m) => m[1]));
const snake = (name) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const fieldsRead = [...new Set([...client.matchAll(/session\.([a-zA-Z]+)/g)].map((m) => m[1]))];
assert.ok(fieldsRead.length >= 5, 'expected the rule to read several fields off the session');
for (const field of fieldsRead) {
  assert.ok(returned.has(snake(field)),
    `${defining[defining.length - 1]} does not return ${snake(field)}, so the page cannot know it — `
    + 'the deadline would silently never appear for an anonymous buyer');
}

// --- 5. The page says it, in both languages, and says what happens next ----------------------------------
const page = read('pages', 'PaymentPage.jsx');
assert.match(page, /paymentDeadlineAt\(session, PAYMENT_RESERVATION_TTL_HOURS\)/,
  'the page computes the deadline from the enforced rule, not from payment_expires_at alone');
assert.match(page, /t\('pay\.deadline', \{ time: expiresAtLabel \}\)/, 'and reads its label from the message file');
assert.match(page, /t\('pay\.deadlineNote'\)/, 'and says what happens when it lapses');
assert.match(page, /inventoryDeducted: Boolean\(order\.inventoryDeducted\)/,
  'both session builders must carry the field the rule turns on');
assert.equal((page.match(/inventoryDeducted: Boolean\(order\.inventoryDeducted\)/g) || []).length, 2,
  'manual transfer AND doku — the manual one is the path that had no deadline');
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['pay.deadline'], /\{time\}/, `${language}.pay.deadline must carry the time`);
  assert.match(MESSAGES[language]['pay.deadlineNote'], /[A-Za-z]{4}/, `${language}.pay.deadlineNote must say something`);
}

console.log('paymentDeadline selfcheck OK (the deadline shown is the one the cron enforces)');
