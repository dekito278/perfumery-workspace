// `node src/utils/theStoryLinkGoesBothWays.selfcheck.mjs`
//
// journal_posts.related_product_slug joins a story to a perfume. Until 2026-10-23 it was only ever
// read in ONE direction: JournalRelatedProduct puts the perfume at the end of the article, for the
// reason written in that file — "a reader finished and had nowhere to go".
//
// The product page had the same hole and the bigger audience. Almost everyone arrives at a perfume
// before they arrive at a story, and nothing on the page said a story existed. The journal has one
// article today, it is about a bottle in the catalogue, and that bottle's page did not mention it.
//
// So: same column, read both ways, with the same restraint on both ends.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. Both directions exist, and both read the same column ---------------------------------------
const toProduct = read('components', 'journal', 'JournalRelatedProduct.jsx');
const toStory = read('components', 'storefront', 'ProductStoryLink.jsx');
for (const [name, body] of [['JournalRelatedProduct', toProduct], ['ProductStoryLink', toStory]]) {
  assert.match(body, /related_product_slug/,
    `${name} must use the column that already joins the two, not a second idea of what relates to what`);
}

// --- 2. Nothing is rendered when there is nothing to offer -------------------------------------------
// A heading with an empty space under it is worse than no heading, and a product can be written about
// years after the page was built — or never.
assert.match(toStory, /if \(!post\) return null;/,
  'the product page must render nothing when no story points at this perfume');
assert.match(toStory, /\.catch\(\(\) =>/,
  'a failed journal fetch must leave the product page alone rather than breaking it');

// --- 3. One component, both surfaces -----------------------------------------------------------------
// Desktop and mobile drifting apart is this repo's commonest defect; a story offered on one and not the
// other is exactly the kind nobody reports.
for (const [name, page] of [
  ['PublicProductDetailPage.jsx', read('pages', 'PublicProductDetailPage.jsx')],
  ['MobileProductDetailPage.jsx', read('pages', 'mobile', 'MobileProductDetailPage.jsx')],
]) {
  assert.match(page, /<ProductStoryLink/, `${name} must offer the story`);
  assert.match(page, /import ProductStoryLink from '@\/components\/storefront\/ProductStoryLink\.jsx'/,
    `${name} must use the shared component rather than its own markup`);
}
// The phone passes `mobile`, or every link from it lands on a desktop route.
assert.match(read('pages', 'mobile', 'MobileProductDetailPage.jsx'), /<ProductStoryLink[^/]*\bmobile\b/,
  'the phone must ask for the phone route, or the story opens the desktop page');

// --- 4. The story comes before the other bottles ------------------------------------------------------
// Someone still deciding about THIS perfume is better served by what was written about it than by four
// alternatives; putting it after turns it into a footnote nobody scrolls to.
for (const [name, page] of [
  ['PublicProductDetailPage.jsx', read('pages', 'PublicProductDetailPage.jsx')],
  ['MobileProductDetailPage.jsx', read('pages', 'mobile', 'MobileProductDetailPage.jsx')],
]) {
  assert.ok(page.indexOf('<ProductStoryLink') < page.indexOf('{related.length ?'),
    `${name} puts the story after the related bottles, where it reads as an afterthought`);
}

// --- 5. Copy in both shops, and styles for what is rendered -------------------------------------------
const messages = read('i18n', 'messages.js');
for (const key of ['pdp.storyEyebrow', 'pdp.storyCta']) {
  const carrying = messages.split('\n').filter((line) => line.includes(`"${key}":`));
  assert.equal(carrying.length, 2, `${key} must exist in both shops; found ${carrying.length}`);
}
const css = readFileSync(join(src, 'styles', 'storefront.css'), 'utf8');
for (const selector of ['.product-story-link', '.product-story-link__card', '.product-story-link__cta']) {
  const styled = css.split(selector).slice(1).some((rest) => !/^[\w-]/.test(rest));
  assert.ok(styled, `${selector} is rendered but never styled`);
}

console.log('theStoryLinkGoesBothWays OK (the article offers the perfume, and the perfume offers the story)');
