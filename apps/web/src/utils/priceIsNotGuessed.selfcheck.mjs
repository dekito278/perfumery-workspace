// `node src/utils/priceIsNotGuessed.selfcheck.mjs`
//
// api/orders/create.js is the only authority on what a buyer pays. Three of its reads went through one
// helper whose headline was "a table that may not exist yet" and whose subject was any failure at all:
//
//   * the buyer's tier            -> [] read as RETAIL, for a buyer the page had just shown member prices
//   * that product's tier prices  -> [] read as "no tier price", so every line fell back to retail
//   * voucher redemptions         -> [] read as 0, so the pre-check passed and the lock refused the order
//
// Nothing compares the server's total against the one the buyer confirmed on screen, so the first two
// were silent: she saw one price and was charged another, which the tier-price caller's own comment calls
// the worst version of two implementations disagreeing.
//
// Behaviour, not text: the endpoint is lifted and RUN with fetch stubbed, because what matters is the
// price that comes out — not how the file reads.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = join(webRoot, '..', '..');
const endpoint = join(webRoot, 'api', 'orders', 'create.js');
const source = readFileSync(endpoint, 'utf8');

// --- 1. The refusal reasons are ONE rule in two places: the SQL that raises them and the allowlist that
// turns them into words. Lifted from the newest migration that defines the function, because a later
// redefinition silently replaces the body — and counted in BOTH directions, so a stale signature that no
// longer matches any raise is caught as surely as a raise with no signature.
{
  const migrations = join(repoRoot, 'supabase', 'migrations');
  const defining = readdirSync(migrations)
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => /create or replace function public\.storefront_record_voucher_usage/
      .test(readFileSync(join(migrations, name), 'utf8')))
    .sort();
  assert.ok(defining.length >= 1, 'no migration defines storefront_record_voucher_usage any more');
  const newest = readFileSync(join(migrations, defining[defining.length - 1]), 'utf8');
  const body = newest.slice(newest.indexOf('create or replace function public.storefront_record_voucher_usage'));

  // Every refusal the function can raise, taken from the SQL rather than named here.
  const raised = [...body.matchAll(/raise exception '([^']+)'/g)].map((m) => m[1])
    // The two argument guards are not refusals of a voucher the buyer holds.
    .filter((text) => !/wajib diisi|tidak ditemukan/.test(text));
  assert.ok(raised.length >= 3, `expected the three voucher refusals in ${defining.at(-1)}; found ${raised.length}`);

  const signatures = [...source.matchAll(/^  \['([^']+)',/gm)].map((m) => m[1]);
  assert.ok(signatures.length >= 3, `expected an allowlist of refusal signatures in create.js; found ${signatures.length}`);

  const unnamed = raised.filter((text) => !signatures.some((sig) => text.includes(sig)));
  assert.deepEqual(unnamed, [],
    'these refusals are raised by the SQL but have no message of their own, so the buyer is told the '
    + 'generic "kuota habis" instead of the reason:\n  ' + unnamed.join('\n  '));
  const stale = signatures.filter((sig) => !raised.some((text) => text.includes(sig)));
  assert.deepEqual(stale, [],
    'these signatures match nothing the SQL raises any more — delete them rather than leave a branch '
    + 'that can never fire:\n  ' + stale.join('\n  '));
  console.log(`  voucher refusals: ${raised.length} raised in ${defining.at(-1)}, each with its own message`);
}

// --- 2. The price itself, run.
{
  const shim = join(webRoot, 'api', 'orders', `.priceIsNotGuessed.${process.pid}.mjs`);
  writeFileSync(shim, source.replace(/^import\s[\s\S]*?from\s+'[^']+';$/gm, '')
    + '\nexport { resolveBuyer, sbSelectOptional, voucherRefusalMessage };\n');
  process.env.SUPABASE_URL = 'https://stub.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role';
  const { resolveBuyer, sbSelectOptional, voucherRefusalMessage } = await import(shim);
  unlinkSync(shim);

  // fetch answers by URL: the auth endpoint, then whatever the table read should do.
  const stub = ({ user = { id: 'acct-1' }, table }) => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return user
          ? { ok: true, status: 200, json: async () => user, text: async () => JSON.stringify(user) }
          : { ok: false, status: 401, json: async () => ({}), text: async () => 'bad token' };
      }
      return table();
    };
  };
  const rows = (value) => () => ({ ok: true, status: 200, json: async () => value, text: async () => JSON.stringify(value) });
  const fails = (status, body) => () => ({ ok: false, status, json: async () => ({}), text: async () => body });
  const req = { headers: { authorization: 'Bearer token' } };

  // The migration-delay case this helper was written for still works — and the two bodies below are the
  // REAL ones, copied from what production answered when asked for a column and a table that do not
  // exist. A pattern written from memory is a pattern that drifts away from what PostgREST actually sends.
  const MISSING_COLUMN = '{"code":"42703","details":null,"hint":null,'
    + '"message":"column storefront_customers.zz_tidak_ada does not exist"}';
  const MISSING_TABLE = '{"code":"PGRST205","details":null,'
    + '"hint":"Perhaps you meant the table \'public.storefront_orders\'",'
    + '"message":"Could not find the table \'public.storefront_zz_tidak_ada\' in the schema cache"}';
  for (const body of [MISSING_COLUMN, MISSING_TABLE]) {
    stub({ table: fails(400, body) });
    assert.deepEqual(await resolveBuyer(req), { tier: 'member', authUserId: 'acct-1' },
      'a relation that has not been added yet must still read as member, not refuse the order');
    assert.deepEqual(await sbSelectOptional('anything'), [], 'and the helper answers it with an empty list');
  }

  // A read that merely failed must NOT become a price.
  stub({ table: fails(503, 'upstream connect error') });
  await assert.rejects(() => resolveBuyer(req), /Supabase read failed/,
    'a tier read that failed must refuse the order — returning retail charges a member more than the '
    + 'price she was shown, and nothing compares the total she confirmed');
  await assert.rejects(() => sbSelectOptional('anything'), /Supabase read failed/,
    'and the helper must stop swallowing every failure into an empty list');

  // The real answers still come through, both tiers.
  stub({ table: rows([{ tier: 'reseller' }]) });
  assert.deepEqual(await resolveBuyer(req), { tier: 'reseller', authUserId: 'acct-1' });
  stub({ table: rows([]) });
  assert.deepEqual(await resolveBuyer(req), { tier: 'member', authUserId: 'acct-1' },
    'a signed-in buyer with no row is a member — the rule the old retail fallback contradicted');

  // And the deliberate anonymous cases are untouched: no token, and a token that does not verify.
  assert.deepEqual(await resolveBuyer({ headers: {} }), { tier: 'retail', authUserId: null });
  stub({ user: null, table: rows([{ tier: 'reseller' }]) });
  assert.deepEqual(await resolveBuyer(req), { tier: 'retail', authUserId: null },
    'a token that does not verify must stay retail — that is why the customer code is not trusted');

  // The three refusals each say their own thing, and an unknown one keeps the generic line.
  const said = new Set();
  for (const raised of ['Voucher KARTU1 hanya untuk pembeli yang masuk ke akunnya',
    'Voucher KARTU1 sudah dipakai di akun ini', 'Kuota voucher sudah habis', 'something else entirely']) {
    said.add(voucherRefusalMessage(new Error(raised), 'KARTU1'));
  }
  assert.equal(said.size, 4, 'each refusal must read differently, or the buyer cannot act on it');
  assert.match(voucherRefusalMessage(new Error('Voucher X hanya untuk pembeli yang masuk ke akunnya'), 'X'),
    /Masuk dengan Google/, 'the one fix that is in the buyer\'s hands must be the one she is told about');
  assert.doesNotMatch(voucherRefusalMessage(new Error('duplicate key value violates unique constraint "x"'), 'X'),
    /duplicate key|constraint/, 'an unrecognised database error must never be forwarded to a buyer');
}

console.log('priceIsNotGuessed selfcheck OK (a failed read refuses; it never becomes a price)');
