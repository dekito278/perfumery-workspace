// `node src/utils/aFieldSaysWhatItWants.selfcheck.mjs`
//
// Read the accessible name of every field on four buyer screens with a screen reader's own rules:
//
//   /catalog   search          "Cari fragrance berdasarkan nama, notes, atau mood"   named
//   /track     order number    "Nomor order"                                         named
//   /customer  customer code   (nothing)  — placeholder "SOLI09232"
//   footer     newsletter      (nothing)  — placeholder "Email kamu"
//
// The code field is the worse of the two. Its placeholder is an EXAMPLE, so a reader was told the field
// is called "SOLI09232" — and a placeholder disappears the moment anything is typed, taking the only
// name with it. The visible <label> above it is real but was never wired to the input.
//
// Both are kept honest here by what they hold rather than by where they live, so a fourth code field or
// a second newsletter form inherits the rule:
//
//   an input whose placeholder is the example code has to carry its own name
//   the footer's email field — one component, on every buyer page — has to carry its own name
//
// A NOTE ON READING JSX: the first version of this scan matched `<input\b[^>]*>` and reported that NOT
// ONE of 57 fields had a name. The `>` in `onChange={(event) => …}` ends the match, so every multi-line
// tag was cut off before its attributes. Tags are read brace-aware here, and the same trap is why this
// check does not try to decide the rest: a field named by a <label> WRAPPING it cannot be told apart
// from an unnamed one by reading source, and most of the remaining fields are named that way. Those are
// checked by opening the page, not here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buyerSurfaces } from './buyerSurfaces.mjs';

const src = dirname(dirname(fileURLToPath(import.meta.url)));
const strip = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// A JSX opening tag ends at the first '>' that is not inside braces, quotes or a template literal.
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
assert.equal(
  openingTag('<input onChange={(e) => set(e)} aria-label="x" />', 0),
  '<input onChange={(e) => set(e)} aria-label="x" />',
  'the tag reader stops at the arrow again, which is the bug that made the first scan report no names at all',
);

const { files } = buyerSurfaces({ src: 'src' });
const NAMED = /aria-label=|aria-labelledby=/;

// 1. Every field that offers the example customer code names itself.
let codeFields = 0;
for (const file of files) {
  const source = strip(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(/<input\b/g)) {
    const tag = openingTag(source, match.index);
    if (!/placeholder="SOLI09232"/.test(tag)) continue;
    codeFields += 1;
    assert.match(tag, NAMED,
      `${file} asks for a customer code and lets the EXAMPLE stand in for the field's name — a reader is `
      + 'told the field is called "SOLI09232", and that name disappears as soon as anything is typed');
  }
}
assert.ok(codeFields >= 3, `only ${codeFields} customer-code fields found — the scan is broken, not the pages`);

// 2. The footer's newsletter field, which is on every buyer page there is.
const footer = strip(readFileSync(join(src, 'components', 'storefront', 'StorefrontFooter.jsx'), 'utf8'));
const emailAt = footer.indexOf('<input');
assert.ok(emailAt > 0, 'the footer no longer has an input — this check reads it out of the component');
const emailTag = openingTag(footer, emailAt);
assert.match(emailTag, /type="email"/, 'the first field in the footer is no longer the newsletter one');
assert.match(emailTag, NAMED,
  'the newsletter field in the footer has no name of its own, and that footer is on every buyer page');

// 3. A field whose name comes from a <label> WRAPPING it, where that label holds more than the label.
// Measured on the two bespoke forms, same two fields:
//
//   /mobile/bespoke   "Nama parfum"   "Arah aroma"
//   /bespoke          "NAMA PARFUM Nama bisa sementara, nanti masih bisa …"
//                     "ARAH AROMA Woody Floral Fresh Gourmand Smoky Clean musk …"
//
// The desktop label wraps the field, its hint, AND six mood buttons, so all of it became the field's
// name: a reader heard six words that are really separate controls. The phone had it right — the same
// keys, on the field itself. This is the shop's commonest defect, one side fixed and not the other.
//
// The rule: a label that wraps a field may hold only the label. If it also holds a control or a hint,
// the field carries its own name.
const labelBlock = (source, at) => {
  const close = source.indexOf('</label>', at);
  return close === -1 ? source.slice(at) : source.slice(at, close);
};
let wrapped = 0;
for (const file of files) {
  const source = strip(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(/<label\b/g)) {
    const block = labelBlock(source, match.index);
    const fieldAt = block.search(/<(input|textarea)\b/);
    if (fieldAt === -1) continue;
    const tag = openingTag(block, fieldAt);
    if (NAMED.test(tag)) { wrapped += 1; continue; }
    const extras = [/<button\b/.test(block) && 'a button', /<small\b/.test(block) && 'a hint']
      .filter(Boolean);
    if (!extras.length) { wrapped += 1; continue; }
    assert.fail(`${file} wraps a field in a label that also holds ${extras.join(' and ')}, so all of that `
      + "becomes the field's name. Give the field its own aria-label, the way the phone does");
  }
}
assert.ok(wrapped >= 5, `only ${wrapped} wrapped fields found — the scan is broken, not the pages`);

// 4. The voucher box, which is the same control on six screens.
// Three of the six named it and three did not, and the split was not desktop-against-phone — it was
// wherever someone happened to think of it. The checkout had it on both, the phone bespoke had it, the
// two carts and the desktop bespoke did not. A buyer who cannot see the page reached a field whose only
// name was its placeholder, and a placeholder goes away as soon as a code is typed into it.
//
// Found by what the field is BOUND to, so a seventh voucher box inherits the rule.
let voucherFields = 0;
for (const file of files) {
  const source = strip(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(/<input\b/g)) {
    const tag = openingTag(source, match.index);
    if (!/voucher\.inputCode/.test(tag)) continue;
    voucherFields += 1;
    assert.match(tag, NAMED,
      `${file} asks for a voucher code in a field with no name of its own — its placeholder is the only `
      + 'one, and that disappears as soon as a code is typed');
  }
}
// The phone storefront retired on 2026-10-31: one responsive page per screen now, so the floor halved.
assert.ok(voucherFields >= 3,
  `only ${voucherFields} voucher fields found — the scan is broken, not the screens`);

console.log(`aFieldSaysWhatItWants selfcheck OK (${codeFields} customer-code fields, the footer's email `
  + `field, ${voucherFields} voucher boxes, and ${wrapped} fields inside a label each carry a name of their own)`);
