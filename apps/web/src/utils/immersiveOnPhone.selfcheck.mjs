// `node src/utils/immersiveOnPhone.selfcheck.mjs`
//
// The shop has one immersive story — Ayang-ayang — and for its whole life it was reachable only from a
// desktop. /mobile/products/:slug never made the handoff, so the one piece of writing this atelier
// invested a bespoke page in was shown to the smallest half of its audience, in a shop whose buyers are
// mostly on a phone.
//
// The stylesheet had been ready since the page was written: below 768px the text-image sections already
// stack to one column. Only the route was missing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

const desktop = read('pages', 'PublicProductDetailPage.jsx');
const phone = read('pages', 'mobile', 'MobileProductDetailPage.jsx');
const immersive = read('pages', 'ImmersiveProductPage.jsx');

// --- 1. Both surfaces hand off, and the phone says which shell it wants -------------------------------
assert.match(desktop, /<ImmersiveProductPage product=\{product\} story=\{productStory\} \/>/,
  'the desktop product page stopped showing the story');
assert.match(phone, /<ImmersiveProductPage product=\{product\} story=\{productStory\} mobile \/>/,
  'the phone shows the ordinary product page for a perfume that has a story');

// --- 2. They resolve the story by the SAME rule -------------------------------------------------------
// Not "both have a story variable": the RULE. The English shop gets a story only when an English one
// exists and never falls back to the Indonesian, because a full-screen Javanese letter is worse than the
// ordinary page, whose description and notes do have English text. Two copies of that reasoning is one
// copy that will be relaxed on a quiet afternoon.
const RULE = /isInternational\s*\n?\s*\?\s*getProductStory\(slug, region\)\s*\n?\s*:\s*\(supabaseStory \|\| getProductStory\(slug, region\)\)/;
for (const [name, source] of [['desktop', desktop], ['phone', phone]]) {
  assert.match(source, RULE,
    `${name} resolves the story by its own rule — the English shop must never fall back to the Indonesian letter`);
  assert.match(source, /storyLoading/,
    `${name} renders before it knows whether there is a story, so the buyer sees two different pages for one tap`);
}

// --- 3. One shell, not two ----------------------------------------------------------------------------
// The phone already carries a top bar and a tab row from MobileCommerceLayout. The desktop header and
// footer would stack a second of each on top of them.
assert.match(immersive, /\{mobile \? null : <PublicHeader \/>\}/, 'the phone would render a second header');
assert.match(immersive, /\{mobile \? null : <StorefrontFooter \/>\}/, 'the phone would render a desktop footer under its tab bar');
assert.match(immersive, /props\.mobile\s*\n?\s*\?\s*<MobileCommerceLayout>/,
  'the phone gets no tab bar, so the story is a dead end with no way back into the shop');

// --- 4. The way out matches the surface ---------------------------------------------------------------
// /catalog on a phone is the desktop catalogue: a working link that drops the reader out of the shell
// they were in.
assert.match(immersive, /to=\{mobile \? '\/mobile\/catalog' : '\/catalog'\}/,
  'the back link sends a phone reader to the desktop catalogue');

// --- 5. And the English shop still has no cart here ----------------------------------------------------
// This page has its own add-to-cart, which is exactly the kind of second till that /en/bespoke turned out
// to be hiding. It was already gated; adding a second surface must not un-gate it.
assert.match(immersive, /\{isInternational \? null : \(/,
  'the immersive page offers a cart in the English shop, which has none');

console.log('immersiveOnPhone selfcheck OK (one story, two surfaces, one shell each — and the English shop still cannot reach a cart through it)');
