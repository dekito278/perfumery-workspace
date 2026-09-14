// `node src/utils/voucherPerAccount.selfcheck.mjs`
//
// One-time-per-account voucher codes, for the code printed on the greeting card.
//
// The rule that makes it work, and the one worth guarding hardest: a per-account voucher REFUSES a buyer
// with no account. An anonymous buyer has no identity to count against, so letting them through would
// make the limit bypassable by not signing in — the limit would exist only for the honest.
//
// This file tests the shared rule as behaviour, and asserts structurally that the SERVER is the authority:
// the browser's advisory count can be wrong or absent without a single rupiah moving.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VOUCHER_VALIDATION_REASONS, normalizeVoucher, validateVoucher } from './voucherValidation.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));
const readRaw = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const card = { code: 'KARTU1', discountType: 'fixed', discountValue: 50000, active: true, usageLimitPerAccount: 1 };
const ask = (over = {}) => validateVoucher({ code: 'KARTU1', voucher: card, subtotal: 300000, items: [], ...over });

// --- 1. No account, no redemption ---------------------------------------------------------------------
assert.equal(ask().reason, VOUCHER_VALIDATION_REASONS.ACCOUNT_REQUIRED,
  'an anonymous buyer must be REFUSED, never allowed — otherwise the limit is bypassed by not signing in');
assert.equal(ask().valid, false);
assert.equal(ask().discountAmount, 0, 'a refused voucher discounts nothing');
assert.match(ask().message, /[Mm]asuk/, 'and the message must say what to do about it');
for (const empty of [null, undefined, '', 0, false]) {
  assert.equal(ask({ accountId: empty }).reason, VOUCHER_VALIDATION_REASONS.ACCOUNT_REQUIRED,
    `${JSON.stringify(empty)} is not an account`);
}

// --- 2. Signed in, within the limit -------------------------------------------------------------------
assert.equal(ask({ accountId: 'user-1' }).valid, true, 'first use by a signed-in buyer is the whole point');
assert.equal(ask({ accountId: 'user-1' }).discountAmount, 50000);
assert.equal(ask({ accountId: 'user-1', accountRedemptions: 0 }).valid, true);

// --- 3. Signed in, already used -----------------------------------------------------------------------
assert.equal(ask({ accountId: 'user-1', accountRedemptions: 1 }).reason, VOUCHER_VALIDATION_REASONS.ACCOUNT_LIMIT_REACHED);
assert.equal(ask({ accountId: 'user-1', accountRedemptions: 5 }).reason, VOUCHER_VALIDATION_REASONS.ACCOUNT_LIMIT_REACHED,
  'past the limit is still past it');
assert.match(ask({ accountId: 'user-1', accountRedemptions: 1 }).message, /sudah pernah dipakai/,
  'a limit of one reads as "already used", not as an arithmetic report');
const twice = { ...card, usageLimitPerAccount: 3 };
assert.equal(validateVoucher({ code: 'KARTU1', voucher: twice, subtotal: 300000, accountId: 'u', accountRedemptions: 2 }).valid, true,
  'a limit above one still allows the ones in between');
assert.equal(validateVoucher({ code: 'KARTU1', voucher: twice, subtotal: 300000, accountId: 'u', accountRedemptions: 3 }).reason,
  VOUCHER_VALIDATION_REASONS.ACCOUNT_LIMIT_REACHED);

// --- 4. A voucher WITHOUT a per-account limit is untouched ---------------------------------------------
// Every voucher that exists today has no limit, and a deployment without the migration reads 0 for all of
// them. Anonymous checkout must keep working exactly as it does now.
const ordinary = { ...card, usageLimitPerAccount: 0 };
const askOrdinary = (over = {}) => validateVoucher({ code: 'KARTU1', voucher: ordinary, subtotal: 300000, ...over });
assert.equal(askOrdinary().valid, true, 'no per-account limit, no account needed — today\'s behaviour');
assert.equal(askOrdinary({ accountRedemptions: 99 }).valid, true, 'and redemptions are not counted at all');
assert.equal(normalizeVoucher({ code: 'X', discount_value: 1 }).usageLimitPerAccount, 0,
  'a row from a database without the column reads as unlimited, not as blocked');
assert.equal(normalizeVoucher({ code: 'X', discount_value: 1, usage_limit_per_account: 2 }).usageLimitPerAccount, 2,
  'and the snake_case column from PostgREST is picked up');

// --- 5. The global quota is reported first --------------------------------------------------------------
// An exhausted voucher is exhausted for everyone; telling an anonymous buyer to sign in for a code that
// has nothing left would be a wasted sign-in.
const exhausted = { ...card, usageLimitTotal: 5, usageCount: 5 };
assert.equal(validateVoucher({ code: 'KARTU1', voucher: exhausted, subtotal: 300000 }).reason,
  VOUCHER_VALIDATION_REASONS.USAGE_LIMIT_REACHED, 'quota beats the account rule');

// --- 6. The SERVER is the authority ----------------------------------------------------------------------
const api = read('..', 'api', 'orders', 'create.js');
assert.match(api, /accountId: buyer\.authUserId/, 'the endpoint must judge with the identity it verified itself');
assert.match(api, /accountRedemptions: await countAccountRedemptions\(voucherCode, buyer\.authUserId\)/,
  'and with a count it read itself, never one the browser sent');
assert.doesNotMatch(api, /input\.accountId|input\.authUserId|body\.accountId/,
  'nothing about the account may come from the request body');
assert.match(api, /p_auth_user_id: buyer\.authUserId/, 'and the redemption is recorded against that identity');
assert.match(api, /const ANONYMOUS_BUYER = \{ tier: 'retail', authUserId: null \}/,
  'an unverifiable token is anonymous — no account, which the rule refuses');

// The fallback for a deployment where the migration has not run must be narrow: a missing FUNCTION
// SIGNATURE, never a refusal. Retrying a quota or per-account refusal without the account would hand out
// the discount the rule just denied.
assert.match(api, /PGRST202\|Could not find the function\|does not exist/, 'the fallback matches a missing signature');
assert.match(api, /if \(!missingSignature\) throw rpcError;/, 'and rethrows anything else, including a real refusal');

// --- 7. The migration enforces it inside the lock --------------------------------------------------------
const sqlRaw = readRaw('..', '..', '..', 'supabase', 'migrations', '20260915020000_voucher_per_account_limit.sql');
// Comments stripped FIRST. The prose above the function says "the same `for update` lock", so a check
// against the raw text passes on the explanation alone — the exact trap this repo keeps falling into, and
// the one that let a sabotage removing the real lock go unnoticed until it was run.
const sql = sqlRaw.replace(/^\s*--.*$/gm, '');
assert.match(sql, /where code = v_code for update;/, 'the voucher row is locked while the decision is made');
assert.ok(sql.indexOf('for update') < sql.indexOf('usage_limit_per_account > 0'),
  'the per-account count must be taken INSIDE the lock, or two simultaneous checkouts by one account both pass');
assert.match(sql, /if p_auth_user_id is null then\s*\n\s*raise exception/,
  'the function itself must refuse an anonymous redemption, not rely on the caller having checked');
assert.match(sql, /add column if not exists usage_limit_per_account integer not null default 0/,
  'unlimited by default — every existing voucher keeps behaving as it does');
assert.match(sql, /add column if not exists auth_user_id uuid/, 'records carry who redeemed');
assert.doesNotMatch(sql, /update public\.storefront_voucher_usage_records\s+set auth_user_id/,
  'old records must not be backfilled with a guess — that would invent redemptions');
assert.match(sql, /grant execute on function public\.storefront_record_voucher_usage\(text, uuid, text, integer, uuid\) to service_role/,
  'the authority stays service-role only');
assert.doesNotMatch(sql, /grant execute on function public\.storefront_record_voucher_usage\([^)]*\) to (anon|authenticated)/,
  'the browser may never burn a redemption');
assert.match(sql, /where auth_user_id = auth\.uid\(\)/, 'the advisory RPC can only answer about the caller');
assert.match(sqlRaw, /VERIFY/); assert.match(sqlRaw, /ROLLBACK/);  // these live in comments, by design

// --- 8. The advisory count is advisory, and cannot grant anything ------------------------------------------
const service = read('services', 'voucherService.js');
assert.match(service, /storefront_voucher_redeemed_by_me/, 'checkout asks before the buyer fills the form');
assert.match(service, /return 0;\s*\n\s*\}\s*\n\};/, 'and treats any failure as 0');
assert.match(service, /const perAccount = Number\(matchedVoucher\?\.usageLimitPerAccount \|\| 0\) > 0;/,
  'the extra round trip is only paid by codes that actually have a per-account limit');

// --- 9. Both Studio forms can set it ---------------------------------------------------------------------
for (const form of ['pages/VoucherManagementPage.jsx', 'pages/mobile/MobileVoucherManagementPage.jsx']) {
  const source = read(...form.split('/'));
  assert.match(source, /usageLimitPerAccount: Number\(draft\.usageLimitPerAccount \|\| 0\)/, `${form} must save the limit`);
  assert.match(source, /Limit per akun/, `${form} must offer the field`);
  assert.match(source, /20260915020000/, `${form} must say the field needs the migration, since a save before it silently drops`);
}

console.log('voucherPerAccount selfcheck OK (a per-account code refuses anonymity; the server counts, not the browser)');
