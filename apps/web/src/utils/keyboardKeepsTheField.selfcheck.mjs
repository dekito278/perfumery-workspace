// `node src/utils/keyboardKeepsTheField.selfcheck.mjs`
//
// Dekito, 2026-11-08, about the Studio on his phone: "perbaiki yg janggal seperti keyboard yg menutup".
//
// useMobileKeyboardAvoidance scrolls a focused field clear of the keyboard, and it aims at an "anchor"
// rather than the bare field so the label comes along. The anchor is a guess — the nearest label, or the
// nearest `.space-y-*` wrapper — and on a phone that wrapper is often a whole page section. Tapping "Kurir"
// in the first card of the Fulfillment queue (one `.space-y-3` holding every order) scrolled the page by
// 682px, then 640 and 207 more as the settle timers re-measured, until the LIST's bottom edge cleared the
// keyboard. The field being typed into went off the top of the screen. Same on the raw-material search,
// the customer tier select, and the formula composer's fields.
//
// Run, not read: keyboardScrollDelta is the arithmetic, and it must never trade the field for its anchor.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { keyboardScrollDelta } from '../hooks/useMobileKeyboardAvoidance.js';

const box = (top, height) => ({ top, bottom: top + height });
// A 390x844 phone with a 320px keyboard: 524px left, minus the 18px top gap and the 28px bottom gap.
const bounds = { top: 18, bottom: 524 - 28 };

// --- the measured case -------------------------------------------------------------------------------
// The field is on screen; its anchor is the whole queue, 2000px tall. Nothing to do.
assert.equal(keyboardScrollDelta({ field: box(300, 44), anchor: box(-200, 2000), bounds }), 0,
  'a visible field must not be scrolled away to show the bottom of a wrapper taller than the screen');
// The same field under the keyboard: scroll just enough for the FIELD, not for the 2000px anchor.
const delta = keyboardScrollDelta({ field: box(600, 44), anchor: box(-200, 2000), bounds });
assert.ok(delta > 0 && delta < 200, `the field below the keyboard is lifted by a field's worth, got ${delta}`);
const after = box(600 - delta, 44);
assert.ok(after.top >= bounds.top && after.bottom <= bounds.bottom, 'and it ends up between the gap and the keyboard');

// --- the anchor still helps when it fits -------------------------------------------------------------
// A label (caption above the box) that fits: bring the caption along.
const withLabel = keyboardScrollDelta({ field: box(560, 44), anchor: box(536, 68), bounds, padding: 12 });
assert.equal(withLabel, 536 + 68 - bounds.bottom + 12, 'a label that fits is scrolled into view whole');
assert.ok(536 - withLabel >= bounds.top, 'with its caption still below the top gap');

// --- above the top, and taller than the room ---------------------------------------------------------
assert.ok(keyboardScrollDelta({ field: box(-60, 44), anchor: box(-80, 64), bounds }) < 0, 'a field above the top scrolls up');
const tall = keyboardScrollDelta({ field: box(100, 900), anchor: box(80, 920), bounds, padding: 24 });
assert.equal(tall, 100 - bounds.top - 24, 'a textarea taller than the room shows where typing starts');
assert.equal(keyboardScrollDelta({ field: box(100, 44), bounds }), 0, 'no anchor at all means the field is its own anchor');

// --- the hook uses it --------------------------------------------------------------------------------
const hook = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'useMobileKeyboardAvoidance.js'), 'utf8');
assert.match(hook, /const targetDelta = keyboardScrollDelta\(\{/, 'scrollElementIntoSafeView must take its distance from keyboardScrollDelta');
assert.doesNotMatch(hook.slice(hook.indexOf('const scrollElementIntoSafeView')), /rect\.bottom - bottom/,
  'the old arithmetic, which trusted any anchor, is back');

console.log('keyboardKeepsTheField selfcheck OK (a focused field is never scrolled off screen to show its wrapper)');
