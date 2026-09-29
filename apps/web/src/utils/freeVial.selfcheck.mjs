// `node src/utils/freeVial.selfcheck.mjs`
//
// The free gift vial is stock that is NOT for sale, living in the table where every other row is. That is
// a deliberate trade (see utils/freeVial.js) and it has a price: the row breaks two things the catalogue
// assumes about its contents — a product costs more than nothing, and a variant is a size you can buy.
//
// So the row has to stay out of exactly three places, and this guard checks all three at their source
// rather than trusting the comment that names them. It also checks the weight, which is the one number
// here that costs real money when it is wrong.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import {
  FREE_VIAL_SIZE, FREE_VIAL_TAG, FREE_VIAL_WEIGHT_GRAM, FREE_VIALS_PER_ORDER,
  FREE_VIAL_PRICE_LABEL,
  buildFreeVialCartItem, dropUnfulfillableGift, freeVialChoices, isFreeVialLine, isFreeVialProduct,
  splitFreeVialLines, weighFreeVialLines,
} from './freeVial.js';
import { DEFAULT_ITEM_WEIGHT_GRAM, isWeighedSize, itemWeightGram, totalItemWeightGram } from './itemWeight.js';
import { planAutoTierPrices } from './autoTierPrices.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// productCatalogService speaks '@/...' and reaches Supabase, so the four small pieces that decide
// visibility are lifted out of it and RUN — asserting that the FILE mentions the vial rule would pass
// while the one expression that matters had stopped calling it.
const service = read('services', 'productCatalogService.js');
const lift = (pattern, what) => {
  const found = service.match(pattern);
  assert.ok(found, `could not lift ${what} out of productCatalogService — update this guard, not the app`);
  return found[0];
};
const visibility = await import(`data:text/javascript;base64,${Buffer.from([
  "import { isFreeVialProduct } from 'file://" + join(root, 'utils', 'freeVial.js') + "';",
  lift(/const PRODUCT_DRAFT_TAG = '[^']*';/, 'the draft tag'),
  lift(/const splitList = [\s\S]*?\n\};/, 'splitList'),
  lift(/export const isProductDraft = [\s\S]*?\n\);/, 'isProductDraft'),
  lift(/export const isProductVisibleInStorefront = [\s\S]*?\n\);/, 'isProductVisibleInStorefront'),
].join('\n').replace(/^export /gm, 'export '), 'utf8').toString('base64')}`);
const { isProductVisibleInStorefront } = visibility;

const vial = { name: 'Vial hadiah', tags: [FREE_VIAL_TAG], variants: [{ id: 'hug-n-1', size: 'HUG N°1', priceNumber: 0, stock: 40 }] };
const bottle = { name: 'HUG N°1', tags: ['Limited'], variants: [{ id: '30-ml', size: '30 ml', priceNumber: 359000, stock: 5 }] };

// --- 1. Reading the tag, in both shapes it arrives in --------------------------------------------------
// The database hands back an array; older rows and the product form hand back a comma-separated string.
assert.equal(isFreeVialProduct(vial), true);
assert.equal(isFreeVialProduct({ tags: `Limited, ${FREE_VIAL_TAG}` }), true, 'a comma-separated tag string counts');
assert.equal(isFreeVialProduct({ tags: ['vial HADIAH'] }), true, 'the tag is matched without regard to case');
assert.equal(isFreeVialProduct(bottle), false);
assert.equal(isFreeVialProduct({}), false, 'a product with no tags at all is not a vial');
assert.equal(isFreeVialProduct(), false, 'called with nothing, no crash');

// --- 2. It is one per ORDER, and that is a decision, not a default -------------------------------------
assert.equal(FREE_VIALS_PER_ORDER, 1, "Dekito's decision, 2026-09-29: per order, not per bottle");

// --- 3. The weight, which is where this costs money ----------------------------------------------------
// Unmeasured, a 2 ml vial falls to the 300 g default — heavier than a 30 ml bottle — and every order
// carrying a gift is quoted freight for 300 g that is not in the box.
assert.equal(FREE_VIAL_WEIGHT_GRAM, 10, "Dekito's figure, 2026-09-29");
assert.ok(FREE_VIAL_WEIGHT_GRAM < DEFAULT_ITEM_WEIGHT_GRAM,
  `a vial weighing ${FREE_VIAL_WEIGHT_GRAM} g must not be heavier than the ${DEFAULT_ITEM_WEIGHT_GRAM} g fallback it exists to avoid`);
assert.equal(itemWeightGram(FREE_VIAL_SIZE), FREE_VIAL_WEIGHT_GRAM,
  'the vial weight must come from the one weight table, not from a second copy of the number');
assert.equal(isWeighedSize(FREE_VIAL_SIZE), true, 'so Studio stops warning that this size was never weighed');
// The bottles Dekito measured on 2026-09-13 are untouched by the new entry.
assert.deepEqual(
  [10, 30, 50, 100].map((ml) => itemWeightGram(`${ml} ml`)),
  [100, 250, 350, 650],
  'adding the vial must not move a bottle weight',
);
assert.equal(itemWeightGram('7 ml'), DEFAULT_ITEM_WEIGHT_GRAM, 'and an unweighed size still falls back');

// --- 4. Out of the storefront listings -----------------------------------------------------------------
assert.equal(isProductVisibleInStorefront(bottle), true);
assert.equal(isProductVisibleInStorefront(vial), false, 'the vial row is stock, not something to sell');

// Every page that lists products asks that one helper. The subject is derived: a page rendering a product
// list has no business writing its own idea of what belongs in the catalogue.
const pages = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel);
    else if (entry.name.endsWith('.jsx')) pages.push(rel);
  }
};
walk('pages');
let listings = 0;
for (const page of pages) {
  const source = read(...page.split('/'));
  if (!/isProductVisibleInStorefront/.test(source)) continue;
  listings += 1;
  assert.match(source, /\.filter\(isProductVisibleInStorefront\)|filter\(\(?\w+\)? => isProductVisibleInStorefront/,
    `${page} imports the visibility helper but does not filter with it`);
}
assert.ok(listings >= 8, `only ${listings} product listings found — the walk lost them`);

// --- 5. Out of the automatic member/export pricing -----------------------------------------------------
// The obvious fixture does NOT test this. A vial variant priced at Rp 0 is dropped by retailByVariant
// before the rule ever runs, so removing the exclusion changes nothing and the sabotage passes — which
// is what happened the first time this was written. The branch is only reached once a vial variant
// carries a number, which is exactly what happens the day Dekito records what a vial is worth.
const pricedVial = { ...vial, variants: [{ id: 'hug-n-1', size: 'HUG N°1', priceNumber: 25000, stock: 40 }] };
assert.deepEqual(planAutoTierPrices({ product: pricedVial }), { writes: [], kept: [] },
  'a gift has no member price and no export price, even once its worth is written down');
assert.deepEqual(planAutoTierPrices({ product: vial }), { writes: [], kept: [] },
  'and a vial with no value at all is priced no differently');
assert.ok(planAutoTierPrices({ product: bottle }).writes.length === 2,
  'and an ordinary product still gets both — the exclusion must not be a blanket off switch');

// --- 6. Out of the build's product fetch ---------------------------------------------------------------
// Prerendering /catalog/<vial> and listing it in the sitemap would advertise a page selling nothing for
// Rp 0. Checked in the build's own source, which is plain node and cannot be imported here without
// reaching Supabase.
const artifacts = readFileSync(join(root, '..', 'tools', 'seo-artifacts.mjs'), 'utf8');
assert.match(artifacts, /import \{ isFreeVialProduct \} from '\.\.\/src\/utils\/freeVial\.js';/,
  'the build must read the same rule rather than a copy of the tag');
assert.match(artifacts, /\.filter\(\(row\) => !isFreeVialProduct\(\{ tags: row\.tags \}\)\)/,
  'the build must drop the vial rows before prerendering and sitemapping them');

// --- 7. The gift weighs a vial, whatever its variant is called -----------------------------------------
// Nothing here can see the labels Dekito types into the vial variants, and an aroma name parses to no
// millilitres at all. So the weight is NOT left to the label: a line the tag says is a vial weighs a
// vial. Measured on the rule itself rather than argued about.
const cartWithGift = [
  { size: '30 ml', quantity: 2 },
  { size: 'HUG N°1', quantity: 1, tags: [FREE_VIAL_TAG] },
];
const naive = totalItemWeightGram(cartWithGift);
const ruled = totalItemWeightGram(weighFreeVialLines(cartWithGift));
assert.equal(ruled, 250 * 2 + FREE_VIAL_WEIGHT_GRAM, 'two bottles and one vial');
assert.equal(naive - ruled, DEFAULT_ITEM_WEIGHT_GRAM - FREE_VIAL_WEIGHT_GRAM,
  `without the rule the parcel is quoted ${naive - ruled} g that is not in the box`);
assert.deepEqual(weighFreeVialLines([{ size: '30 ml', quantity: 1 }]), [{ size: '30 ml', quantity: 1 }],
  'an ordinary line is left exactly as it was');
assert.deepEqual(weighFreeVialLines(), [], 'called with nothing, no crash');
// A bought line priced at zero — a fully discounted order — is NOT the gift. Identity comes from the
// tag, never from the price.
assert.equal(isFreeVialLine({ size: '30 ml', priceNumber: 0 }), false);
assert.equal(isFreeVialLine({ tags: [FREE_VIAL_TAG] }), true);

// --- 8. Both sides apply that rule, and the same one ---------------------------------------------------
// The browser quotes the freight, the endpoint charges it. A rule applied to one of them is a rule that
// does not hold — it is the shape of "shown one courier fee, charged another".
const shipping = read('services', 'shippingService.js');
assert.match(shipping, /totalItemWeightGram\(weighFreeVialLines\(items\), fallback\)/,
  'the browser must weigh the gift as a vial before it quotes');
const endpoint = readFileSync(join(root, '..', 'api', 'orders', 'create.js'), 'utf8');
assert.match(endpoint, /totalItemWeightGram\(weighFreeVialLines\(weighedLines\), itemWeight\)/,
  'and so must the endpoint that charges');

// --- 9. The endpoint decides the gift from the PRODUCT, and refuses a second one -----------------------
// All of it server-side, because all of it is worth tampering with: a client that sends its own price,
// its own quantity, or a second vial line.
assert.match(endpoint, /select=id,slug,name,category,price_number,variants,tags/,
  'the resolver must read the tags, or it cannot tell a gift from a sale');
assert.match(endpoint, /const isVial = isFreeVialProduct\(product\);/,
  'decided from the product the endpoint just fetched, never from the line the client sent');
assert.match(endpoint, /if \(isVial\) \{[\s\S]{0,200}?unitPrice = 0;/,
  'the gift costs nothing whatever the variant says');
assert.match(endpoint, /if \(freeVials >= FREE_VIALS_PER_ORDER\) \{[\s\S]{0,120}?throw new Error/,
  'a second vial line must be refused, not quietly honoured');
assert.match(endpoint, /const lineQuantity = isVial \? FREE_VIALS_PER_ORDER : qty;/,
  'and one line may not carry fifty of them');

// --- 10. Which aromas are offered: in stock, and that is the whole switch -------------------------------
const choices = freeVialChoices({
  variants: [
    { id: 'hug-n-1', size: 'HUG N°1', stock: 4 },
    { id: 'sudra', size: 'Sudra', stock: 0 },
    { id: '', size: 'nameless', stock: 9 },
    { id: 'maskumambang', size: 'Maskumambang', stock: 1 },
  ],
});
assert.deepEqual(choices.map((choice) => choice.variantId), ['hug-n-1', 'maskumambang'],
  'an aroma with no stock left simply stops being offered — that is the whole switch');
assert.deepEqual(freeVialChoices(), [], 'and a vial product that does not exist yet offers nothing');
assert.equal(choices.length, 2);

// --- 11. The gift is not a cart line, and one replaces the other ---------------------------------------
const chosen = buildFreeVialCartItem({
  vialProduct: { id: 'v1', slug: 'vial-hadiah', name: 'Vial hadiah 2 ml', category: 'Vial' },
  choice: { variantId: 'hug-n-1', label: 'HUG N°1', stock: 4 },
});
assert.equal(chosen.priceNumber, 0, 'the gift costs nothing in the cart either');
assert.equal(chosen.quantity, FREE_VIALS_PER_ORDER);
assert.deepEqual(chosen.tags, [FREE_VIAL_TAG], 'and carries the tag every rule here reads');
assert.equal(isFreeVialLine(chosen), true, 'so the cart line and the order line answer the same question');
assert.match(chosen.name, /Vial hadiah 2 ml — HUG N°1/,
  "the name is the owner's own words — it is the only thing on the packing slip saying this was not paid for");
assert.ok(chosen.slug.includes('hug-n-1'), 'two aromas of one product must not collide on the cart key');

const { lines, gift } = splitFreeVialLines([{ slug: 'bottle', name: 'HUG N°1' }, chosen]);
assert.deepEqual(lines.map((line) => line.slug), ['bottle'], 'the gift never renders as a purchased line');
assert.equal(gift.slug, chosen.slug);
// A cart that somehow held two must not show one of them as a purchase.
assert.equal(splitFreeVialLines([chosen, { ...chosen, slug: 'x' }]).lines.length, 0);
assert.deepEqual(splitFreeVialLines().lines, [], 'called with nothing, no crash');

// Both carts render the bought lines, never the raw cart, and both hand the picker the same writer.
for (const page of ['pages/CartPage.jsx', 'pages/mobile/MobileCartPage.jsx']) {
  const source = read(...page.split('/'));
  assert.match(source, /const \{ lines: boughtLines \} = splitFreeVialLines\(items\);/,
    `${page} must separate the gift from what was bought`);
  assert.match(source, /boughtLines\.map\(/, `${page} must render the bought lines, not the raw cart`);
  assert.doesNotMatch(source, /\{items\.map\(/, `${page} still renders the raw cart somewhere — the gift would appear as a Rp 0 purchase`);
  assert.match(source, /<FreeVialPicker items=\{items\} products=\{\w+\} onPick=\{setGift\} \/>/,
    `${page} must show the picker, and hand it the whole cart so it can see the current choice`);
}

// One writer for the gift, so picking a second aroma REPLACES the first rather than stacking.
const cart = read('services', 'cartService.js');
assert.match(cart, /const items = readCart\(\)\.filter\(\(line\) => !isFreeVialLine\(line\)\);/,
  'setFreeVialCartItem must drop every vial line before writing the new one');

// The picker shows nothing until there is something to show: no vial product, no aroma in stock, or an
// empty cart. A picker offering a gift the shop cannot pack is worse than no picker.
const picker = read('components', 'storefront', 'FreeVialPicker.jsx');
assert.match(picker, /if \(!vialProduct \|\| !choices\.length \|\| !lines\.length\) return null;/,
  'the picker must stay invisible until the vial product exists, has stock, and the cart has something in it');
// Its strings are in the message file in both languages, like every other storefront string.
for (const key of ['cart.giftTitle', 'cart.giftBody', 'cart.giftChosen', 'cart.giftRemove']) {
  assert.match(picker, new RegExp(`'${key.replace('.', '\\.')}'`), `the picker uses ${key}`);
}

// --- 12. A gift never prints as "Rp 0", on any screen that prints a price --------------------------------
// Measured on the running shop, 2026-09-29: the cart kept the gift out of its list correctly, and the
// CHECKOUT summary right after it printed "Vial hadiah 2 ml — HUG N°1 · Qty 1 · Rp 0". A zero price reads
// as a line the shop failed to price, and on a packing sheet it reads as something to charge for.
assert.equal(FREE_VIAL_PRICE_LABEL, 'Gratis');
assert.equal(buildFreeVialCartItem({ vialProduct: {}, choice: {} }).price, FREE_VIAL_PRICE_LABEL);

// Six order screens all render `item.price || formatTotal(...)`, so the endpoint writing the word is what
// fixes every one of them at once. The subject is derived, not listed.
const orderScreens = [];
const walkPages = (dir) => {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walkPages(rel);
    else if (entry.name.endsWith('.jsx') && /item\.price \|\| formatTotal\(/.test(read(...rel.split('/')))) orderScreens.push(rel);
  }
};
walkPages('pages');
// The two a BUYER opens, named because losing either of them from the derived set is indistinguishable
// from the set being smaller — and those are the two where a zero price is read by someone who cannot
// ask what it means.
for (const opened of ['pages/CustomerInvoicePage.jsx', 'pages/CustomerPortalPage.jsx']) {
  assert.ok(orderScreens.includes(opened),
    `${opened} no longer prints its line price as \`item.price || formatTotal(...)\`, so the word the `
    + 'endpoint writes does not reach it. Whatever it prints instead has to handle the gift itself.');
}
assert.ok(orderScreens.length >= 6,
  `only ${orderScreens.length} order screens print a line price — the scan is more likely broken than the code`);

const endpointSource = readFileSync(join(root, '..', 'api', 'orders', 'create.js'), 'utf8');
assert.match(endpointSource, /price: isVial \? FREE_VIAL_PRICE_LABEL : rupiah\(unitPrice\)/,
  'the endpoint must write the word, which is what those screens read');

// And each screen's own price expression is LIFTED AND RUN, not matched. A pattern that appears in a
// file proves the file contains it; running it proves the buyer reads "Gratis". The invoice and the
// portal are the two a buyer opens, and neither can be reached from here without a real order — so the
// expression is the closest thing to the page that can actually be executed.
const giftItem = { price: FREE_VIAL_PRICE_LABEL, priceNumber: 0, quantity: 1, tags: [FREE_VIAL_TAG] };
const boughtItem = { price: 'Rp 718.000', priceNumber: 359000, quantity: 2, tags: [] };
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
for (const page of orderScreens) {
  const expression = read(...page.split('/')).match(/item\.price \|\| formatTotal\([^)]*\)/)?.[0];
  assert.ok(expression, `${page} no longer prefers the line's own price word — re-derive this guard`);
  const render = new Function('item', 'line', 'formatTotal', `return (${expression});`);
  assert.equal(render(giftItem, { originalTotal: 0 }, money), FREE_VIAL_PRICE_LABEL,
    `${page} prints "${render(giftItem, { originalTotal: 0 }, money)}" for the gift instead of `
    + `"${FREE_VIAL_PRICE_LABEL}" — a buyer reads a zero price as a line the shop failed to price`);
  assert.equal(render(boughtItem, { originalTotal: 718000 }, money), 'Rp 718.000',
    `${page} must still print a real price for a line that was paid for`);
}

// And the two checkout summaries, which compute the amount themselves instead of reading item.price.
for (const page of ['pages/CheckoutPage.jsx', 'pages/mobile/MobileCheckoutPage.jsx']) {
  assert.match(read(...page.split('/')), /isFreeVialLine\(item\) \? FREE_VIAL_PRICE_LABEL :/,
    `${page} computes the line total itself, so it has to say the word itself`);
}

// The sheet Dekito packs from names the gift whatever he called the vial product. Without this the only
// thing marking it is a product name he chose, which nothing here can see.
const label = read('utils', 'shippingLabelPdf.js');
assert.match(label, /isFreeVialLine\(item\) \? ` \(\$\{FREE_VIAL_PRICE_LABEL\}\)` : ''/,
  'the shipping label must mark the gift line');

// --- 13. An order item carries ONLY the gift tag, never the product's own -------------------------------
// The endpoint reads storefront_products, the base table, whose tags carry the internal ones the public
// view strips — batch ids, stock corrections, and the per-bottle COGS. Copying them onto an order item
// would publish Dekito's costs to the buyer's portal and invoice payload. Found by writing it wrong first.
assert.match(endpointSource, /tags: isVial \? \[FREE_VIAL_TAG\] : \[\] \}\);/,
  'an order line may carry the gift tag and nothing else');
assert.doesNotMatch(endpointSource, /tags: product\.tags/,
  "the product's own tags must never reach an order item — they carry the COGS");

// --- 14. The badge counts what the buyer is BUYING ------------------------------------------------------
// Measured on the running shop while testing the picker: a cart holding two bottles and one gift showed
// `Keranjang, 3 item`. The gift is not a line on either cart page — it lives in the picker — so the badge
// read 3 above a list of 2, and the first thought that provokes is "what did I add by accident".
//
// Two counts, because two questions get asked and they have different answers: the PARCEL really does
// hold three things, and that is what the order and the WhatsApp draft say (api/orders/create.js counts
// its resolved lines the same way). Only what a BUYER reads had to change.
const cartSummarySource = read('services', 'cartService.js')
  .match(/export const getCartSummary = [\s\S]*?\n\};/)?.[0];
assert.ok(cartSummarySource, 'could not lift getCartSummary to run it — update this guard');
const getCartSummary = new Function('isFreeVialLine', `${cartSummarySource.replace('export ', '')}\nreturn getCartSummary;`)(isFreeVialLine);

const twoBottlesAndAGift = [
  { name: 'HUG N°1', quantity: 2, priceNumber: 359000 },
  { name: 'Vial hadiah — Maskumambang', quantity: 1, priceNumber: 0, tags: [FREE_VIAL_TAG] },
];
const summary = getCartSummary(twoBottlesAndAGift);
assert.equal(summary.boughtQuantity, 2, 'the badge counts the bottles, not the gift');
assert.equal(summary.quantity, 3, 'and the parcel still holds three things, which is what the order says');
assert.equal(summary.subtotal, 718000, 'a gift adds nothing to the subtotal either way');
assert.deepEqual(getCartSummary([]), { quantity: 0, boughtQuantity: 0, subtotal: 0 }, 'an empty cart counts nothing');

// Every badge and item-count a buyer reads uses the bought count; the ORDER keeps the parcel count.
for (const screen of [
  'components/storefront/PublicHeader.jsx',
  'layouts/MobileCommerceLayout.jsx',
  'pages/mobile/MobileCartPage.jsx',
  'pages/mobile/MobileCheckoutPage.jsx',
]) {
  const source = read(...screen.split('/'));
  assert.match(source, /summary\.boughtQuantity/, `${screen} shows the buyer a count, so it counts what they are buying`);
  assert.doesNotMatch(source, /summary\.quantity/, `${screen} must not show the parcel count to a buyer`);
}
assert.match(read('hooks', 'useCheckoutFlow.js'), /quantity: summary\.quantity,/,
  'the ORDER keeps the parcel count — three things go in the box, and the endpoint counts them the same way');

// --- 15. A gift that ran out must not stop a paid order -------------------------------------------------
// reconcileCartLines flags a line `outOfStock` when its variant hits zero and `unavailable` when its
// product leaves the catalogue. For a BOUGHT line that is exactly right — the buyer has to be told
// before they pay. For the gift it was three separate problems, each worse than simply not giving it:
// useCheckoutFlow's `blockedItems` made canSubmitCheckout false, so a free vial running out stopped a
// paid order; both cart pages raised a red "unavailable" alert naming a line that is not in the list;
// and had it got through, api/orders/create.js would have deducted inventory for it and rolled the whole
// order back when that failed.
const ranOutGift = { ...chosen, outOfStock: true };
const ranOutBottle = { name: 'HUG N°1', quantity: 2, priceNumber: 359000, outOfStock: true };
const goneProduct = { ...chosen, unavailable: true };

assert.deepEqual(dropUnfulfillableGift([ranOutGift]), [], 'a gift whose aroma ran out leaves the cart');
assert.deepEqual(dropUnfulfillableGift([goneProduct]), [], 'and so does one whose product left the catalogue');
assert.deepEqual(dropUnfulfillableGift([ranOutBottle]), [ranOutBottle],
  'a BOUGHT line that ran out is KEPT and stays flagged — the buyer has to be told before they pay, and '
  + 'silently dropping it would be the opposite mistake');
assert.deepEqual(dropUnfulfillableGift([chosen]), [chosen], 'a gift the shop can still hand over stays');
assert.deepEqual(dropUnfulfillableGift(), [], 'called with nothing, no crash');

// Dropped at the ONE place every consumer reads from: the cart pages, both checkouts, the badge and the
// order payload all take the same reconciled list.
const cartHook = read('hooks', 'useCart.js');
assert.match(cartHook, /dropUnfulfillableGift\(reconcileCartLines\(storedItems, catalog\)\)/,
  'useCart must drop it before anything downstream can block on it');

// And the thing it would have blocked still blocks on a bought line, which is the point of that filter.
assert.match(read('hooks', 'useCheckoutFlow.js'),
  /const blockedItems = items\.filter\(\(item\) => item\.unavailable \|\| item\.outOfStock\);/,
  'checkout must still refuse to submit when a line the buyer is PAYING for cannot be fulfilled');

// --- 16. A gift does not help clear a voucher threshold -------------------------------------------------
// An unrestricted voucher matches every line, so the gift counted toward minimumQuantity: one bottle and
// the vial the shop gave away cleared a threshold Dekito set to mean two bottles. It never moved the
// eligible SUBTOTAL — a gift is priced at nothing — which is exactly why the quantity rule was the one
// that slipped. The endpoint validates against its own server-resolved lines, so this is the real rule
// on both sides rather than a client courtesy.
const { getVoucherEligibleQuantity, getVoucherEligibleSubtotal } = await import('./voucherValidation.js');
const oneBottleAndAGift = [
  { slug: 'hug-n-1', category: 'Limited', quantity: 1, priceNumber: 359000 },
  { slug: 'vial-hadiah', category: 'Vial', quantity: 1, priceNumber: 0, tags: [FREE_VIAL_TAG] },
];
const anyVoucher = {};
assert.equal(getVoucherEligibleQuantity(anyVoucher, oneBottleAndAGift), 1,
  'the gift must not count toward a voucher minimum — "buy 2" means two bottles');
assert.equal(getVoucherEligibleSubtotal(anyVoucher, oneBottleAndAGift, 359000), 359000,
  'and the money a voucher may discount is unchanged, because a gift was always worth nothing');
// The must-pass half: two real bottles still clear a minimum of two.
assert.equal(getVoucherEligibleQuantity(anyVoucher, [{ slug: 'hug-n-1', quantity: 2, priceNumber: 359000 }]), 2,
  'two bottles still count as two — excluding the gift must not start excluding purchases');
// And the distinction that matters: identity comes from the TAG, never from the price being zero. A
// bottle discounted to nothing is still something the buyer chose, and it still counts. Without this
// line, filtering on `priceNumber > 0` instead of on the tag passes every other assertion here.
assert.equal(getVoucherEligibleQuantity(anyVoucher, [{ slug: 'hug-n-1', quantity: 1, priceNumber: 0 }]), 1,
  'a bought line priced at zero is a purchase, not a gift — the tag is what tells them apart');

// --- 17. "Pesan lagi" must not carry the old gift back into the cart -----------------------------------
// The portal refills the cart from a past order and hands the buyer to the normal checkout. The order's
// lines include the gift — api/orders/create.js writes `tags: [FREE_VIAL_TAG]` onto it — and the copy
// that landed in the cart lost them: reconcileCartLines re-derives price, stock, category and images
// from the live catalog on every read, but never tags. So the picker saw no gift, offered a second one,
// and the endpoint refused the order outright ("An order carries at most 1 free vial"). The buyer could
// not check out at all, from a cart the shop had built for her.
const pastOrderLines = [
  { slug: 'hug-n-1', name: 'Hug n.1', quantity: 2, priceNumber: 359000, price: 'Rp 359.000', tags: [] },
  { slug: 'vial-hadiah', name: 'Vial hadiah', quantity: 1, priceNumber: 0, price: FREE_VIAL_PRICE_LABEL, tags: [FREE_VIAL_TAG] },
];
const reordered = splitFreeVialLines(pastOrderLines).lines;
assert.deepEqual(reordered.map((line) => line.slug), ['hug-n-1'],
  'reordering must copy back what the buyer BOUGHT — the gift is a per-order promotion, and she picks a '
  + 'fresh one against stock that is live today');
// The must-pass half, and the direction that matters more: a reorder that copies nothing back is a
// broken button. Two bottles bought, two bottles returned, quantities intact.
assert.equal(reordered[0].quantity, 2, 'and it must copy the quantity she actually ordered');
// A gift-only order cannot exist (a gift needs a purchase), but the empty case must not throw either.
assert.deepEqual(splitFreeVialLines([]).lines, [], 'an order with no lines reorders to no lines');

// And the wiring: the portal is a component closure this guard cannot import, so the assertion is that
// the reorder reads its lines THROUGH the split. Comments first — the note above the handler explains
// the trap, and a text search that counts the explanation as the fix is a guard nobody can satisfy.
const portalSource = read('pages', 'CustomerPortalPage.jsx')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
assert.match(portalSource, /const productItems = splitFreeVialLines\(getOrderProductItems\(order\)\)\.lines;/,
  '"Pesan lagi" must take the bought lines out of the past order, not every line in it');
assert.match(portalSource, /import \{ splitFreeVialLines \} from '@\/utils\/freeVial\.js';/,
  'and it must be the real helper, so the rule stays in one place');

console.log(`freeVial selfcheck OK (one ${FREE_VIAL_SIZE} vial per order at ${FREE_VIAL_WEIGHT_GRAM} g, kept out of ${listings} listings, out of the automatic pricing, and out of the sitemap)`);
