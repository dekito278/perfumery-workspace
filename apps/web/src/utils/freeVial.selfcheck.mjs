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
  buildFreeVialCartItem, freeVialChoices, isFreeVialLine, isFreeVialProduct,
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

console.log(`freeVial selfcheck OK (one ${FREE_VIAL_SIZE} vial per order at ${FREE_VIAL_WEIGHT_GRAM} g, kept out of ${listings} listings, out of the automatic pricing, and out of the sitemap)`);
