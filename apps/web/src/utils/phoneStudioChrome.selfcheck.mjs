// `node src/utils/phoneStudioChrome.selfcheck.mjs`
//
// Five things the phone Studio scan of 2026-11-08 found in the frame around every screen. Each was
// measured on a 390x844 layout with a seeded e2e admin, and each is the kind of fix a later restyle undoes
// without noticing, so each is held here with its reason.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const css = read('styles', 'mobile.css');

// 1. A closed accordion section is squeezed to zero height, not removed, so its fields stayed in the tab
//    order: the keyboard's "next" arrow walked into a box nobody could see. And the header never said
//    whether it was open.
const accordion = read('components', 'mobile-ui', 'MobileAccordion.jsx');
assert.match(accordion, /aria-expanded=\{open\}/, 'the accordion header must say whether it is open');
assert.match(accordion, /inert=\{open \? undefined : ''\}/, 'a closed section must be inert, or its fields can still take focus');

// 2. Two grey grips stacked on every phone sheet: the drawer's own and MobileBottomSheet's.
assert.match(read('components', 'ui', 'drawer.jsx'), /handle = true/, 'DrawerContent must let a sheet turn its grip off');
assert.match(read('components', 'mobile-ui', 'MobileBottomSheet.jsx'), /handle=\{false\}/, 'MobileBottomSheet draws its own grip, so it turns the drawer\'s off');

// 3. The 44px minimum for phone buttons stretched Radix checkboxes (buttons) into 16x44 pills.
assert.match(css, /\.mobile-app button\[role='checkbox'\],\s*\.mobile-app button\[role='switch'\] \{\s*position: relative;\s*min-height: 0;/,
  'checkboxes and switches keep their drawn size on the phone');
assert.match(css, /\.mobile-app button\[role='checkbox'\]::after,[\s\S]{0,160}inset: -14px;/, 'and get their 44px from an invisible ring');

// 4. The floating add button sits 80px up and 56px tall; 88px of bottom padding left the dashboard's last
//    row under it even when scrolled to the end.
assert.match(css, /\.mobile-app:has\(\.mobile-fab\) \.mobile-app-shell \{\s*padding-bottom: calc\(env\(safe-area-inset-bottom, 0px\) \+ 152px\);/,
  'a screen with the add button keeps room for it below the last row');

// 5. The account button floats over the top-right corner; a page writing its own header ran under it.
assert.match(css, /\.mobile-page > header:first-child:not\(\.mobile-top-bar\) \{\s*padding-right: 48px;/,
  'a page header that is not MobileTopBar must leave the account button its corner');
assert.match(read('components', 'mobile-ui', 'MobileTopBar.jsx'), /pr-12 mobile-top-bar/, 'MobileTopBar still leaves that corner itself');

console.log('phoneStudioChrome selfcheck OK (inert accordions, one grip, square checkboxes, room for the add and account buttons)');
