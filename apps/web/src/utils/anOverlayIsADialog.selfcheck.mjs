// `node src/utils/anOverlayIsADialog.selfcheck.mjs`
//
// Opened the photo zoom on the phone product page with the keyboard and measured what the reader got:
//
//   role=dialog: no       aria-modal: no       accessible name: none
//   focus after opening:  still on the button BEHIND the overlay
//   controls outside it that Tab could still reach: 32
//
// The overlay covered the screen, the body scroll was locked, Escape worked — and a keyboard reader was
// tabbing through a page they could no longer see, unable to reach the overlay's own close, previous and
// next buttons without walking the whole page first.
//
// It was hand-rolled: a <div className="fixed inset-0 …">. The shop's other sheet is built on the Drawer
// primitive, which brings the dialog role and the focus trap with it, which is why this was the only one.
//
// The rule is about the SHAPE rather than about this component: a buyer-facing element that covers the
// whole screen is a dialog — it is named, it takes focus, it keeps Tab inside, and it hands focus back to
// whatever opened it. Found by walking the buyer surfaces, so a second hand-rolled overlay inherits it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buyerSurfaces } from './buyerSurfaces.mjs';

const strip = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

const { files } = buyerSurfaces({ src: 'src' });
assert.ok(files.length > 50, `only ${files.length} buyer files resolved — the derivation is broken`);

const owners = new Set();
let overlays = 0;
for (const file of files) {
  let source;
  try { source = strip(readFileSync(file, 'utf8')); } catch { continue; }
  for (const match of source.matchAll(/<div\b[^>]*fixed inset-0[^>]*>/g)) {
    const tag = match[0].replace(/\s+/g, ' ');
    // A backdrop that only paints — no handlers, nothing inside it to reach — is not a dialog.
    if (!/onClick|onKeyDown|ref=/.test(tag)) continue;
    overlays += 1;
    owners.add(file);
    const where = `${file}:${source.slice(0, match.index).split('\n').length}`;
    assert.match(tag, /role="dialog"/,
      `${where} covers the whole screen but is not a dialog, so a reader is never told they left the page:\n  ${tag.slice(0, 140)}`);
    assert.match(tag, /aria-modal="true"/,
      `${where} is a dialog that does not say it is modal, so the page behind stays part of the reading order`);
    assert.match(tag, /aria-label=|aria-labelledby=/,
      `${where} is a dialog with no name — "dialog" is all a reader hears`);
  }
}
assert.ok(overlays >= 1, 'no full-screen overlay found on any buyer surface — the scan is broken, not the code');

// And the component that owns one has to move focus in, keep it in, and give it back. Read out of the
// file the scan found rather than named here.
for (const file of owners) {
  const source = strip(readFileSync(file, 'utf8'));
  assert.match(source, /e\.key !== 'Tab'|e\.key === 'Tab'/,
    `${file} owns a full-screen dialog but never handles Tab, so focus walks out into the page behind it`);
  assert.match(source, /\?\.querySelector\(FOCUSABLE\)\?\.focus\(\)|\.focus\(\)/,
    `${file} owns a full-screen dialog but never moves focus into it`);
  assert.match(source, /opener\?\.focus\(\)/,
    `${file} owns a full-screen dialog but never returns focus to whatever opened it`);
  assert.match(source, /Escape/,
    `${file} owns a full-screen dialog with no way out by keyboard`);
}

console.log(`anOverlayIsADialog selfcheck OK (${overlays} full-screen overlay(s) on ${files.length} buyer `
  + `files, each a named modal dialog that takes focus and gives it back)`);
