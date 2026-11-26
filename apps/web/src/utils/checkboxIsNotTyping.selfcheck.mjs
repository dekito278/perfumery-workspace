// Ticking a checkbox on a phone is not typing (26 Nov 2026).
//
// Studio's phone screens hide the fixed Simpan bar while the keyboard is up. The test for "keyboard is up" was
// "an <input> has focus", so on Android — where a tapped checkbox takes focus — ticking "Pilihan di beranda" or
// "Foto utama = foto botol" made Simpan disappear until something else was tapped.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KEYBOARD_FOCUS_TARGETS } from './keyboardTargets.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const type of ['checkbox', 'radio', 'file', 'range', 'button', 'submit']) {
  assert.match(KEYBOARD_FOCUS_TARGETS, new RegExp(`:not\\(\\[type="${type}"\\]\\)`), `a ${type} opens no keyboard`);
}
for (const target of ['textarea', 'select', '[contenteditable="true"]', '[role="combobox"]', '[cmdk-input]']) {
  assert.ok(KEYBOARD_FOCUS_TARGETS.split(', ').includes(target), `${target} still counts`);
}
assert.ok(!KEYBOARD_FOCUS_TARGETS.split(', ').includes('input'), 'not every input');

// One list, used by all three places that ask the question.
for (const file of ['hooks/useMobileKeyboardState.js', 'hooks/useMobileKeyboardAvoidance.js', 'components/mobile-ui/MobileBottomSheet.jsx']) {
  const source = readFileSync(join(SRC, file), 'utf8');
  assert.match(source, /const focusTargets = KEYBOARD_FOCUS_TARGETS;/, `${file} uses the shared list`);
  assert.doesNotMatch(source, /'input, textarea/, `${file} carries its own copy again`);
}

// The stylesheet hides the same bars with :has(...:focus) where supported — a second copy of the question.
const css = readFileSync(join(SRC, 'styles', 'mobile.css'), 'utf8');
assert.doesNotMatch(css, /body:has\(input:focus\) \./, 'mobile.css hides Simpan when any input — a checkbox too — has focus');
assert.match(css, /body:has\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)[^)]*\)[^{]*\.mobile-fixed-action/);

console.log('checkboxIsNotTyping selfcheck OK');
