// `node src/utils/buyerFacingDates.selfcheck.mjs`
//
// formatDate printed Indonesian month names to everyone, because it named the locale itself:
// toLocaleDateString('id-ID', …). That is right for Studio, which is Indonesian on purpose and must
// never be translated, and it is right for roughly thirty of its callers.
//
// It is wrong on the handful that face a buyer. The public tracking page is the one that stings: someone
// in Berlin following a parcel read "22 Mei 2026" on an otherwise English page — a date in a language
// they may not have, on the one screen whose whole job is saying when something arrives. The English
// journal did the same under English headings.
//
// Someone had already noticed. MobileArticlesPage was calling formatDate(value, t) — passing the
// translator as a second argument to a function that took one — so the call read as locale-aware and
// did nothing at all. That is the quieter half of this defect: a fix that was never wired up, sitting
// in the code looking finished.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// --- 1. The formatter, run -----------------------------------------------------------------------------
const source = read('utils', 'formatting.js').replace(/^import\b[^\n]*from '[^']+';\n/gm, '');
const { formatDate } = await import(
  `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`
);

assert.equal(formatDate('2026-05-22'), '22 Mei 2026',
  'Studio is Indonesian and must stay Indonesian when no locale is given — thirty callers depend on it');
assert.equal(formatDate('2026-05-22', MESSAGES.en['fmt.dateLocale']), '22 May 2026',
  'a buyer reading English must get English month names');
assert.notEqual(formatDate('2026-05-22', MESSAGES.en['fmt.dateLocale']), formatDate('2026-05-22'),
  'the locale argument must actually change the answer, or passing it is theatre');
// Total, whatever it is handed. A function used to be passed here and silently ignored; now that the
// argument means something, the same call would have thrown and blanked the page.
assert.equal(formatDate('2026-05-22', () => {}), '22 Mei 2026', 'a non-string locale must fall back, not throw');
assert.equal(formatDate('2026-05-22', ''), '22 Mei 2026', 'and so must an empty one');
assert.equal(formatDate(''), 'N/A', 'no date is still N/A');

// --- 2. Every buyer-facing screen that prints a date passes the shop's locale ----------------------------
// Derived, not listed: a page that renders the storefront chrome is a page a buyer reads. Studio pages
// render an authenticated layout instead and are deliberately left alone.
const pages = [];
const walk = (parts) => {
  for (const entry of readdirSync(join(root, ...parts), { withFileTypes: true })) {
    if (entry.isDirectory()) walk([...parts, entry.name]);
    else if (entry.name.endsWith('.jsx')) pages.push([...parts, entry.name]);
  }
};
walk(['pages']);

const buyerFacing = pages.filter((file) => {
  const text = read(...file);
  return /PublicHeader|StorefrontFooter|MobileCommerceLayout/.test(text)
    && !/AuthenticatedLayout/.test(text)
    && /formatDate\(/.test(text);
});
assert.ok(buyerFacing.length >= 3,
  `expected the buyer-facing date screens to still be findable this way, found ${buyerFacing.length}`);

for (const file of buyerFacing) {
  const where = file.join('/');
  const source = read(...file);
  // TWO correct shapes, and the fatal mistake is mixing them.
  //
  // Some screens use the shared formatDate from utils/formatting.js, which takes a LOCALE STRING. Others
  // define their own `const formatDate = (value, t) =>` that resolves the locale itself and takes the
  // TRANSLATOR. Both are fine; handing either one the other's argument is not.
  //
  // The first version of this guard demanded t('fmt.dateLocale') everywhere. Three screens had the local
  // shape and were already correct, and it rewrote them into `formatDate(value, 'en-GB')` — whose body
  // then called a string. The member account page crashed to "App failed to render: t is not a function"
  // for anyone arriving with a customer code, and the guard held that in place for a commit.
  const ownsIt = /^const formatDate = \(value, t\)/m.test(source);
  if (ownsIt) {
    assert.match(source, /Intl\.DateTimeFormat\(t\('fmt\.dateLocale'\)/,
      `${where} defines its own formatDate but does not resolve the shop's locale inside it`);
    for (const call of source.match(/formatDate\([^;\n]*/g) || []) {
      if (call.startsWith('formatDate = ')) continue;
      assert.match(call, /,\s*t\)/,
        `${where} has a formatDate that takes the TRANSLATOR, and this call hands it something else — `
        + `its body will try to call that value: ${call.trim().slice(0, 90)}`);
    }
    continue;
  }
  for (const call of source.match(/formatDate\([^;\n]*/g) || []) {
    assert.match(call, /fmt\.dateLocale/,
      `${where} prints a date in Indonesian to whoever is reading: ${call.trim().slice(0, 90)}`);
    // The KEY, translated — not the translator itself, which is the mistake that was already here.
    assert.doesNotMatch(call, /,\s*t\s*\)/,
      `${where} passes the translator where a locale goes: ${call.trim().slice(0, 90)}`);
  }
}

// --- 3. And the two shops really do name different locales ---------------------------------------------
assert.match(MESSAGES.id['fmt.dateLocale'], /^id/, 'the Indonesian shop formats dates as Indonesian');
assert.match(MESSAGES.en['fmt.dateLocale'], /^en/, 'and the English shop as English');

console.log(`buyerFacingDates selfcheck OK (${buyerFacing.length} buyer-facing screens, every date in the `
  + "reader's own language, Studio still Indonesian)");
