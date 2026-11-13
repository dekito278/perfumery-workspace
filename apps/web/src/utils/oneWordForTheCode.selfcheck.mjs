// `node src/utils/oneWordForTheCode.selfcheck.mjs`
//
// Tenth visitor audit, 13 Nov 2026, on the invoice page: the heading asked for the "kode customer" while
// the field, its errors and every other page said "kode pelanggan" — two names for one code on one screen,
// after #626 had chosen the second. And a lookup that failed on the network told the buyer, in a toast,
// that her code was fine, while the line under the field said nothing matched it.
//
// Also: the English help page promised "We message you on WhatsApp as soon as the parcel leaves", while the
// order form an English buyer fills in asks for an email and a phone for customs, never for WhatsApp.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const mixed = Object.entries(MESSAGES.id).filter(([, text]) => /kode customer/i.test(String(text))).map(([key]) => key);
assert.deepEqual(mixed, [], `the Indonesian shop calls the code "kode customer" here — it is "kode pelanggan" everywhere else:\n  ${mixed.join('\n  ')}`);

const page = readFileSync(join(root, 'pages', 'CustomerInvoicePage.jsx'), 'utf8');
const failure = page.slice(page.indexOf("console.warn('Invoice lookup failed:'"), page.indexOf("toast.error(t('inv.codeLookupFailed'));"));
assert.match(failure, /setSearched\(false\);/, 'a failed lookup still shows "not found" under the field while the toast says the code is fine');

assert.doesNotMatch(MESSAGES.en['help.track'], /WhatsApp/i,
  'the English help page promises a WhatsApp message the English order form never asks a number for');

console.log('oneWordForTheCode selfcheck OK (one name for the customer code; a failed lookup is not "not found"; no WhatsApp promise to an email buyer)');
