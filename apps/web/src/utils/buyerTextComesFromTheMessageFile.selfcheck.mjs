// `node src/utils/buyerTextComesFromTheMessageFile.selfcheck.mjs`
//
// The shop has two languages, and the strings a SCREEN READER announces were leaking in both directions:
//
//   BackToTop            aria-label="Kembali ke atas"        Indonesian, in the English shop too
//   ProductGallery x5    aria-label="Previous product image" English, in the Indonesian shop too
//   MobileProductDetail  aria-label="Product action"         same
//   MobileCommerceLayout aria-label="Solivagant owner access"
//
// The last one was its own problem. That wordmark is the OWNER's way in -- three taps opens Studio -- and
// the label announced that hidden affordance to every buyer who uses a screen reader. It says SOLIVAGANT
// now: the brand needs no translation, and the gesture goes back to being quiet.
//
// storefrontMessages.selfcheck.mjs could not catch any of it. That guard scans a hand-written list of
// Indonesian PHRASES, so a leak in English is invisible to it, and so is an Indonesian phrase nobody
// thought to add. This one reads a DIRECTORY instead -- components/storefront is buyer-facing by
// construction, so there is no list to fall behind -- and asks a different question: does every string a
// screen reader reads come from the message file?
//
// Scope is deliberately narrow and stated: this directory plus the mobile commerce layout. Buyer PAGES
// are not swept here, because no rule separates them from Studio pages by name -- MobileCustomersPage is
// Studio. Widening it means naming them, and a named list is the thing this guard exists to avoid.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// Strings a screen reader or a hint field reads out. Not className, not href, not data-*.
const SPOKEN_PROPS = /\b(aria-label|alt|title|placeholder)="([^"{}]{2,})"/g;

// Each exemption carries its reason, because an allowlist without one becomes a dumping ground.
const ALLOWED = new Map([
  ['SOLIVAGANT', 'the brand name, which is the same word in both shops and must not be translated'],
  ['Solivagant', 'the brand name on the desktop header logo'],
  ['Kembali ke dashboard Studio', 'rendered only inside {isAdmin ? ...} — Studio is Indonesian, and a '
    + 'buyer never sees this control'],
  ['081234567890', 'an Indonesian phone-number example on a checkout that is domestic-only; not prose'],
]);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return /\.jsx$/.test(entry.name) ? [full] : [];
});

const files = [...walk(join(src, 'components', 'storefront')), join(src, 'layouts', 'MobileCommerceLayout.jsx')];
assert.ok(files.length >= 10,
  `only ${files.length} buyer files found — this guard's directory walk is broken, not the shop`);

const leaks = [];
const seen = new Set();
for (const file of files) {
  for (const match of strip(readFileSync(file, 'utf8')).matchAll(SPOKEN_PROPS)) {
    const [, prop, value] = match;
    seen.add(value.trim());
    if (ALLOWED.has(value.trim())) continue;
    leaks.push(`${file.replace(`${src}/`, '')}  ${prop}="${value.trim()}"`);
  }
}
assert.deepEqual(leaks, [],
  'a string a screen reader reads is written straight into a buyer-facing file instead of coming from the '
  + `message file, so it is wrong in one of the two shops:\n  ${leaks.join('\n  ')}`);

// --- The scan proves itself ---------------------------------------------------------------------------
// If SPOKEN_PROPS stopped matching, the leak assertion above would pass on a shop full of leaks. So the
// proof runs THROUGH the same regex: the strings the allowlist exempts are real literals in these files,
// so the scan must have seen them. Checking the raw file text instead proves nothing about the regex —
// which is exactly how a sabotaged pattern walked past the first version of this file.
const MUST_BE_SEEN = ['SOLIVAGANT', 'Kembali ke dashboard Studio'];
for (const value of MUST_BE_SEEN) {
  assert.ok(ALLOWED.has(value), `${value} must stay on the allowlist with its reason`);
  assert.ok(seen.has(value),
    `the scan never saw "${value}", which is written into a file in scope — SPOKEN_PROPS has stopped `
    + 'matching, so the leak check above is passing on nothing');
}

// --- The keys the fixed labels now use must exist in BOTH shops --------------------------------------
// A missing key renders the key itself, which is worse than either language.
for (const key of [
  'a11y.backToTop', 'a11y.galleryPrevImage', 'a11y.galleryNextImage',
  'a11y.galleryCloseZoom', 'a11y.galleryPrev', 'a11y.galleryNext', 'a11y.productAction',
]) {
  for (const shop of ['id', 'en']) {
    assert.ok(MESSAGES[shop]?.[key], `${key} is missing from the ${shop} shop`);
  }
  assert.notEqual(MESSAGES.id[key], MESSAGES.en[key],
    `${key} reads the same in both shops — one of them has not been translated`);
}

// --- And the wordmark must not advertise the owner's door --------------------------------------------
const layout = readFileSync(join(src, 'layouts', 'MobileCommerceLayout.jsx'), 'utf8');
assert.ok(!/aria-label="[^"]*owner access"/i.test(layout),
  'the brand wordmark announces the owner entrance again — three taps on it opens Studio, and saying so '
  + 'in its label tells every screen-reader buyer about a door meant to be quiet');

console.log(`buyerTextComesFromTheMessageFile selfcheck OK (${files.length} buyer-facing files, every `
  + 'spoken string from the message file, 7 keys paired across both shops)');
