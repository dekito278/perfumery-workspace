// `node src/utils/immersiveOnPhone.selfcheck.mjs`
//
// The shop has one immersive story — Ayang-ayang — and for its whole life it was reachable only from a
// desktop. /mobile/products/:slug never made the handoff, so the one piece of writing this atelier
// invested a bespoke page in was shown to the smallest half of its audience, in a shop whose buyers are
// mostly on a phone.
//
// The stylesheet had been ready since the page was written: below 768px the text-image sections already
// stack to one column. Only the route was missing.
//
// Since 2026-10-31 there is one responsive shop, so there is one product page and one shell: the phone
// reads the story through the same handoff as the desktop. What this holds now is that the handoff stays
// single, the shell is the shop's own, and no way out of the story goes through the retired /mobile shop.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

const page = read('pages', 'PublicProductDetailPage.jsx');
const immersive = read('pages', 'ImmersiveProductPage.jsx');

// --- 1. The product page hands off, carrying what the story needs -------------------------------------
// Written against the PROPS the handoff has to carry, not the exact spelling of the element: pinning
// the whole tag broke the day the stale-catalogue flag was threaded through it.
const handoff = page.match(/<ImmersiveProductPage\b([^>]*)>/)?.[1] ?? '';
assert.ok(handoff, 'the product page stopped showing the story');
assert.match(handoff, /product=\{product\}/, 'the handoff no longer passes the product');
assert.match(handoff, /story=\{productStory\}/, 'the handoff no longer passes the story');
assert.doesNotMatch(handoff, /\bmobile\b/, 'there is no phone shell left to ask for');

// --- 2. The story is resolved by the one rule ---------------------------------------------------------
// The English shop gets a story only when an English one exists and never falls back to the Indonesian,
// because a full-screen Javanese letter is worse than the ordinary page, whose description and notes do
// have English text.
const RULE = /isInternational\s*\n?\s*\?\s*getProductStory\(slug, region\)\s*\n?\s*:\s*\(supabaseStory \|\| getProductStory\(slug, region\)\)/;
assert.match(page, RULE, 'the English shop must never fall back to the Indonesian letter');
assert.match(page, /storyLoading/,
  'the product page renders before it knows whether there is a story, so the buyer sees two different pages for one tap');

// --- 3. One shell, the shop's own -----------------------------------------------------------------------
// The header is the navigation on every screen now; without it the story is a dead end on a phone.
assert.match(immersive, /^\s*<PublicHeader \/>/m, 'the story page must carry the shop header on every screen');
assert.match(immersive, /^\s*<StorefrontFooter \/>/m, 'and the shop footer');
assert.doesNotMatch(immersive, /MobileCommerceLayout|\bmobile \?/, 'a phone shell or a phone branch is back');

// --- 4. The way out is the catalogue, on every screen -------------------------------------------------
assert.match(immersive, /<Link to="\/catalog"/, 'the story has no way back into the catalogue');
assert.doesNotMatch(immersive, /['"`]\/mobile\//, 'and no link through the retired phone storefront');

// --- 5. And this page's own add-to-cart is offered in BOTH shops ----------------------------------------
// It was gated out of the English shop from 18 Sep to 6 Oct 2026, when that shop had no cart. Since the
// English cart exists (englishShopOrdersOnWhatsApp.selfcheck), a page that quietly kept the gate would
// hide the cart from exactly the buyer it was reopened for. The till it must NOT reach is the domestic
// checkout, and this page never links there.
assert.match(immersive, /t\('pdp\.addToCart(?:WithPrice)?'/, 'the immersive page no longer offers a cart at all');
// The gate's SHAPE — a shop ternary whose domestic branch is the cart button — not a character window:
// a sabotage that re-wrapped the button sat a few characters past a 400-char window and walked through.
assert.doesNotMatch(immersive, /isInternational \? null : \(\s*<button[\s\S]{0,240}?(?:handleAddToCart|addSelectedVariant)/,
  'the immersive page still hides add-to-cart in the English shop — the English cart exists now');
assert.doesNotMatch(immersive, /to="\/checkout"|'\/checkout'/, 'the immersive page must not link to the domestic checkout');

console.log('immersiveOnPhone selfcheck OK (one story, one handoff, the shop shell — and the English shop still cannot reach a cart through it)');
