// `node src/utils/storefrontTierPrice.selfcheck.mjs`
//
// What a buyer is QUOTED. The order endpoint recomputes independently, so a mistake here does not
// overcharge anyone — it does something arguably worse: it shows one price and charges another.
//
// The second half holds the storefront to silence. A tier lookup that fails, or a migration that has
// not run, must leave the shop exactly as it is: retail is a real price and a visitor who sees it has
// been told nothing false. Studio is the surface that has to complain.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { applyTierPrices } from './tierPricedCatalog.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const money = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;

const catalog = () => [{
  slug: 'sunda', name: 'Sunda', priceNumber: 310000, price: money(310000),
  variants: [
    { id: '10-ml', size: '10 ml', priceNumber: 129000 },
    { id: '30-ml', size: '30 ml', priceNumber: 310000 },
  ],
}];
const index = (rows) => {
  const built = {};
  for (const [variantId, tier, price] of rows) {
    built.sunda = built.sunda || {};
    built.sunda[variantId] = built.sunda[variantId] || {};
    built.sunda[variantId][tier] = price;
  }
  return built;
};

// --- nothing to apply is the same array, not a copy --------------------------------------------------
// Referential identity matters: it is what keeps the shop from re-rendering, and what makes "before the
// migration" and "no tiered pricing at all" literally the same code path.
const plain = catalog();
assert.equal(applyTierPrices(plain, 'retail', {}, money), plain, 'an empty index must return the input array');
assert.equal(applyTierPrices(plain, 'member', {}, money), plain, 'a member with no tier prices changes nothing');
assert.equal(applyTierPrices(plain, 'member', index([['30-ml', 'reseller', 200000]]), money), plain,
  'a price for a tier this visitor is not on must not touch the catalog');
assert.equal(applyTierPrices([], 'member', index([['30-ml', 'member', 1]]), money).length, 0);

// --- the member price reaches both the variant and the product --------------------------------------
const member = applyTierPrices(catalog(), 'member', index([['30-ml', 'member', 280000], ['10-ml', 'member', 115000]]), money);
assert.notEqual(member, plain);
assert.equal(member[0].variants[1].priceNumber, 280000, 'the 30 ml variant must carry the member price');
assert.equal(member[0].variants[1].price, 'Rp 280.000', 'the formatted string must be rewritten with it');
assert.equal(member[0].variants[1].retailPriceNumber, 310000, 'retail must be kept so the page can show what was crossed out');
// The card reads the product price, the detail page the first variant's. One bottle, one price.
assert.equal(member[0].priceNumber, 115000, 'the product price must follow the first variant, as the product form does');
assert.equal(member[0].price, 'Rp 115.000');
assert.equal(member[0].priceTier, 'member');

// A member price on ONE size still has to tag the product, or the page that applies it cannot explain it.
const oneSize = applyTierPrices(catalog(), 'member', index([['30-ml', 'member', 280000]]), money);
assert.equal(oneSize[0].priceTier, 'member', 'a tier price on a single variant must still tag the product');
assert.equal(oneSize[0].variants[0].priceNumber, 129000, 'the untouched size keeps its retail price');
assert.equal(oneSize[0].variants[0].retailPriceNumber, undefined, 'and is returned unchanged, not copied');

// --- a product-level price is the default for every size --------------------------------------------
const allSizes = applyTierPrices(catalog(), 'reseller', index([['', 'reseller', 250000]]), money);
assert.equal(allSizes[0].variants[0].priceNumber, 250000, 'the "all sizes" row must reach the 10 ml');
assert.equal(allSizes[0].variants[1].priceNumber, 250000, 'and the 30 ml');

// A reseller with no reseller price falls to the member one before retail — never above a member.
const ladder = applyTierPrices(catalog(), 'reseller', index([['30-ml', 'member', 280000]]), money);
assert.equal(ladder[0].variants[1].priceNumber, 280000, 'a reseller must not pay more than a member');

// --- overseas is never priced in the shop -----------------------------------------------------------
// It is a destination, quoted by hand. Applying it here would show an overseas price to an Indonesian.
const domestic = catalog();
assert.equal(applyTierPrices(domestic, 'retail', index([['30-ml', 'overseas', 650000]]), money), domestic,
  'an overseas price must not change what the shop shows');
assert.equal(applyTierPrices(domestic, 'member', index([['30-ml', 'overseas', 650000]]), money), domestic,
  'not for a member either — overseas is where the parcel goes, not who is buying');

// --- `loading` survives the rewrite -----------------------------------------------------------------
// Pages read it to tell "no products" from "not loaded yet"; losing it turns a slow network into an
// empty shop with a "belum ada produk" message.
const loadingInput = catalog();
Object.defineProperty(loadingInput, 'loading', { configurable: true, enumerable: false, value: true });
const loadingOut = applyTierPrices(loadingInput, 'member', index([['30-ml', 'member', 280000]]), money);
assert.equal(loadingOut.loading, true, 'the non-enumerable loading flag must be carried across');

// --- the storefront stays silent --------------------------------------------------------------------
const hook = read('hooks', 'useStorefrontProducts.js');
assert.doesNotMatch(hook, /toast|role="alert"|schemaReady/,
  'the storefront must not announce a missing tier schema — retail is a correct answer there');
assert.match(hook, /onAuthStateChange/, 'signing in is what makes someone a member; prices must follow the session');

// --- every buyer-facing surface reads the tiered catalog --------------------------------------------
// Missing one is not a crash, it is a page quoting retail next to a page quoting member.
for (const file of [
  ['hooks', 'useCart.js'], ['pages', 'CatalogPage.jsx'], ['pages', 'HomePage.jsx'],
  ['pages', 'PublicProductDetailPage.jsx'], ['pages', 'CartPage.jsx'],
  ['pages', 'mobile', 'MobileCatalogPage.jsx'], ['pages', 'mobile', 'MobileStorefrontPage.jsx'],
  ['pages', 'mobile', 'MobileProductDetailPage.jsx'], ['pages', 'mobile', 'MobileCartPage.jsx'],
]) {
  const source = read(...file);
  assert.match(source, /useStorefrontProducts/, `${file.join('/')} must read the tier-priced catalog`);
  assert.doesNotMatch(source, /useCatalogProducts/, `${file.join('/')} must not also read the raw catalog`);
}
// The product form is the counter-example: it edits retail, so it must never see a tiered price or the
// owner would save a member price back over the retail one.
for (const file of [['components', 'product', 'ProductForm.jsx'], ['components', 'product', 'MobileProductForm.jsx']]) {
  assert.doesNotMatch(read(...file), /useStorefrontProducts/,
    `${file.join('/')} edits retail prices — a tiered catalog there would be saved back as retail`);
}

// --- the overseas enquiry ---------------------------------------------------------------------------
const enquiry = read('components', 'storefront', 'OverseasInquiryButton.jsx');
assert.match(enquiry, /if \(!phoneNumber \|\| !product\?\.name\) return null;/,
  'no configured number means no button — an enquiry that opens WhatsApp with no recipient is worse than none');
assert.match(enquiry, /belum memesan stok/,
  'the message must say the enquiry does not reserve stock, or someone believes a bottle is being held');
assert.doesNotMatch(enquiry, /addItem|addCartItem|useCart/, 'asking about overseas shipping must not place anything in a cart');

console.log('storefrontTierPrice selfcheck OK (retail is the quiet default; one bottle, one price)');
