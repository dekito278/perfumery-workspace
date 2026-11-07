// `node src/utils/productFormNamesEveryField.selfcheck.mjs`
//
// Dekito, 2026-11-08, about the Studio product screens: "di kasih nama biar gak salah". Two ways a field
// went unnamed, both measured on the live form that day:
//
// 1. A name that was only a placeholder. It disappears the moment the box is filled, so a variant row
//    read "30 ml | 429000 | 0 | 4" with nothing saying which number was the price struck through and
//    which was the stock; on the phone, eight boxes (the three note tiers, the description and four
//    English twins) were named that way and nothing else.
// 2. A name that was a <label> wrapped around buttons. A label hands every click on its own text to the
//    first control inside it, so tapping "Cocok dipakai kapan" — or "Momen", "Waktu", "Cuaca" — quietly
//    switched "Kerja" on or off. Ten of nineteen products carry "Kerja" today; nobody can now say which.
//
// So, for both product forms: every control that takes typing sits inside a <label> (whose text names
// it), and no <label> contains a button or a picker built of buttons.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// Comments blanked with their length kept, so positions still line up with the source.
const blankComments = (text) => text
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/^([ \t]*)\/\/[^\n]*/gm, (m) => m.replace(/[^\n]/g, ' '));

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** [start, end) of every <label …>…</label>. Labels do not nest in these forms; asserted below. */
const labelBlocks = (text) => {
  const blocks = [];
  const open = /<label\b/g;
  let match;
  while ((match = open.exec(text))) {
    const end = text.indexOf('</label>', match.index);
    assert.ok(end > 0, `an unclosed <label> at line ${lineOf(text, match.index)}`);
    const nextOpen = text.indexOf('<label', match.index + 1);
    assert.ok(nextOpen === -1 || nextOpen > end, `nested <label> at line ${lineOf(text, match.index)} — the scan assumes none`);
    blocks.push([match.index, end]);
  }
  return blocks;
};

const CONTROLS = /<(input|textarea|select|LocalizedNumberInput)\b[^>]*/g;
const BUTTONS_INSIDE = /<(Button|button|WearPicker|RelatedFragrancePicker|TestimonialsField|TierPriceEditor)\b/;

const check = (file) => {
  const text = blankComments(readFileSync(join(src, file), 'utf8'));
  const blocks = labelBlocks(text);

  const unnamed = [];
  let controls = 0;
  for (const match of text.matchAll(CONTROLS)) {
    // A file picker is named by the upload label around it, and a checkbox by the text beside it — both
    // are inside labels too, so they are checked like the rest. Only a datalist option is exempt.
    controls += 1;
    if (!blocks.some(([start, end]) => match.index > start && match.index < end)) {
      unnamed.push(`line ${lineOf(text, match.index)}: <${match[1]}>`);
    }
  }
  assert.ok(controls >= 20, `${file}: expected many controls, found ${controls}`);
  assert.deepEqual(unnamed, [],
    `${file}: these controls are named by a placeholder at most, which vanishes as soon as the box is filled. `
    + `Wrap each in a <label> with its name:\n  ${unnamed.join('\n  ')}`);

  const swallowing = blocks
    .filter(([start, end]) => BUTTONS_INSIDE.test(text.slice(start, end)))
    .map(([start]) => `line ${lineOf(text, start)}`);
  assert.deepEqual(swallowing, [],
    `${file}: a <label> wraps buttons, so a click on its text presses the first one — that is how "Kerja" `
    + `was being switched by tapping a heading. Use a <div> for a group of buttons:\n  ${swallowing.join('\n  ')}`);
};

for (const file of ['components/product/ProductForm.jsx', 'components/product/MobileProductForm.jsx']) check(file);

console.log('productFormNamesEveryField selfcheck OK (every product field is named in a label, and no label swallows a button)');
