// `node src/utils/oneAnnouncement.selfcheck.mjs`
//
// Screenshot from Dekito's phone, 2026-09-21 09.33: he taps "Tambah ke Keranjang" on L'iris and gets
// told twice. The sheet slides up — "Masuk ke keranjang · L'iris · 30 ml — Rp 279.000" — and a toast
// lands on top of it saying the same sentence with less in it. A toast sits at the bottom of the screen,
// which is exactly where the sheet keeps "Lanjut belanja" and "Checkout": the second announcement covered
// the way out of the first.
//
// The rule is about the screen, not about toasts: one event, one announcement. Where this page opens the
// sheet, it may not also raise a toast — and the sheet has to carry what the toast was carrying.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const page = read('pages', 'mobile', 'MobileProductDetailPage.jsx');

// --- 1. Whatever opens the sheet must not also toast -------------------------------------------------
// Read the FUNCTION that opens it rather than naming it: a rename, or a second button that also adds to
// the cart, inherits the rule.
// One function at a time. A lazy match from the first `const x = () => {` runs from the component's own
// opening brace to the first `\n  };` in the file, which swallowed every handler before the real one —
// the check still caught the bug, but it named the wrong function and would have cried wolf over an
// unrelated toast elsewhere on the page.
const openers = [...page.matchAll(/\n  const (\w+) = \(\) => \{/g)].map((match) => {
  const start = match.index + match[0].length;
  const end = page.indexOf('\n  };', start);
  return [match[0], match[1], page.slice(start, end === -1 ? page.length : end)];
}).filter(([, , body]) => body.includes('setCartPromptOpen(true)'));
assert.equal(openers.length, 1, `expected one function to open the added-to-cart sheet, found ${openers.length}`);
for (const [, name, body] of openers) {
  assert.ok(!/toast\.success\(/.test(body),
    `${name}() opens the sheet AND raises a toast — the toast lands over the sheet's own buttons`);
  // Failures are a different matter: those never open a sheet, and they still have to be said.
  assert.match(body, /toast\.error\(/, `${name}() must still tell a buyer when the add did not happen`);
}

// --- 1b. And the app-wide gift prompt is not the second announcement either ---------------------------
// Measured on the phone product page, 2026-10-17: ONE "Tambah ke keranjang" left two modals open, and
// they stayed open.
//
//   .free-vial-prompt   role=dialog  z-index 70  top 0 -> 812   aria-hidden="true"
//   the added-to-cart sheet          z-index 50  top 584        aria-hidden=null
//
// The full-screen gift prompt sat ON TOP of the sheet, covering the "Lanjut belanja" and "Lihat
// keranjang" the comment above fought to keep clear — and the sheet's own modal machinery had marked the
// prompt aria-hidden, so a screen reader was told the thing covering the screen was not there. Neither
// held focus. On a phone this is not an edge case: the product page is the only place a phone can add to
// the cart at all.
//
// So a screen that opens its own sheet says so when it adds, and the prompt stands down for that one
// event. Everywhere else — the desktop catalogue's quick add, the cart page — the prompt is unchanged.
const cart = read('hooks', 'useCart.js');
assert.match(cart, /addItem: \(product, quantity, \{ announcedByScreen = false \} = \{\}\) =>/,
  'addItem no longer lets a screen say it is announcing the add itself');
assert.match(cart, /CART_ITEM_ADDED_EVENT, \{ detail: \{ announcedByScreen \} \}/,
  'the flag is not carried on the event, so nothing downstream can read it');

const prompt = read('components', 'storefront', 'FreeVialPrompt.jsx');
assert.match(prompt, /if \(event\.detail\?\.announcedByScreen\) return;/,
  'the gift prompt opens even when the screen has already announced the add — two modals for one event');

// The page that opens a sheet passes it. Derived from the sheet, not from a list of pages: any screen
// that opens the added-to-cart sheet must also tell addItem it is doing so.
for (const [, name, body] of openers) {
  assert.match(body, /announcedByScreen: true/,
    `${name}() opens the added-to-cart sheet but still lets the app-wide gift prompt open over it`);
}

// --- 2. The sheet carries what the toast used to say ------------------------------------------------------
// HELD AS THE RULE — the item carries a name, a size and a price — not as the one spelling of the price.
// Pinned to `price: formatRupiah(selectedPrice)`, this failed the day the price learned to be the dollar
// in the English shop (quotedInternationalPrice, 2026-10-06), which was the sheet getting MORE honest.
const added = page.match(/setLastAddedItem\(\{([^}]*)\}\)/);
assert.ok(added, 'the sheet no longer records what was added');
for (const field of ['name: product.name', 'size: selectedSize', 'price: ']) {
  assert.ok(added[1].includes(field), `the sheet must carry ${field.trim()} — more than the toast ever did: ${added[0]}`);
}
assert.match(page, /title=\{t\('pdp\.addedSheetTitle'\)\}/, 'and it still says what happened');
for (const key of ['pdp.continueShopping', 'pdp.checkout']) {
  // The key may sit inside a shop ternary — `t(isInternational ? 'pdp.viewCart' : 'pdp.checkout')` since
  // 2026-10-06, because the English shop's cart is where the destination is picked and "Checkout" would
  // name a page it never opens. What must hold is that the key is still a t() argument on this page.
  assert.match(page, new RegExp(`t\\([^)]*'${key.replace('.', '\\.')}'\\)`), `the sheet must keep ${key} — the way forward is the point`);
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language][key], `${language}.${key} is missing`);
  }
}

// --- 3. The surfaces with no sheet keep their toast -------------------------------------------------------
// Desktop and the immersive story page have nothing else to announce with; removing their toast would
// make an add-to-cart silent. The rule is "not twice", not "never".
for (const file of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'ImmersiveProductPage.jsx']]) {
  const source = read(...file);
  assert.match(source, /toast\.success\(t\('pdp\.addedToast'/, `${file.join('/')} has no sheet, so its toast is the only word a buyer gets`);
  assert.ok(!source.includes('setCartPromptOpen(true)'), `${file.join('/')} must not have grown a sheet without this check being told`);
}

console.log('oneAnnouncement selfcheck OK (one add to cart, one announcement, nothing covering the way out)');
