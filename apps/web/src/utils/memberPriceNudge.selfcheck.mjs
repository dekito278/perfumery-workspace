// `node src/utils/memberPriceNudge.selfcheck.mjs`
//
// A visitor who has not signed in is shown the member price beside the retail one, with the way in.
// Until now the only people who knew a member price existed were the ones already paying it.
//
// Three things have to hold at once, and the third is the one that matters most:
//   * the nudge shows the RIGHT number, on every surface that shows a price
//   * it never changes what anyone pays — the order endpoint stays the only authority
//   * it stays SILENT whenever there is nothing to say: for a signed-in member, for a member price
//     that would not save anything, and — right now — for every product, because no member price has
//     been filled in yet. A nudge that fires with nothing behind it is the fastest way to teach
//     visitors to ignore it.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { attachMemberPrices, memberPriceFor, memberSavingForCart } from './memberPriceNudge.js';
import { indexTierPrices } from './tierPrice.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));
const readRaw = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const index = (rows) => indexTierPrices(rows.map(([slug, variantId, tier, price]) => ({ slug, variant_id: variantId, tier, price_number: price })));
const product = (slug, price, variants) => ({ slug, priceNumber: price, price: `Rp ${price}`, variants });

// --- 1. The number, and only when it saves something ---------------------------------------------------
const idx = index([['lintang', '30-ml', 'member', 299000], ['lintang', '', 'member', 120000]]);
assert.equal(memberPriceFor(idx, 'lintang', '30-ml', 329000), 299000, 'the variant row wins for that variant');
assert.equal(memberPriceFor(idx, 'lintang', '10-ml', 129000), 120000, 'a variant with no row falls back to the product-level row');
assert.equal(memberPriceFor(idx, 'lintang', '30-ml', 299000), null, 'equal to the current price saves nothing — silent');
assert.equal(memberPriceFor(idx, 'lintang', '30-ml', 250000), null, 'a member price ABOVE the current price is not a member price — silent');
assert.equal(memberPriceFor(idx, 'nope', '30-ml', 329000), null, 'no row, no nudge');
assert.equal(memberPriceFor({}, 'lintang', '30-ml', 329000), null, 'empty index — before the migration, and before any price is filled in');
assert.equal(memberPriceFor(idx, 'lintang', '30-ml', 0), null, 'no current price to compare against');

// --- 2. Attaching never changes the price ---------------------------------------------------------------
const catalog = [
  product('lintang', 329000, [{ id: '10-ml', priceNumber: 129000 }, { id: '30-ml', priceNumber: 329000 }]),
  product('other', 200000, [{ id: '30-ml', priceNumber: 200000 }]),
];
const withMember = attachMemberPrices(catalog, idx);
assert.notEqual(withMember, catalog, 'something gained a member price, so a new array comes back');
assert.equal(withMember[0].priceNumber, 329000, 'the retail price is untouched');
assert.equal(withMember[0].price, 'Rp 329000', 'and so is the formatted string');
assert.equal(withMember[0].variants[1].priceNumber, 329000, 'the variant price is untouched too');
assert.equal(withMember[0].variants[1].memberPriceNumber, 299000, 'the 30 ml carries its member price');
assert.equal(withMember[0].variants[0].memberPriceNumber, 120000, 'the 10 ml falls back to the product-level row');
assert.equal(withMember[0].memberPriceNumber, 120000, 'the product follows its FIRST variant, the same rule applyTierPrices uses — so the card and the page agree');
assert.equal(withMember[1], catalog[1], 'a product with no member price is the same object — no re-render for it');

// --- 3. Silent by reference when nothing applies ----------------------------------------------------------
assert.equal(attachMemberPrices(catalog, {}), catalog, 'empty index returns the SAME array — the storefront renders exactly as today');
assert.equal(attachMemberPrices(catalog, index([['zzz', '', 'member', 1]])), catalog, 'an index for other products changes nothing');
assert.equal(attachMemberPrices(catalog, index([['lintang', '30-ml', 'reseller', 1]])), catalog, 'a reseller row is not a member price');
assert.equal(attachMemberPrices([], idx).length, 0);
assert.deepEqual(attachMemberPrices(undefined, idx), [], 'called with nothing, an empty list and no crash');

// A signed-in member: applyTierPrices has already lowered their price TO the member price, so the nudge
// finds nothing lower. This is the case that keeps a member from being told to sign in.
const alreadyMember = [product('lintang', 299000, [{ id: '30-ml', priceNumber: 299000, retailPriceNumber: 329000 }])];
assert.equal(attachMemberPrices(alreadyMember, idx), alreadyMember, 'a member paying the member price gets no nudge');

// The catalog array carries a non-enumerable `loading`; pages read it to tell "empty shop" from "not yet".
const loading = Object.defineProperty([...catalog], 'loading', { value: true, enumerable: false });
assert.equal(attachMemberPrices(loading, idx).loading, true, '`loading` must survive the map');

// --- 4. The migration can only ever hand out member prices ---------------------------------------------
const sql = readRaw('..', '..', '..', 'supabase', 'migrations', '20260914200000_storefront_member_prices_public.sql');
assert.match(sql, /pr\.tier = 'member'/, 'the tier must be a literal in the WHERE clause — no path returns a reseller row');
assert.doesNotMatch(sql, /storefront_my_price_tier\(\)/, 'it must not depend on who is calling; that is what makes it safe for anon');
assert.match(sql, /grant execute on function public\.storefront_member_prices\(text\[\]\) to anon, authenticated/, 'anyone may call it');
assert.doesNotMatch(sql, /grant\s+select\s+on\s+public\.storefront_product_prices/i, 'the table itself stays closed — the function is the only way in');
assert.match(sql, /not public\.storefront_product_is_draft\(p\.tags\)/, 'a draft product must not leak its member price');
assert.match(sql, /security definer/, 'it reads a table anon cannot, so it must run as the owner');
assert.match(sql, /VERIFY/); assert.match(sql, /ROLLBACK/);

// --- 5. The app survives the migration not being there ----------------------------------------------------
// Checked against the real answer, not an assumed one: PostgREST returns PGRST202 for the missing
// function on the live project, and that code is in isSchemaMissing's list.
const service = read('services', 'tierPricingService.js');
// Bounded to THIS function's body. An open-ended window bled into listTierPricesForProduct below, which
// also calls isSchemaMissing, and let a version that throws straight to the visitor pass.
const fnStart = service.indexOf('export const getPublicMemberPrices');
assert.notEqual(fnStart, -1, 'could not locate getPublicMemberPrices — this check is asserting nothing');
const fnEnd = service.indexOf('export const', fnStart + 1);
const fn = service.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
assert.match(fn, /rpc\('storefront_member_prices'/, 'the service must call the public function');
assert.match(fn, /isSchemaMissing\(error\)/, 'and treat a missing function as "no member prices", not as an error the visitor sees');
assert.match(fn, /return \{ index: \{\}/, 'the fallback must be an empty index, so the nudge simply stays away');
assert.doesNotMatch(fn, /^\s*throw error;\s*$/m, 'nothing in this function may rethrow to the caller');
assert.match(service, /'PGRST202'/, 'the code PostgREST actually returns must be recognised');

// --- 6. Order of operations in the hook -------------------------------------------------------------------
const hook = read('hooks', 'useStorefrontProducts.js');
assert.match(hook, /attachMemberPrices\(applyTierPrices\(/, 'tier first, then the nudge — reversed, a member would be told to sign in');
assert.match(hook, /export const useMemberPrices/, 'the public index must be shared like the tier index, not fetched per page');

// --- 7. The note: right branch, right order, right gate -----------------------------------------------------
const note = read('components', 'storefront', 'PriceNote.jsx');
assert.match(note, /memberPrice < price/, 'the nudge must require the member price to be strictly lower');
assert.match(note, /Masuk dengan Google/, 'and must offer the way in, not just the number');
assert.match(note, /loginWithGoogle\(window\.location\.href\)/, 'signing in must bring the visitor back to the product they were looking at');
assert.ok(note.indexOf('memberPriceNumber') < note.indexOf('compareAtPriceNumber'), 'the member nudge must come before the compare-at line, or a discounted product hides the reason to sign in');
assert.ok(note.indexOf('TIER_LABELS[product?.priceTier]') < note.indexOf('memberPriceNumber'), 'a signed-in member sees "Harga member", never the nudge');

// --- 8. Every surface that shows a price shows the member one --------------------------------------------
for (const surface of ['pages/CatalogPage.jsx', 'pages/mobile/MobileCatalogPage.jsx', 'pages/mobile/MobileStorefrontPage.jsx', 'pages/mobile/MobileProductDetailPage.jsx']) {
  const source = read(...surface.split('/'));
  assert.match(source, /memberPriceNumber/, `${surface} shows a price, so it must show the member price beside it`);
  assert.match(source, /Member \{formatRupiah\(/, `${surface} must format it with the app's own formatter`);
}
for (const pdp of ['pages/PublicProductDetailPage.jsx', 'pages/mobile/MobileProductDetailPage.jsx']) {
  assert.match(read(...pdp.split('/')), /<PriceNote product=\{product\} variant=\{selectedVariant\}/, `${pdp} must hand PriceNote the chosen variant`);
}

// --- 9. The cart saving on the checkout button ----------------------------------------------------------
// A cart line's `slug` is the cartSlug (product slug + variant suffix). The index is keyed by product
// slug. Keying by the wrong one makes every saving 0 and the button never changes — silently.
const cartIdx = index([['lintang', '30-ml', 'member', 299000], ['maskumambang', '', 'member', 550000]]);
const cart = [
  { slug: 'lintang-30-ml', productSlug: 'lintang', variantId: '30-ml', priceNumber: 329000, quantity: 2 },
  { slug: 'maskumambang-30-ml', productSlug: 'maskumambang', variantId: '30-ml', priceNumber: 610000, quantity: 1 },
  { slug: 'other-30-ml', productSlug: 'other', variantId: '30-ml', priceNumber: 200000, quantity: 3 },
];
assert.equal(memberSavingForCart(cart, cartIdx), 2 * 30000 + 60000, 'saving is per line x quantity, product-level row applies to any variant');
assert.equal(memberSavingForCart(cart.map((line) => ({ ...line, productSlug: undefined })), cartIdx), 0, 'without productSlug there is nothing to key on — 0, never a guess');
assert.equal(memberSavingForCart(cart, {}), 0, 'no member prices, no saving — the ordinary copy stays');
assert.equal(memberSavingForCart([], cartIdx), 0);
assert.equal(memberSavingForCart([{ productSlug: 'lintang', variantId: '30-ml', priceNumber: 299000, quantity: 1 }], cartIdx), 0, 'a line already at the member price saves nothing — a signed-in member is not nudged');
assert.equal(memberSavingForCart([{ productSlug: 'lintang', variantId: '30-ml', priceNumber: 329000, quantity: 0 }], cartIdx), 0, 'quantity 0 saves nothing');
assert.equal(memberSavingForCart(undefined, cartIdx), 0, 'no crash on nothing');

// --- 10. Both checkout pages say the number, and only when there is one --------------------------------
for (const page of ['pages/CheckoutPage.jsx', 'pages/mobile/MobileCheckoutPage.jsx']) {
  const source = read(...page.split('/'));
  assert.match(source, /memberSavingForCart\(items, memberIndex\)/, `${page} must compute the real saving from the cart`);
  assert.match(source, /memberSaving > 0\s*\?/, `${page} must fall back to the ordinary copy when there is nothing to save`);
  assert.match(source, /hemat \$\{formatTotal\(memberSaving\)\}|hemat \{formatTotal\(memberSaving\)\}/, `${page} must print the actual amount, not a vague promise`);
  // Bound to the button's ELSE branch. "data terisi otomatis" also appears in the signed-in "Masuk
  // sebagai …" line, so a bare phrase match passed while the button's fallback was empty.
  assert.match(source, /:\s*'Masuk dengan Google — [^']*data terisi otomatis'/, `${page} must keep the ordinary copy on the button for the no-saving case`);
}

// --- 11. The public mapper must CARRY the field, not just the pages RENDER it -----------------------------
// This is the hole the first version of this guard had. toPublicFragrance rebuilds every product and
// variant from a hand-written field list; it named retailPriceNumber, priceTier and compareAtPriceNumber
// and not memberPriceNumber, so all seven surfaces dropped it before reading it — and the nudge rendered
// nowhere on the live site, found only by looking. Same omission compareAtPriceNumber once had, same way.
const mapper = read('data', 'publicStorefront.js');
assert.match(mapper, /memberPriceNumber: variant\.memberPriceNumber/, 'the variant mapper must carry memberPriceNumber');
assert.match(mapper, /memberPriceNumber: product\.memberPriceNumber/, 'the product mapper must carry memberPriceNumber');

console.log('memberPriceNudge selfcheck OK (member price shown to everyone; silent when there is nothing to say)');
