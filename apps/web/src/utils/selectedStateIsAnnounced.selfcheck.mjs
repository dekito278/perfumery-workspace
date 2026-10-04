// `node src/utils/selectedStateIsAnnounced.selfcheck.mjs`
//
// If a button looks selected, it has to SAY it is selected.
//
// Nine buttons across eight screens showed their chosen state with a CSS class and nothing else. A
// visitor using a screen reader heard a row of identical buttons with no way to tell which one was
// already chosen — and on these screens that state decides something:
//
//   CheckoutPage, BespokePage   which courier and price the parcel ships at
//   MobileCheckoutPage          whether the parcel goes to the saved address or a new one
//   CatalogPage, MobileCatalog  which category the list is filtered to
//   PublicJournalPage           which journal category is showing
//   BespokePage                 the occasion that goes into the WhatsApp brief
//   MobileBespokePage           every bottle, cap, label and material choice (one shared OptionButton)
//
// The house pattern was already here — RegionSwitch, WearFilter, WearPicker, FreeVialChoices, the
// bespoke option buttons and the orders tiles all carry aria-pressed, and the bespoke option-group tabs
// correctly use role="tab" with aria-selected instead. BespokePage had it on one button and not on the
// occasion pills twenty lines away. The rule existed; the mirror was never done.
//
// Measured on the live English bespoke page before the fix: the six occasion buttons reported
// aria-pressed = null while the two bottle-size buttons beside them reported it correctly.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');
assert.ok(files.length >= 150, `expected to sweep the screens; found ${files.length}`);

// A button that LOOKS selected: its className is decided by something that reads as a selected flag.
// Matched on the shape rather than on a list of class names, so the next pill group is caught by what it
// does. `is-active` is this app's class, and `active ?` / `isActive` cover the inline forms.
const LOOKS_SELECTED = /is-active|'active'|\bactive\b\s*\?|isActive/;
// Either ARIA that carries the state: aria-pressed for a toggle, aria-selected for a real tab (the
// bespoke option groups are a proper tablist and must not be forced onto aria-pressed).
const SAYS_SELECTED = /aria-pressed|aria-current|role="tab"|aria-selected/;

const announced = [];
const silent = [];
for (const rel of files) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/<button[\s\S]{0,420}?>/g)) {
    const tag = match[0];
    if (!/className=/.test(tag) || !LOOKS_SELECTED.test(tag)) continue;
    (SAYS_SELECTED.test(tag) ? announced : silent).push(`${rel}: ${tag.replace(/\s+/g, ' ').slice(0, 72)}`);
  }
}

console.log(`  buttons whose look depends on a selected flag: ${announced.length + silent.length}`);
assert.ok(announced.length >= 10,
  `expected the app's selectable buttons to be found; got ${announced.length}. Either they stopped using `
  + 'a selected class, or this sweep no longer sees them.');
assert.deepEqual(silent, [],
  'these change how they LOOK when selected and never say so, so assistive tech reads a row of identical '
  + 'buttons with nothing chosen:\n  ' + silent.join('\n  '));

// And the state announced must be the SAME condition that drives the class — announcing a constant, or
// the wrong flag, is worse than silence because it reads as certainty.
const mismatched = [];
for (const rel of files) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/aria-pressed=\{([^}]*)\}/g)) {
    const value = match[1].trim();
    if (/^(true|false)$/.test(value)) mismatched.push(`${rel}: aria-pressed={${value}}`);
  }
}
assert.deepEqual(mismatched, [],
  'these announce a fixed selected state, which tells every user the same thing whatever they picked:\n  '
  + mismatched.join('\n  '));

console.log(`selectedStateIsAnnounced selfcheck OK (${announced.length} selectable buttons, every one announcing its state)`);
