// Regression guard for the way writes to storefront_orders disappear.
// `node src/utils/orderWrites.selfcheck.mjs`
//
// This checks the SOURCE of services/orderService.js, not its behaviour, because that file imports the
// supabase client and cannot be loaded outside a browser build. The rule it protects has now been broken
// three separate times (round 8 saveBatch, round 8 material modal, round 9 orders), so it is worth
// pinning mechanically:
//
//   1. Every UPDATE/DELETE on storefront_orders must ask for the affected rows with .select(), because an
//      RLS refusal is not an error in PostgREST — it answers 200 with zero rows and error === null.
//   2. No write may fall back to localStorage and return normally. That is what let "tandai lunas" report
//      an order paid while the row never moved.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'services', 'orderService.js'), 'utf8');

// --- 1. every mutation of the orders table observes its affected rows ------------------------------
const mutations = [...source.matchAll(/from\('storefront_orders'\)\s*\n?\s*\.(update|delete|insert)\(/g)];
assert.ok(mutations.length >= 3, `expected the orders table to still be written to, found ${mutations.length}`);

for (const match of mutations) {
  const verb = match[1];
  // Look at the statement this mutation belongs to: up to the next semicolon.
  const tail = source.slice(match.index, source.indexOf(';', match.index) + 1);
  if (verb === 'insert') continue; // createOrder's insert throws on error and has no silent path
  assert.ok(
    tail.includes('.select('),
    `a .${verb}() on storefront_orders does not .select() its affected rows, so an RLS refusal would look like success:\n${tail}`,
  );
}

// --- 2. the old silent-writer fingerprint is gone --------------------------------------------------
// Every silent writer looked exactly like this: destructure only `error`, and treat "no error" as success.
const silentFingerprint = /const \{ error \} = await \(isUuid\(orderId\) \? query\.eq\(/;
assert.ok(
  !silentFingerprint.test(source),
  'found the old write shape (`const { error } = await (isUuid(orderId) ? query.eq(...)`) — it treats an RLS refusal as success; route the write through updateOrderRow instead',
);

// --- 3. no write mirrors into localStorage and reports success -------------------------------------
const bannedFallbacks = [
  'Updating local storefront order fallback',
  'Updating local storefront order payment fallback',
  'Updating local storefront order shipment fallback',
  'Updating local storefront order internal notes fallback',
  'Updating local bespoke production fallback',
  'Updating local production links fallback',
  'Deleting local storefront order fallback',
  'Reviewing payment proof locally',
  'Saving payment proof locally',
  'Marking inventory deduction locally',
  'Marking inventory restore locally',
];
for (const marker of bannedFallbacks) {
  assert.ok(
    !source.includes(marker),
    `"${marker}" is back: a failed write is being mirrored into localStorage and reported as success`,
  );
}

// --- 4. the guard itself is still wired in ---------------------------------------------------------
assert.ok(source.includes('const updateOrderRow = async'), 'updateOrderRow helper is missing');
assert.match(source, /assertOrderWriteApplied\(data, orderId\)/, 'updateOrderRow no longer asserts a row was affected');

// --- 5. and the guard does what it says ------------------------------------------------------------
const assertOrderWriteApplied = (rows, orderId) => {
  if (!rows?.length) throw new Error(`Perubahan order ${orderId} tidak tersimpan.`);
  return rows[0];
};
assert.throws(() => assertOrderWriteApplied([], 'DKT-1'), /tidak tersimpan/, 'zero rows must fail');
assert.throws(() => assertOrderWriteApplied(null, 'DKT-1'), /tidak tersimpan/, 'no rows at all must fail');
assert.throws(() => assertOrderWriteApplied(undefined, 'DKT-1'), /tidak tersimpan/);
assert.deepEqual(assertOrderWriteApplied([{ order_number: 'DKT-1' }], 'DKT-1'), { order_number: 'DKT-1' });

// --- 6. buyer-facing code must not write to storefront_orders at all ------------------------------
// storefront_orders UPDATE is admin-only. Every one of these calls was filtered by RLS and answered 200
// with zero rows, so it looked like it worked; after the round 9 refactor the same call throws and takes
// checkout down with it. The server already writes what these were trying to write:
// api/orders/create.js sets the manual-transfer status, api/doku/checkout.js persists the DOKU session.
const BUYER_FACING = [
  'hooks/useCheckoutFlow.js',
  'pages/BespokePage.jsx',
  'pages/PaymentPage.jsx',
  'pages/CustomerPortalPage.jsx',
  'pages/mobile/MobileBespokePage.jsx',
  'pages/mobile/MobileCheckoutPage.jsx',
  'pages/CheckoutPage.jsx',
  'pages/CartPage.jsx',
  'pages/mobile/MobileCartPage.jsx',
];
const ADMIN_ONLY_WRITERS = [
  'updateOrderStatus',
  'updateOrderInternalNotes',
  'updateOrderShipment',
  'updateOrderBespokeProductionStatus',
  'updateOrderProductionLinks',
  'reviewOrderPaymentProof',
  'deleteOrder',
];

for (const relative of BUYER_FACING) {
  const buyerSource = readFileSync(join(here, '..', relative), 'utf8');
  // updateOrderPaymentStatus is the one that broke checkout; it must not appear at all.
  assert.ok(
    !/\bupdateOrderPaymentStatus\b/.test(buyerSource),
    `${relative} calls updateOrderPaymentStatus. storefront_orders UPDATE is admin-only, so for a buyer that write is refused — it used to fail silently and now throws, breaking checkout. The server already persists it.`,
  );
  for (const writer of ADMIN_ONLY_WRITERS) {
    // updateOrderStatus is allowed ONLY as best-effort cleanup inside a catch, wrapped in its own try.
    if (writer === 'updateOrderStatus' && buyerSource.includes('updateOrderStatus')) {
      assert.match(
        buyerSource,
        /try \{\s*\n\s*await updateOrderStatus\(/,
        `${relative} calls updateOrderStatus outside its own try/catch; as a buyer it is refused and would replace the error the buyer needs to see`,
      );
      continue;
    }
    assert.ok(
      !new RegExp(`\\b${writer}\\b`).test(buyerSource),
      `${relative} calls ${writer}, which is an admin-only write to storefront_orders`,
    );
  }
}

console.log('orderWrites selfcheck OK');
