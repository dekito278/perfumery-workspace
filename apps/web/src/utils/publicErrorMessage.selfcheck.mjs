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
import { basename, dirname, join } from 'node:path';
import { isInternalErrorMessage, publicErrorMessage } from './publicErrorMessage.js';
import { buyerSurfaces } from './buyerSurfaces.mjs';

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
// This used to be a hand-written list of six pages, and that is precisely how it failed: the list never
// grew. /payment and /journal were added to the router and nobody came back here, so the page where a
// buyer uploads her transfer receipt kept printing Supabase Storage errors at her.
//
// Deriving it from the router fixed that and left two narrower holes, both of which cost a real leak:
//
//   * The route's component was read as `element={<Outer>` plus at most ONE nested tag, so the four cart
//     pages — mounted as <ByShop domestic={<CartPage />} international={<InternationalCartPage />} /> —
//     resolved to "ByShop", which is not a page, and were skipped entirely. Nothing was leaking there,
//     but nothing was watching either.
//   * Only the ROUTED file was read. /mobile/dashboard mounts MobileCommerceTabsPage and the catalog,
//     storefront and articles screens are its children, so none of the three was ever opened. The phone
//     journal screen was printing `err.message` straight into its error panel — a Postgres or network
//     message in place of the translated sentence sitting right next to it as the fallback.
//
// So the subject is every file a stranger can reach: the public routes, and everything they import.
// Not a buyer surface, each for a stated reason — never "it was failing".
const NOT_A_BUYER_SURFACE = new Map([
  ['LoginPage', 'studio sign-in; "Invalid login credentials" is exactly what Dekito needs to read'],
  ['MobileLoginPage', 'studio sign-in on the phone, same reason'],
  ['ResetPasswordPage', 'reached from a studio password-reset mail, not from the shop'],
]);

// The file set comes from buyerSurfaces.mjs, shared with two other guards; the traps that cost a leak
// are recorded there once.
const { files: surfaces, routed, depthOf, appSource } = buyerSurfaces({
  src,
  exclude: new Set(NOT_A_BUYER_SURFACE.keys()),
});
assert.ok([...appSource.matchAll(/'@\/pages\/[^']+'/g)].length >= 30,
  'fewer than 30 page imports found in App.jsx — the parse is broken, and note the convention is '
  + 'lazyRoute(), not lazy()');
assert.ok(routed.length >= 20, `only ${routed.length} public routes resolved — the parse is broken`);
assert.ok(surfaces.length >= 60,
  `only ${surfaces.length} buyer-facing files reached — the derivation lost most of them`);
for (const name of ['MobileArticlesPage', 'InternationalCartPage']) {
  assert.ok(surfaces.some((file) => basename(file, '.jsx') === name),
    `${name} fell out of the sweep. It is reached through another element — a tabs page in one case, a `
    + '<ByShop> wrapper in the other — which is exactly what the two earlier versions of this '
    + 'derivation lost');
}
// And the walk must keep queueing what it finds. A walk that stopped one level in still reached 67
// files and still found the articles screen, so neither the count nor the names above can tell. The
// panel those screens hand their error message to is three levels from the route.
assert.ok(depthOf('MobileStatePanel') >= 3,
  'MobileStatePanel is reachable in fewer than three steps, so the walk is not following imports all '
  + 'the way: it is the panel the phone screens print their error message in');

// Showing a caught error means putting its .message where a reader can see it: a state setter, a toast,
// or interpolated into a sentence. console.* is not showing it to anybody, so it is removed first —
// otherwise a log line would fail this and the honest fix would be to stop logging.
const RAW_DISPLAY = [
  /set[A-Z]\w*\(\s*\w+\.message/,
  /toast\.(?:error|warning|info|success)\(\s*\w+\.message/,
  /`[^`]*\$\{\s*\w+\.message/,
];
let checked = 0;
const leaks = [];
for (const file of surfaces) {
  const source = readFileSync(file, 'utf8').replace(/console\.\w+\([^;]*\);/g, ' ');
  for (const pattern of RAW_DISPLAY) {
    const hit = source.match(pattern);
    if (hit) leaks.push(`${file.replace(`${src}/`, '')}  ${hit[0]}`);
  }
  checked += 1;
}
assert.deepEqual(leaks, [],
  'these buyer-facing files show a caught error verbatim, so a stranger reads our machinery '
  + '("violates row-level security policy", "Failed to fetch") instead of something she can act on. '
  + `Wrap it in publicErrorMessage() with the translated sentence as the fallback:\n  ${leaks.join('\n  ')}`);
assert.ok(checked >= 60, `only ${checked} buyer-facing files checked — the derivation lost most of them`);
console.log(`publicErrorMessage selfcheck OK (${checked} buyer-facing files reached from the public routes, none printing raw errors)`);

// Studio keeps the raw text on purpose — a constraint name is exactly what Dekito needs there.
assert.doesNotMatch(read('pages', 'CustomersPage.jsx'), /publicErrorMessage/,
  'Studio must keep raw errors: hiding them there removes the only clue the owner gets');

// The real error is still logged, or making the buyer's copy vaguer would cost diagnosability.
assert.match(read('utils', 'publicErrorMessage.js'), /console\.warn\('Hidden from the buyer:'/,
  'the hidden message must still reach the console');

console.log('publicErrorMessage selfcheck OK (machinery hidden, curated sentences kept, nothing lost)');
