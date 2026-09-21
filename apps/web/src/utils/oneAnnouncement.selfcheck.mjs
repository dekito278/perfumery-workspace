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

// --- 2. The sheet carries what the toast used to say ------------------------------------------------------
assert.match(page, /setLastAddedItem\(\{ name: product\.name, size: selectedSize, price: formatRupiah\(selectedPrice\) \}\)/,
  'the sheet names the bottle, the size and the price — more than the toast ever did');
assert.match(page, /title=\{t\('pdp\.addedSheetTitle'\)\}/, 'and it still says what happened');
for (const key of ['pdp.continueShopping', 'pdp.checkout']) {
  assert.match(page, new RegExp(`t\\('${key.replace('.', '\\.')}'\\)`), `the sheet must keep ${key} — the way forward is the point`);
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
