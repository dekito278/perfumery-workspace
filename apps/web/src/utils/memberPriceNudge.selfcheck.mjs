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
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
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
// --- 5b. A non-member gets the bit, not the number (20261114090000) -----------------------------------------
// The page stopped showing member numbers in #591; the network still carried them to every signed-out
// browser (visitor audit, 13 Nov 2026). The presence-only function is asked FIRST, and the numbered one
// only while the new one is missing.
assert.ok(fn.indexOf("rpc('storefront_member_price_lines'") !== -1
  && fn.indexOf("rpc('storefront_member_price_lines'") < fn.indexOf("rpc('storefront_member_prices'"),
'the presence-only function is asked first');
assert.match(fn, /if \(!isSchemaMissing\(lines\.error\)\) throw lines\.error;/, 'the numbered one only while the new one is missing');
assert.match(fn, /price_number: MEMBER_PRICE_PRESENT/, 'a line is indexed as present, not priced');
{
  const MEMBER_PRICE_PRESENT = Number(service.match(/export const MEMBER_PRICE_PRESENT = (\d+);/)?.[1]);
  assert.equal(MEMBER_PRICE_PRESENT, 1, 'the placeholder sits below any real price, so "strictly lower" still means "there is one"');
  const presence = indexTierPrices([{ slug: 'hug-n-1', variant_id: '30-ml', tier: 'member', price_number: MEMBER_PRICE_PRESENT }]);
  const nudged = attachMemberPrices([product('hug-n-1', 479000, [{ id: '30-ml', priceNumber: 479000 }])], presence);
  assert.ok(nudged[0].variants[0].memberPriceNumber > 0, 'presence alone still raises the note');
  assert.ok(memberSavingForCart([{ productSlug: 'hug-n-1', variantId: '30-ml', priceNumber: 479000, quantity: 1 }], presence) > 0,
    'and the cart still knows to offer membership');
}
const closing = readRaw('..', '..', '..', 'supabase', 'migrations', '20261114090000_member_prices_stay_with_members.sql');
const linesFn = closing.slice(closing.indexOf('function public.storefront_member_price_lines'), closing.indexOf('$$;', closing.indexOf('function public.storefront_member_price_lines')));
assert.match(linesFn, /returns table \(slug text, variant_id text\)/, 'the new function returns no price column at all');
assert.doesNotMatch(linesFn, /price_number\s*$|select[^;]*price_number/m, 'and selects no price');
assert.match(linesFn, /f\.tier = 'member'/, 'member rows only');
assert.match(linesFn, /not public\.storefront_product_is_draft\(p\.tags\)/, 'drafts stay hidden');
assert.match(linesFn, /sc\.effective_at <= now\(\)/, 'a scheduled member price counts once it is in force, as in the numbered function');
assert.match(closing, /revoke execute on function public\.storefront_member_prices\(text\[\]\) from public, anon, authenticated;/,
  'the numbers close to everyone outside the server, PUBLIC included');
assert.match(closing, /grant execute on function public\.storefront_member_price_lines\(text\[\]\) to anon, authenticated;/);
assert.match(fn, /isSchemaMissing\(error\)/, 'and treat a missing function as "no member prices", not as an error the visitor sees');
assert.match(fn, /return \{ index: \{\}/, 'the fallback must be an empty index, so the nudge simply stays away');
assert.doesNotMatch(fn, /^\s*throw error;\s*$/m, 'nothing in this function may rethrow to the caller');
assert.match(service, /'PGRST202'/, 'the code PostgREST actually returns must be recognised');

// --- 6. Order of operations in the hook -------------------------------------------------------------------
const hook = read('hooks', 'useStorefrontProducts.js');
assert.match(hook, /tier === 'retail' \? attachMemberPrices\(priced, memberIndex\) : priced/,
  'the nudge is for retail visitors only — a 5% code member pays above the product member price and must not be nudged');
assert.match(hook, /export const useMemberPrices/, 'the public index must be shared like the tier index, not fetched per page');

// --- 7. The note: right branch, right order, right gate -----------------------------------------------------
const note = read('components', 'storefront', 'PriceNote.jsx');
assert.match(note, /memberPrice < price/, 'the nudge must require the member price to be strictly lower');
// Said, never priced (Dekito, 12 Nov 2026): the member price depends on the community code.
assert.doesNotMatch(note, /formatRupiah\(memberPrice|price - memberPrice/, 'no member NUMBER is shown to a non-member');
assert.match(note, /t\('price\.memberHint'\)/);
for (const language of ['id', 'en']) assert.doesNotMatch(MESSAGES[language]['price.memberHint'], /\{|Rp|\d/, `${language} hint carries no number`);
// The wording moved into the message file when the storefront learned English. What must still hold is
// that the way in is offered at all, in BOTH languages — a number with no button is a tease.
// Since 10 Nov 2026 the way in is the account page, not a sign-in button: signing in alone no longer gives
// the member price (a member code or a paid order here does), and that page says so and takes the code.
assert.match(note, /<Link\s+to="\/customer"[\s\S]{0,200}?t\('price\.howToMember'\)/, 'and must offer the way in, not just the number');
assert.match(MESSAGES.id['price.howToMember'], /member/);
assert.ok(MESSAGES.en['price.howToMember'], 'in English too, or the English shop shows a raw key on the button');
assert.doesNotMatch(note, /loginWithGoogle/, 'a sign-in button here would promise a price that signing in no longer gives');
assert.ok(note.indexOf('memberPriceNumber') < note.indexOf('compareAtPriceNumber'), 'the member nudge must come before the compare-at line, or a discounted product hides the reason to sign in');
assert.ok(note.indexOf('TIER_LABELS[product?.priceTier]') < note.indexOf('memberPriceNumber'), 'a signed-in member sees the tier label, never the nudge');
assert.match(MESSAGES.id['price.memberTier'], /Harga member/, 'and that label is still the words Dekito chose');

// --- 8. Every surface that shows a price shows the member one --------------------------------------------
// The card surfaces route their price through CardPrice now — one component for four places, so the
// member line cannot be present on three cards and missing on the fourth. The assertion follows it.
const cardPrice = read('components', 'storefront', 'CardPrice.jsx');
// Since 12 Nov 2026 a card shows no member price at all — it differs per community code.
assert.doesNotMatch(cardPrice, /memberPriceNumber/, 'CardPrice must not print a member price');
// Every surface that renders a product CARD, related-product strips included: those sat outside the four
// obvious ones and kept showing Indonesian prices under an English product page.
for (const surface of ['pages/CatalogPage.jsx',
  'pages/HomePage.jsx', 'pages/PublicProductDetailPage.jsx']) {
  assert.match(read(...surface.split('/')), /<CardPrice product=\{(?:product|item)\}/,
    `${surface} shows a price, so it must go through CardPrice`);
}
// The phone's own product page printed its member price inline; it retired with the phone storefront
// (2026-10-31). overseasVisitor.selfcheck now holds that no page prints one of its own.
for (const pdp of ['pages/PublicProductDetailPage.jsx']) {
  assert.match(read(...pdp.split('/')), /<PriceNote product=\{product\} variant=\{selectedVariant\}/, `${pdp} must hand PriceNote the chosen variant`);
}

// --- 8b. And no product page escapes by being a different page -------------------------------------------
// The two lists above are written by hand, and one had already grown from four surfaces to six. What
// neither could see is a page that REPLACES a product page: PublicProductDetailPage and
// MobileProductDetailPage both `return <ImmersiveProductPage …>` as soon as a product has a story, so
// their PriceNote never rendered for those products at all. The shop's one immersive story — the page
// this atelier invested most in — quoted the retail price with no way to learn a member price exists.
//
// So the subject forms itself: every page that renders the shared product visual is a page showing a
// product to a buyer. Three are exempt, each for what it IS rather than for its name.
const pagesRoot = join(root, 'pages');
const walkPages = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walkPages(join(dir, entry.name)) : [join(dir, entry.name)]
));
const NOT_SELLING_A_PRICE = new Map([
  ['ProductListPage.jsx', 'Studio: pricing a product to manage it, not offering one to a reader'],
  ['MobileProductListPage.jsx', 'Studio, same'],
  ['CartPage.jsx', 'a line already chosen; the member saving is on the checkout button, checked in section 9'],
  ['CheckoutPage.jsx', 'same'],
  // The English cart. The member discount does not travel (Dekito, 2026-09-24): every line is priced at
  // its export price in dollars, so there is no member price to put beside it — naming one would promise
  // a figure the buyer can never be charged. THE CONDITION: englishShopOrdersOnWhatsApp.selfcheck holds
  // that these two pages never reach memberSavingForCart at all.
  ['InternationalCartPage.jsx', 'the English cart: priced in dollars, where no member price exists'],
]);
const showsAProduct = walkPages(pagesRoot)
  .filter((file) => file.endsWith('.jsx'))
  .map((file) => [file.slice(pagesRoot.length + 1), stripComments(readFileSync(file, 'utf8'))])
  .filter(([, source]) => /<ProductVisual/.test(source));
// Floor lowered from 10 when the phone storefront retired (2026-10-31): its product, catalogue and cart pages went.
// Floor lowered 2026-11-08: the story page that REPLACED the product page (ImmersiveProductPage) is gone —
// the story is a section inside the one product page now (ProductStory), with no price or cart of its own.
assert.ok(showsAProduct.length >= 8,
  `only ${showsAProduct.length} pages render the product visual — the scan is broken, not the code`);

let sellingPages = 0;
for (const [name, source] of showsAProduct) {
  if (NOT_SELLING_A_PRICE.has(name.split('/').pop())) continue;
  assert.match(source, /<CardPrice|<PriceNote/,
    `${name} shows a product to a buyer without the member price beside its own. A visitor there never `
    + 'learns one exists, which is the whole point of the nudge.');
  sellingPages += 1;
}
// Floor lowered from 6 when the phone storefront retired (2026-10-31): home, catalogue, product and story remain.
// Floor lowered 2026-11-08: the story page that REPLACED the product page (ImmersiveProductPage) is gone —
// the story is a section inside the one product page now (ProductStory), with no price or cart of its own.
assert.ok(sellingPages >= 3, `only ${sellingPages} selling pages checked — the exemptions swallowed them`);

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
for (const page of ['pages/CheckoutPage.jsx']) {
  const source = read(...page.split('/'));
  assert.match(source, /memberSavingForCart\(items, memberIndex\)/, `${page} must compute the real saving from the cart`);
  assert.match(source, /memberSaving > 0\s*\?/, `${page} must fall back to the ordinary copy when there is nothing to save`);
  // Since 12 Nov 2026 the amount is NOT printed: the member price depends on the community code, so any
  // one saving is wrong for most members (Dekito: don't show member prices to non-members).
  assert.match(source, /t\('checkout\.signInSaving'\)/, `${page} names the member price without an amount`);
  for (const language of ['id', 'en']) {
    assert.doesNotMatch(MESSAGES[language]['checkout.signInSaving'], /\{amount\}|Rp|\d/, `${language} saving copy carries no number`);
  }
  // Bound to the button's ELSE branch: a bare phrase match once passed while the button's fallback was
  // empty, so the branch itself is asserted.
  assert.match(source, /:\s*t\('m?checkout\.signInPlain'\)/, `${page} must keep the ordinary copy on the button for the no-saving case`);
  // The member price is genuinely true at checkout — anyone completing this form ships to an Indonesian
  // address, and a domestic order does get it. Unlike the welcome page, the English may promise it.
  assert.match(MESSAGES.en['checkout.signInSaving'], /member/i, 'and in English it may say so, because here it is true');
}

// --- 10a. And the sentence has to FIT ---------------------------------------------------------------------
// Measured on production, 375px, signed out: "Masuk dengan Google — hemat Rp 29.000 dengan harga member"
// was 367px of text inside a 327px box and was cut off in the middle of the last word. The button that
// explains why signing in is worth money could not finish its own sentence.
//
// The shared Button sets whitespace-nowrap, so a fixed height cannot wrap and clips instead. The phone is
// the surface with no room to spare, and the English labels are longer than the Indonesian ones.
// One checkout serves the phone since 2026-10-31, so the button checked is the one in CheckoutPage. It is
// a native <button class="ng-btn">, and .ng-btn sets min-height, never height or nowrap — both are held.
const phoneCheckout = read('pages', 'CheckoutPage.jsx');
const memberButton = phoneCheckout.match(/<(?:Button|button)[^>]*onClick=\{handleGoogleLogin\}[^>]*>/);
assert.ok(memberButton, 'the checkout must still offer the member sign-in');
assert.match(memberButton[0], /min-h-/, 'a fixed height cannot grow with the sentence — min-h can');
assert.doesNotMatch(memberButton[0], /whitespace-nowrap|truncate/, 'and nothing on it may forbid the sentence to wrap');
// (?<!min-) because \b sits between the hyphen and the h, so a naive \bh-12\b matches inside min-h-12.
assert.doesNotMatch(memberButton[0], /className="[^"]*(?<![\w-])h-(?:\d|\[)/, 'the fixed height must not come back alongside it');
if (/\bng-btn\b/.test(memberButton[0])) {
  const btnRule = (read('styles', 'naskah.css').match(/^\.ng-btn \{[^}]*\}/m) || [''])[0];
  assert.ok(btnRule, 'the .ng-btn rule must be findable');
  assert.doesNotMatch(btnRule, /white-space:\s*nowrap|(?:^|[^-])height:/, '.ng-btn itself must not fix the height or forbid wrapping');
}

// --- 10b. And the CART, which is where the total is actually weighed ------------------------------------
// Every other storefront surface names the member price — home, catalog, product, the account page — and
// the checkout one step later names the exact amount. The cart, the one screen that shows the total and
// asks for a decision, said nothing at all. Measured on production: Rp 103.000 invisible on a two-line
// cart, then stated in full on the very next screen.
//
// Built from the keys the other pages already use, so there is no second wording to keep in step.
for (const page of ['pages/CartPage.jsx']) {
  const source = read(...page.split('/'));
  assert.match(source, /memberSavingForCart\(items, memberIndex\)/,
    `${page} must compute the real saving from the cart, the same way both checkouts do`);
  // Its reason was already half of what Dekito decided on 11 Oct: "a signed-in member is not nudged".
  // The property now lives in shouldOfferMemberPrice, which asks BOTH halves — is there anything to save,
  // and is this viewer a member already (the server-resolved tier, since 10 Nov 2026 no longer the same
  // thing as being signed in). memberNudgeIsHonest.selfcheck.mjs runs that predicate over every state;
  // here the page only has to defer to it.
  assert.match(source, /offerMemberSignIn \?/,
    `${page} must stay silent when there is nothing to save, and when the viewer cannot act on it`);
  assert.match(source, /shouldOfferMemberPrice\(\{ saving: memberSaving, isMember: tier === 'member' \|\| tier === 'reseller' \}\)/,
    `${page} must ask the shared predicate rather than branching on the raw saving`);
  // Since 12 Nov 2026: said, not priced — the member price depends on the community code.
  assert.match(source, /t\('price\.memberHint'\)/, `${page} must say member pricing exists`);
  assert.doesNotMatch(source, /formatTotal\(memberSaving\)/, `${page} must not print a member saving`);
  // And a way to act on it, or the number is a tease.
  assert.match(source, /customer['"]/, `${page} must offer the door to the account, not just the number`);
}

// --- 11. The public mapper must CARRY the field, not just the pages RENDER it -----------------------------
// This is the hole the first version of this guard had. toPublicFragrance rebuilds every product and
// variant from a hand-written field list; it named retailPriceNumber, priceTier and compareAtPriceNumber
// and not memberPriceNumber, so all seven surfaces dropped it before reading it — and the nudge rendered
// nowhere on the live site, found only by looking. Same omission compareAtPriceNumber once had, same way.
//
// And the premise above was only half right, which is worth writing down: the mapper DID name
// memberPriceNumber and retailPriceNumber on the variant — it just named them off the output of
// normalizeProductVariants, which rebuilds each variant through a five-field whitelist and had already
// dropped both. The mapper carried undefined and this guard read the line and called it carried. So the
// rule now is where the value comes FROM, not that the key appears.
const mapper = read('data', 'publicStorefront.js');
assert.match(mapper, /memberPriceNumber: [^,\n]*memberPriceNumber/, 'the variant mapper must carry memberPriceNumber');
assert.match(mapper, /memberPriceNumber: product\.memberPriceNumber/, 'the product mapper must carry memberPriceNumber');
assert.match(mapper, /const bySourceId = new Map\(/,
  "the variant mapper must read the tier fields off the product's own variants — normalizeProductVariants drops them");
for (const field of ['memberPriceNumber', 'retailPriceNumber']) {
  assert.match(mapper, new RegExp(`${field}: source\\.${field}`),
    `${field} must come from the source variant, not from the normalizer that discarded it`);
}

console.log('memberPriceNudge selfcheck OK (member price shown to everyone; silent when there is nothing to say)');
