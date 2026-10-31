// `node src/utils/oneAnnouncement.selfcheck.mjs`
//
// Screenshot from Dekito's phone, 2026-09-21 09.33: he taps "Tambah ke Keranjang" on L'iris and gets
// told twice. The sheet slides up — "Masuk ke keranjang · L'iris · 30 ml — Rp 279.000" — and a toast
// lands on top of it saying the same sentence with less in it. A toast sits at the bottom of the screen,
// which is exactly where the sheet keeps "Lanjut belanja" and "Checkout": the second announcement covered
// the way out of the first.
//
// The rule is about the screen, not about toasts: one event, one announcement, and nothing covering the
// way out. The phone's product page and its sheet retired on 2026-10-31; the one product page announces
// with a toast, and the app-wide gift prompt can open for the same add. On a phone that prompt is a
// bottom sheet — so the toast goes to the TOP, where it covers nothing the buyer has to press.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));
const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.jsx') ? [join(dir, entry.name)] : []
));

// --- 1. Every screen that adds to the cart, found by what it does ----------------------------------------
const adders = [...walk('pages'), ...walk('components')]
  .map((file) => [file, read(file)])
  .filter(([, source]) => /\baddItem\(\{/.test(source));
assert.ok(adders.length >= 3, `only ${adders.length} screens add to the cart — the sweep is broken (catalogue, product, story)`);

for (const [file, source] of adders) {
  // A screen that opens its own added-to-cart sheet again must come back through this check: the sheet
  // is where the toast once covered the buttons, and where the gift prompt once covered the sheet.
  assert.ok(!source.includes('setCartPromptOpen(true)'),
    `${file} has grown an added-to-cart sheet — restore the sheet rules (no toast, announcedByScreen) before it ships`);
  // Its one announcement, which carries the way forward.
  const toast = source.match(/toast\.success\(t\('pdp\.addedToast'[\s\S]*?\n\s*\}\);/);
  assert.ok(toast, `${file} adds to the cart and says nothing — a silent add reads as a missed tap`);
  assert.match(toast[0], /action: \{ label: t\('pdp\.viewCart'\)/, `${file}'s toast must keep the way to the cart`);
  // Not at the bottom: that is where the gift prompt's sheet keeps its aromas and its "later".
  assert.match(toast[0], /position: 'top-center'/,
    `${file}'s add-to-cart toast lands at the bottom, on top of the gift prompt's buttons on a phone`);
  // Failures never open the prompt, and still have to be said.
  assert.match(source, /toast\.error\(/, `${file} must still tell a buyer when the add did not happen`);
}
for (const key of ['pdp.addedToast', 'pdp.cartUpdated', 'pdp.viewCart']) {
  for (const language of ['id', 'en']) assert.ok(MESSAGES[language][key], `${language}.${key} is missing`);
}
// The product page names the size, because two sizes of one perfume are two different lines.
assert.match(read('pages', 'PublicProductDetailPage.jsx'), /t\('pdp\.addedToast', \{ name: `\$\{product\.name\} \(\$\{selectedSize\}\)` \}\)/,
  'the product page toast must say which size went in');

// --- 2. The prompt is a bottom sheet on a phone — which is why the toast moved ---------------------------
// If the prompt stopped rising from the bottom, the toast could go back; this ties the two together so
// the reason is checked, not just the position.
const css = readFileSync(join(root, 'styles', 'storefront.css'), 'utf8');
assert.match(css, /\.free-vial-prompt \{[^}]*align-items: flex-end;/, 'the gift prompt rises from the bottom on a phone');
assert.match(css, /@media \(min-width: 640px\) \{\s*\.free-vial-prompt \{ align-items: center; \}/,
  'and is centred from 640px, where a bottom toast and a centred box do not meet');

// --- 3. The mechanism a sheet would need is still there -------------------------------------------------
// A screen that announces the add itself tells addItem so, and the prompt stands down for that one event.
const cart = read('hooks', 'useCart.js');
assert.match(cart, /addItem: \(product, quantity, \{ announcedByScreen = false \} = \{\}\) =>/,
  'addItem no longer lets a screen say it is announcing the add itself');
assert.match(cart, /CART_ITEM_ADDED_EVENT, \{ detail: \{ announcedByScreen \} \}/,
  'the flag is not carried on the event, so nothing downstream can read it');
const prompt = read('components', 'storefront', 'FreeVialPrompt.jsx');
assert.match(prompt, /if \(event\.detail\?\.announcedByScreen\) return;/,
  'the gift prompt opens even when the screen has already announced the add — two modals for one event');

console.log(`oneAnnouncement selfcheck OK (${adders.length} screens add to the cart, each with one toast at the top, clear of the gift sheet)`);
