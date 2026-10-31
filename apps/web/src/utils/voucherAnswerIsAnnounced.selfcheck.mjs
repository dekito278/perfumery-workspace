// `node src/utils/voucherAnswerIsAnnounced.selfcheck.mjs`
//
// Typed a code into the cart on a built preview, pressed "Pakai", and watched what a screen reader
// would get:
//
//   visible:  "Kode voucher TIDAKADA123 tidak ditemukan. Cek lagi penulisannya."
//   announced: nothing
//
// The sentence rendered into a plain <p>: no role, no aria-live, no live region anywhere above it, and
// the input kept the focus. A buyer who cannot see the page pressed a button and the page said nothing
// back — on the one control in the shop that changes what they pay.
//
// Six surfaces ask for a voucher — two desktop carts, the desktop bespoke form, and the three phone
// equivalents — and all six rendered the answer the same silent way, in six different stylings. Nobody
// chose that: it accumulated, the way the cart line's notes did.
//
// The rule is about the ANSWER, not about a file: wherever a page renders `voucher.message`, or the
// block it shows once a voucher is applied, that node carries a role a screen reader reports. Found by
// walking the pages, so a seventh surface inherits it the day it is added.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return /\.jsx$/.test(entry) ? [full] : [];
});

// Studio is Dekito's own screen and is not in this rule — these are the pages a stranger reaches.
const BUYER = /^(pages\/(Cart|Checkout|Bespoke)Page\.jsx|pages\/mobile\/Mobile(Cart|Checkout|Bespoke)Page\.jsx)$/;
const pages = walk(join(src, 'pages')).filter((file) => BUYER.test(relative(src, file)));
assert.equal(pages.length, 6,
  `expected the six surfaces that ask for a voucher, found ${pages.length} — the scan is broken, not the code`);

// An element opens with its tag and ends at the first `>` that is not inside a brace or a quote, so the
// attribute list can carry `className={...}` and inline styles without the match running past the tag.
const openingTag = (source, at) => {
  let depth = 0; let quote = null;
  for (let i = at; i < source.length; i += 1) {
    const c = source[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return source.slice(at, i + 1);
  }
  return source.slice(at);
};

// The node that renders a value is the element OPENING IT — walk back from the value to the `<` that
// starts the tag it sits in, not to the nearest `<` in the file.
const tagHolding = (source, index) => {
  const open = source.lastIndexOf('<', index);
  return open === -1 ? null : openingTag(source, open);
};

const ANNOUNCED = /\brole=["'](status|alert)["']|\baria-live=/;
const checked = [];
for (const file of pages) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const name = relative(src, file);

  // 1. The answer to a code that did not work.
  const failures = [...source.matchAll(/\{voucher\.message\}/g)];
  assert.ok(failures.length, `${name} no longer renders voucher.message — this check reads it out of the page`);
  for (const match of failures) {
    const tag = tagHolding(source, match.index);
    assert.ok(tag && ANNOUNCED.test(tag),
      `${name} shows the voucher answer in a node a screen reader never reports:\n  ${String(tag).trim().slice(0, 140)}\n  `
      + 'A buyer pressed "Pakai" and heard nothing back');
    checked.push(`${name} (message)`);
  }

  // 2. And the answer to one that did. The desktop carts say it in the same paragraph, already covered
  //    above; the phone carts and both bespoke forms build a block of their own. So the subject is a
  //    block that SAYS something — the remove button alone is not an announcement, and on the desktop
  //    cart that is all the block is.
  for (const match of source.matchAll(/voucher\.appliedVoucher\s*\?\s*\(/g)) {
    const block = source.slice(match.index, source.indexOf(') :', match.index) + 3);
    const spoken = block
      .replace(/<button[\s\S]*?<\/button>/g, '')
      .replace(/<Button[\s\S]*?<\/Button>/g, '');
    if (!/t\('|voucher\.appliedVoucher\.code/.test(spoken)) continue;
    assert.match(block, ANNOUNCED,
      `${name} states the discount a buyer just earned in a block a screen reader never reports:\n  `
      + `${block.trim().slice(0, 140)}`);
    checked.push(`${name} (applied)`);
  }
}

// --- 3. AND EVERY OTHER NOTICE ON THOSE SCREENS -------------------------------------------------------
// The voucher answer was not the only silent one. Typing a destination into the bespoke flow and
// pressing "Cari" put this on screen with nothing announced:
//
//   "Layanan ongkir belum bisa dihubungi. Coba lagi beberapa saat."
//
// Same shape, same file, a few hundred lines from the voucher fix — missed because section 1's subject
// is vouchers. Ten of them in all, across the checkout and bespoke screens: the shipping search, its
// result, its error, "pick a rate", and the sentence on the desktop checkout that says WHY the submit
// button will not move.
//
// Three in the same files already carried the role. Nobody chose which: the convention existed and was
// applied where someone happened to think of it.
//
// So the subject is the repo's own notice STYLING rather than a list of states: a paragraph wearing
// `checkout-notice`, the amber pill, or the editorial warning is a notice by construction, and a notice
// a screen reader never reports is not one.
// `ng-notice` is the redesign's (2026-10-31) notice styling; same rule.
const NOTICE_PILL = /className="(?:[^"]*\b(?:checkout-notice|bg-amber-50|ng-notice)\b[^"]*|[^"]*editorial-helper-text--warning[^"]*)"/;
let notices = 0;
for (const file of walk(join(src, 'pages')).filter((f) => BUYER.test(relative(src, f)))) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const name = relative(src, file);
  for (const match of source.matchAll(/<p\b[^>]*>/g)) {
    const tag = match[0];
    if (!NOTICE_PILL.test(tag)) continue;
    notices += 1;
    assert.ok(ANNOUNCED.test(tag),
      `${name} shows a notice a screen reader never reports:\n  ${tag.trim().slice(0, 150)}\n  `
      + 'A buyer pressed something and the page answered where they could not hear it');
  }
}
assert.ok(notices >= 8,
  `only ${notices} notices found on the six surfaces — the scan is broken, not the pages`);

// The reader must actually be reading tags. A node with the role removed has to fail, or the walk above
// is matching something that is always true.
const sample = '<p className={`cart-voucher__msg${x ? \' is-success\' : \'\'}`}>{voucher.message}</p>';
assert.ok(!ANNOUNCED.test(tagHolding(sample, sample.indexOf('{voucher.message}'))),
  'the tag reader accepts a paragraph with no role, so this check would pass anything');
assert.ok(ANNOUNCED.test(tagHolding(sample.replace('<p ', '<p role="status" '), sample.indexOf('{voucher.message}') + 14)),
  'the tag reader cannot see a role it is given, so this check would fail everything');

console.log(`voucherAnswerIsAnnounced selfcheck OK (${checked.length} voucher answers and ${notices} other `
  + `notices on ${pages.length} buyer surfaces, every one announced)`);
