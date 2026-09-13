// `node src/utils/publicErrorMessage.selfcheck.mjs`
//
// Services rethrow `new Error(error.message || '...')` in 62 places, so a Postgres message travels
// intact to whatever displays it. In Studio that is useful. On a storefront page it names tables and
// columns to a stranger and tells the one person who cannot act on it.
//
// The two ways this can go wrong are opposite, so both are held: leaking machinery to a buyer, and
// swallowing a curated sentence that was more useful than the fallback.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isInternalErrorMessage, publicErrorMessage } from './publicErrorMessage.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const FALLBACK = 'Gagal menyimpan profil';
const shown = (message) => publicErrorMessage(new Error(message), FALLBACK);

// --- machinery never reaches a buyer ----------------------------------------------------------------
for (const internal of [
  'duplicate key value violates unique constraint "storefront_customers_auth_user_id_key"',
  'null value in column "customer_code" violates not-null constraint',
  'permission denied for table storefront_customers',
  'new row violates row-level security policy for table "storefront_orders"',
  'relation "public.storefront_product_prices" does not exist',
  'Could not find the \'tier\' column of \'storefront_customers\' in the schema cache',
  'invalid input syntax for type uuid: "abc"',
  'JWT expired',
  'Failed to fetch',
  'TypeError: Cannot read properties of undefined (reading \'id\')',
  'PGRST202',
  '23505',
  'FetchError: request to https://ysokpneuumtmgqfgdpmc.supabase.co/rest/v1/ failed',
]) {
  assert.equal(shown(internal), FALLBACK, `leaked to a buyer: ${internal}`);
  assert.equal(isInternalErrorMessage(internal), true);
}

// A dump is not a sentence, whatever it says.
assert.equal(shown('x'.repeat(400)), FALLBACK);

// --- a curated sentence survives --------------------------------------------------------------------
// These are more useful than the fallback and the whole point of not replacing every message blindly.
for (const curated of [
  'Kode customer tidak ditemukan',
  'Jawaban keamanan salah',
  'Security question and answer are required',
  'Invalid login credentials',
  'Stok tidak mencukupi untuk ukuran ini',
  'Voucher sudah kedaluwarsa',
]) {
  assert.equal(shown(curated), curated, `swallowed a message worth showing: ${curated}`);
  assert.equal(isInternalErrorMessage(curated), false);
}

// --- nothing at all still says something -------------------------------------------------------------
assert.equal(shown(''), FALLBACK);
assert.equal(publicErrorMessage(undefined, FALLBACK), FALLBACK);
assert.equal(publicErrorMessage(null, FALLBACK), FALLBACK);
assert.equal(publicErrorMessage({}, FALLBACK), FALLBACK);
assert.equal(publicErrorMessage('Kode customer tidak ditemukan', FALLBACK), 'Kode customer tidak ditemukan',
  'a plain string is a message too — services throw both');
assert.ok(publicErrorMessage(new Error('Failed to fetch')).length > 0, 'there is always a default fallback');

// --- the buyer-facing surfaces actually use it -------------------------------------------------------
// Missing one is not a crash; it is the one page that still prints a constraint name at a stranger.
for (const file of [
  ['pages', 'CustomerPortalPage.jsx'], ['pages', 'CheckoutPage.jsx'], ['pages', 'BespokePage.jsx'],
  ['pages', 'PublicTrackingPage.jsx'], ['pages', 'mobile', 'MobileCheckoutPage.jsx'],
  ['pages', 'mobile', 'MobileBespokePage.jsx'],
]) {
  const source = read(...file);
  assert.match(source, /publicErrorMessage/, `${file.join('/')} must filter what it shows a buyer`);
  assert.doesNotMatch(source, /toast\.error\((?:error|err)\.message/,
    `${file.join('/')} still shows a raw error message to a buyer`);
  assert.doesNotMatch(source, /setError\((?:error|err)\.message/,
    `${file.join('/')} still renders a raw error message to a buyer`);
}

// Studio keeps the raw text on purpose — a constraint name is exactly what Dekito needs there.
assert.doesNotMatch(read('pages', 'CustomersPage.jsx'), /publicErrorMessage/,
  'Studio must keep raw errors: hiding them there removes the only clue the owner gets');

// The real error is still logged, or making the buyer's copy vaguer would cost diagnosability.
assert.match(read('utils', 'publicErrorMessage.js'), /console\.warn\('Hidden from the buyer:'/,
  'the hidden message must still reach the console');

console.log('publicErrorMessage selfcheck OK (machinery hidden, curated sentences kept, nothing lost)');
