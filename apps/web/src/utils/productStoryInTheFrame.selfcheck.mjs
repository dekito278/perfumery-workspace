// `node src/utils/productStoryInTheFrame.selfcheck.mjs`
//
// The shop has one perfume with a story — Ayang-ayang — and until 2026-11-08 the story was a page of its
// own that REPLACED the product page. So the one bottle the atelier wrote a letter for was shaped like no
// other: no photos or price at the top, the cart about 3,500px down, and no stock line, gift vial, "when
// to wear", buyer answers or "you may also like". Dekito, that day: "ayang2 bentukannya beda". He chose
// the same frame as every product, with the story whole in the middle.
//
// What has to stay true:
//   1. there is one product page — nothing is returned in its place;
//   2. the story sits between the buy block and the pyramid;
//   3. the story sells nothing and frames nothing — price, cart, header, footer and head are the page's;
//   4. the English shop is never handed the Indonesian story (it was before English letters existed).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const stripComments = (text) => text.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const page = stripComments(read('pages', 'PublicProductDetailPage.jsx'));
const story = stripComments(read('components', 'storefront', 'ProductStory.jsx'));

// --- 1. One product page ------------------------------------------------------------------------------
// The one exception is a product that does not exist: then the 404 page is shown in place (13 Nov 2026).
assert.doesNotMatch(page, /return <(?!NotFoundPage\b)\w+(Page|Story)\b/, 'the product page hands itself over to another component again');
assert.match(page, /import ProductStory from '@\/components\/storefront\/ProductStory\.jsx'/, 'the product page renders the story itself');

// --- 2. Between the buy block and the pyramid ----------------------------------------------------------
const storyAt = page.indexOf('<ProductStory product={product} story={productStory}');
const buyAt = page.indexOf('ref={addBtnRef}');
const pyramidAt = page.indexOf('aria-labelledby="pdp-pyramid-heading"');
assert.ok(storyAt > 0, 'the product page no longer shows the story');
assert.ok(buyAt > 0 && pyramidAt > 0, 'the buy button or the pyramid moved — this check lost its landmarks');
assert.ok(buyAt < storyAt && storyAt < pyramidAt, 'the story must sit after the buy block and before the pyramid');
assert.match(page.slice(storyAt - 40, storyAt), /productStory \? $/, 'and only when there is a story');

// --- 3. The story sells nothing and frames nothing -----------------------------------------------------
for (const [pattern, what] of [
  [/useCart|addItem\(/, 'a cart'],
  [/<PriceNote|<InternationalPrice|<CardPrice|formatRupiah|usdPriceFor|useOverseasPrice/, 'a price'],
  [/<OverseasInquiryButton|<ShareProductButton|<InternationalShippingQuote/, 'a second set of buy-side buttons'],
  [/<PublicHeader|<StorefrontFooter|<ScrollProgress|<Helmet/, 'a page frame of its own'],
  [/<h1\b/, 'a second h1 (the perfume name is the page\'s h1)'],
  [/['"`]\/checkout|['"`]\/mobile\//, 'a way out through the checkout or the retired phone shop'],
]) {
  assert.doesNotMatch(story, pattern, `ProductStory carries ${what} — the product page around it already does, once`);
}
// Its colours are its own and stay on its own element; the page around keeps the shop's palette.
assert.match(story, /storyRef\.current[\s\S]{0,80}\n[\s\S]{0,40}el\.style\.setProperty\('--imm-bg'/, 'the story sets its colours on its own element');
assert.doesNotMatch(story, /document\.documentElement\.style\.setProperty/, 'and never on the whole document');

// --- 4. The English shop never gets the Indonesian story ------------------------------------------------
const RULE = /isInternational\s*\n?\s*\?\s*getProductStory\(slug, region\)\s*\n?\s*:\s*\(supabaseStory \|\| getProductStory\(slug, region\)\)/;
assert.match(page, RULE, 'the English shop must never fall back to the Indonesian letter');
assert.match(page, /if \(storyLoading\)/, 'the page waits to know whether there is a story, so one tap never shows two different pages');

console.log('productStoryInTheFrame selfcheck OK (one product page; the story in its middle, selling nothing; never Indonesian in the English shop)');
