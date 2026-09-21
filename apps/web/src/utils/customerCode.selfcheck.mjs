// `node src/utils/customerCode.selfcheck.mjs`
//
// A real buyer, 2026-09-21, at the last step of checkout. She typed her customer code as SOLIO932 — the
// letter O where a zero belongs, and four characters instead of five. Postgres refused the row, and the
// page printed the raw constraint error back at her, with her own name, phone number and full address in
// it. The order was never created.
//
// Two rules come out of that, and they are different rules:
//   1. The code is optional, so an unrecognised one must cost her nothing. It becomes null.
//   2. Whatever the database says when it refuses, a BUYER never reads it.
//
// And the shape lives in ONE place, because the browser already dropped bad codes while /api/orders/create
// passed them straight through. Two callers, two opinions, one of them wrong.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CUSTOMER_CODE_PATTERN, asCustomerCode, normalizeCustomerCode } from './customerCode.js';
import { isInternalErrorMessage } from './publicErrorMessage.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));
const readRepo = (...parts) => stripComments(readFileSync(join(root, '..', ...parts), 'utf8'));

// --- 1. The shape is the DATABASE's shape, read from the migration ---------------------------------------
const migrations = join(root, '..', '..', '..', 'supabase', 'migrations');
const defining = readdirSync(migrations)
  .filter((name) => name.endsWith('.sql'))
  .filter((name) => readFileSync(join(migrations, name), 'utf8').includes('storefront_customers_code_format'))
  .sort();
assert.ok(defining.length, 'the code-format constraint must still be defined by a migration');
const constraint = readFileSync(join(migrations, defining[defining.length - 1]), 'utf8')
  .match(/storefront_customers_code_format check \(customer_code ~ '([^']+)'\)/);
assert.ok(constraint, 'the constraint must still be a regex check on customer_code');
assert.equal(CUSTOMER_CODE_PATTERN.source, constraint[1],
  `the app accepts ${CUSTOMER_CODE_PATTERN.source} while the database demands ${constraint[1]} — `
  + 'the gap between those two is exactly what killed a checkout');

// --- 2. What it does with what people actually type -------------------------------------------------------
assert.equal(asCustomerCode('SOLIO932'), null, 'the code from the failed checkout: letter O, four characters');
assert.equal(asCustomerCode('SOLI0932'), null, 'four digits is not five');
assert.equal(asCustomerCode('SOLI093232'), null, 'six is not five either');
assert.equal(asCustomerCode(' soli12345 '), 'SOLI12345', 'spaces and lower case are a typing accident, not a different code');
assert.equal(asCustomerCode(''), null);
assert.equal(asCustomerCode(null), null);
assert.equal(asCustomerCode(undefined), null);
assert.equal(asCustomerCode({}), null, 'never throws: an unusable code must not cost an order');
assert.equal(normalizeCustomerCode(' soli12345 '), 'SOLI12345');

// --- 3. BOTH paths to the upsert sanitise, because they disagreed ----------------------------------------
const service = read('services', 'customerService.js');
assert.match(service, /p_customer_code: asCustomerCode\(customerCode\)/, 'the browser path');
const api = readRepo('api', 'orders', 'create.js');
assert.match(api, /p_customer_code: asCustomerCode\(input\.customer\?\.code\)/,
  'and the API path, which passed whatever was typed straight to Postgres');
assert.doesNotMatch(api, /p_customer_code: input\.customer\?\.code/, 'the unguarded version must not come back');

// --- 4. A buyer never reads the machinery -----------------------------------------------------------------
assert.equal(isInternalErrorMessage(
  'Supabase rpc storefront_upsert_customer failed: {"code":"23514","details":"Failing row contains (0c9b70e7, SOLIO932, Mutiara Hapsari, +6281252219319, Green Pramuka APT ...)"}'
), true, 'the exact dump she was shown must be classed as machinery');
// And the same verdict on a SHORT one: the dump above is also over the length limit, so it would still
// be caught with every marker removed. This one is only machinery because of what it says.
assert.equal(isInternalErrorMessage('violates check constraint storefront_customers_code_format'), true,
  'a short constraint message is machinery too — the length rule must not be the only thing holding');
assert.equal(isInternalErrorMessage('Voucher tidak bisa digunakan'), false, 'a curated sentence still reaches her');
assert.match(api, /isInternalErrorMessage\(error\?\.message\)/,
  'the endpoint must not answer a buyer with a Postgres message');
assert.match(read('hooks', 'useCheckoutFlow.js'), /toast\.error\(publicErrorMessage\(error, 'Gagal menyimpan pesanan'\)\)/,
  'and the checkout must not print one either — this catch also sees errors that never reached the endpoint');

// --- 5. And she is told her code was not used -------------------------------------------------------------
for (const file of [['pages', 'CheckoutPage.jsx'], ['pages', 'mobile', 'MobileCheckoutPage.jsx']]) {
  assert.match(read(...file), /!asCustomerCode\(customerCode\)[\s\S]{0,160}t\('checkout\.codeUnknown'\)/,
    `${file.join('/')}: a code that will be dropped must say so before the order is placed, not silently`);
}
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['checkout.codeUnknown'], /SOLI/,
    `${language}.checkout.codeUnknown must show the shape that works`);
}

console.log('customerCode selfcheck OK (a mistyped code costs no order, and no buyer reads a constraint)');
