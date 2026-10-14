// `node src/utils/voucherCardShowsWhatTheFormWrites.selfcheck.mjs`
//
// The voucher edit form writes eleven fields. The card Dekito reviews his codes on showed six of them,
// and the one it left out is the one that changes WHO can use the code: usageLimitPerAccount. Above zero,
// validateVoucher refuses an anonymous buyer outright — "hanya untuk pembeli yang masuk ke akunnya" —
// because a per-account limit is bypassable by not signing in. So a code with it set behaves completely
// differently from one without, and the only place that said so was the help text under the input.
//
// Live on 14 Oct 2026: one active code of seven has it (DARIATELIER, 1 per account). The two codes buyers
// actually used do not, and one signed-in account has taken SOLI10's 10% three times — allowed by that
// configuration, invisible on the screen where the configuration is read.
//
// The rule is derived, not listed: every key the FORM can write must be visible on the card. A twelfth
// field added to the form arrives in this check on the commit that adds it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { voucherAccountLimitLabel, voucherRestrictionLabel, voucherStatus } from './voucherSummary.js';

const src = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. The label itself --------------------------------------------------------------------------
assert.equal(voucherAccountLimitLabel({ usageLimitPerAccount: 0 }), 'Tanpa batas akun');
assert.equal(voucherAccountLimitLabel({}), 'Tanpa batas akun', 'a voucher saved before the column existed');
assert.match(voucherAccountLimitLabel({ usageLimitPerAccount: 1 }), /1x per akun/);
assert.match(voucherAccountLimitLabel({ usageLimitPerAccount: 1 }), /wajib login/,
  'the login requirement is the half that decides whether a guest can use the code at all');
assert.match(voucherAccountLimitLabel({ usageLimitPerAccount: 3 }), /3x per akun/);
assert.equal(voucherAccountLimitLabel({ usageLimitPerAccount: 'abc' }), 'Tanpa batas akun', 'garbage is no limit');
assert.equal(voucherAccountLimitLabel({ usageLimitPerAccount: -2 }), 'Tanpa batas akun', 'nor is a negative one');

// --- 2. The shared helpers are shared ---------------------------------------------------------------
// Both pages had their own copy of these two, comment included. They had not drifted yet; nothing
// stopped them, and the badge is where an expired code is spotted before it is handed to a buyer.
const PAGES = [['pages', 'VoucherManagementPage.jsx'], ['pages', 'mobile', 'MobileVoucherManagementPage.jsx']];
for (const page of PAGES) {
  const source = read(...page);
  assert.doesNotMatch(source, /const getVoucherStatus = /,
    `${page.join('/')} has its own copy of the status badge again — there are two voucher screens and `
    + 'one rule about what "Aktif" means');
  assert.doesNotMatch(source, /const getVoucherRestrictionLabel = /,
    `${page.join('/')} has its own copy of the restriction label again`);
  assert.match(source, /from '@\/utils\/voucherSummary\.js'/, `${page.join('/')} must read the shared helpers`);
}

// An expired code is not active, whichever screen asks.
assert.equal(voucherStatus({ active: true, expiresAt: '2020-01-01' }).key, 'expired');
assert.equal(voucherStatus({ active: false }).key, 'inactive');
assert.equal(voucherStatus({ active: true, usageLimitTotal: 5, usageCount: 5 }).key, 'limit_reached');
assert.equal(voucherStatus({ active: true }).key, 'active');
assert.equal(voucherRestrictionLabel({}), 'Semua produk');
assert.equal(voucherRestrictionLabel({ eligibleProductSlugs: ['a', 'b'] }), '2 produk');

// --- 3. Every field the form writes is on the card --------------------------------------------------
// Only this one is not a fact about the voucher, so only this one is exempt.
const NOT_A_FACT = new Set(['id']);
// Fields the card shows THROUGH a helper, so the key name does not appear in the markup. Each entry is
// the call that must be there, which is what makes the exemption expire when the call goes away.
const SHOWN_VIA = new Map([
  ['usageLimitPerAccount', 'voucherAccountLimitLabel(voucher)'],
  ['eligibleProductSlugs', 'voucherRestrictionLabel(voucher)'],
  ['eligibleCategories', 'voucherRestrictionLabel(voucher)'],
  ['active', 'voucherStatus(voucher)'],
]);

for (const page of PAGES) {
  const source = read(...page);
  const draftStart = source.indexOf('const emptyDraft = {');
  assert.ok(draftStart > 0, `${page.join('/')}: cannot find the form's field list — this check's parse is broken`);
  const draft = source.slice(draftStart, source.indexOf('};', draftStart));
  const fields = [...draft.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);
  assert.ok(fields.length >= 10,
    `${page.join('/')}: only ${fields.length} form fields parsed, expected the whole draft`);

  // The card is the block the list renders per voucher. The phone paginates, so the array it maps is
  // not the same name — matching on ".map((voucher) =>" asks the question both screens answer.
  const cardStart = source.search(/\w+\.map\(\(voucher\) => \{/);
  assert.ok(cardStart > 0, `${page.join('/')}: cannot find the voucher list`);
  const card = source.slice(cardStart, source.indexOf('</article>', cardStart));
  assert.ok(card.includes('{voucher.code}'), `${page.join('/')}: the card does not even name the code`);

  const hidden = fields.filter((field) => {
    if (NOT_A_FACT.has(field)) return false;
    if (SHOWN_VIA.has(field)) return !card.includes(SHOWN_VIA.get(field));
    return !card.includes(`voucher.${field}`);
  });
  assert.deepEqual(hidden, [],
    `${page.join('/')}: the form writes these and the card never shows them, so a code can behave one `
    + `way and read another:\n  ${hidden.join('\n  ')}`);
}

console.log('voucherCardShowsWhatTheFormWrites selfcheck OK (both cards show every field the form writes, '
  + 'including the per-account limit that forces a login)');
