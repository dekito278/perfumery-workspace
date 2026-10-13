// `node src/utils/publicErrorMessage.selfcheck.mjs`
//
// Services rethrow `new Error(error.message || '...')` in 62 places, so a Postgres message travels
// intact to whatever displays it. In Studio that is useful. On a storefront page it names tables and
// columns to a stranger and tells the one person who cannot act on it.
//
// The two ways this can go wrong are opposite, so both are held: leaking machinery to a buyer, and
// swallowing a curated sentence that was more useful than the fallback.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
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
const app = read('App.jsx');
const importedFrom = new Map();
for (const match of app.matchAll(/(?:import\s+(\w+)\s+from|const\s+(\w+)\s*=\s*\w*[Ll]azy\w*\(\(\)\s*=>\s*import\()\s*'@\/([^']+)'/g)) {
  importedFrom.set(match[1] || match[2], match[3]);
}
assert.ok([...importedFrom.values()].filter((file) => file.startsWith('pages/')).length >= 30,
  'fewer than 30 page imports parsed from App.jsx — the parse is broken, and note the convention is '
  + 'lazyRoute(), not lazy()');

const resolveModule = (rel) => {
  for (const candidate of [rel, `${rel}.jsx`]) {
    if (existsSync(join(src, candidate))) return join(src, candidate);
  }
  return null;
};
// Every capitalised tag in the route block, and the block ends at the NEXT <Route — not at the first
// "/>", which is where the nested cart pages were being lost.
const routeBlocks = app.split(/(?=<Route\b)/).slice(1).map((part) => {
  const next = part.slice(1).search(/<Route\b/);
  return next === -1 ? part : part.slice(0, next + 1);
});
const publicNames = new Set();
const gatedNames = new Set();
for (const block of routeBlocks) {
  const path = (block.match(/path="([^"]+)"/) || [])[1] || '';
  const target = /<ProtectedRoute/.test(block) || /^\/(?:studio|mobile\/studio)/.test(path)
    ? gatedNames
    : publicNames;
  for (const match of block.matchAll(/<([A-Z]\w+)/g)) target.add(match[1]);
}

// Not buyer surfaces, each for a stated reason — never "it was failing".
const NOT_A_BUYER_SURFACE = new Map([
  ['LoginPage', 'studio sign-in; "Invalid login credentials" is exactly what Dekito needs to read'],
  ['MobileLoginPage', 'studio sign-in on the phone, same reason'],
  ['ResetPasswordPage', 'reached from a studio password-reset mail, not from the shop'],
]);

const roots = [...publicNames]
  .filter((name) => !gatedNames.has(name) && !NOT_A_BUYER_SURFACE.has(name))
  .map((name) => importedFrom.get(name))
  .filter(Boolean)
  .map(resolveModule)
  .filter(Boolean);
// Plus components/storefront, which is buyer-facing by construction and holds the files App.jsx renders
// as Suspense fallbacks — reached from the router, not from any page, so the closure alone misses them.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return /\.jsx$/.test(entry.name) ? [full] : [];
});
const reachable = new Set([...roots, ...walk(join(src, 'components', 'storefront'))]);
const queue = [...reachable];
while (queue.length) {
  const file = queue.pop();
  for (const match of readFileSync(file, 'utf8').matchAll(/from\s+'@\/((?:pages|components|layouts)\/[^']+)'/g)) {
    const next = resolveModule(match[1]);
    if (!next || reachable.has(next) || NOT_A_BUYER_SURFACE.has(basename(next, '.jsx'))) continue;
    reachable.add(next);
    queue.push(next);
  }
}
const surfaces = [...reachable].filter((file) => file.endsWith('.jsx'));
assert.ok(surfaces.length >= 60,
  `only ${surfaces.length} buyer-facing files reached — the derivation lost most of them`);
for (const name of ['MobileArticlesPage', 'InternationalCartPage']) {
  assert.ok(surfaces.some((file) => basename(file, '.jsx') === name),
    `${name} fell out of the sweep. It is reached through another element — a tabs page in one case, a `
    + '<ByShop> wrapper in the other — which is exactly what the two earlier versions of this '
    + 'derivation lost');
}
// And the walk must keep queueing what it finds. A walk that stopped one level in still reached 67
// files and still found the articles screen, so neither the count nor the names above can tell. This
// one is three levels down — route -> tabs page -> articles screen -> MobileStatePanel — and it is the
// component that actually PRINTS the error text those screens set.
assert.ok(surfaces.some((file) => basename(file, '.jsx') === 'MobileStatePanel'),
  'MobileStatePanel is missing, so the walk is not following imports all the way: it is the panel the '
  + 'phone screens hand their error message to, three levels from the route');

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
