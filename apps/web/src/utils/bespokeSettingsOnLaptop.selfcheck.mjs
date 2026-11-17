// `node src/utils/bespokeSettingsOnLaptop.selfcheck.mjs`
//
// The bespoke options (sizes, bottles, caps, labels, materials and their prices) could only be changed
// from the phone Studio. Since 17 Nov 2026 the laptop has /studio/bespoke, built from the SAME editor, so
// a fix to one screen is a fix to both.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toMobilePath } from './deviceRouting.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const phone = read('pages', 'mobile', 'MobileBespokeSettingsPage.jsx');
const laptop = read('pages', 'BespokeSettingsPage.jsx');
for (const [name, page] of [['phone', phone], ['laptop', laptop]]) {
  assert.match(page, /import BespokeSettingsEditor from '@\/components\/BespokeSettingsEditor\.jsx';/, `${name} page uses the shared editor`);
  assert.doesNotMatch(page, /saveBespokeOption|useBespokeSettings/, `${name} page grew its own copy of the editor`);
}
assert.match(laptop, /<BespokeSettingsEditor wide \/>/);
assert.match(laptop, /<h1/, 'the laptop page has its own h1, so the editor heading must step down');
assert.match(read('components', 'BespokeSettingsEditor.jsx'), /const IntroHeading = wide \? 'h2' : 'h1';/);

const app = read('App.jsx');
assert.match(app, /<Route path="\/studio\/bespoke" element=\{\s*<ProtectedRoute>\s*<BespokeSettingsPage \/>/, 'the laptop route sits behind the Studio login');
assert.match(read('components', 'AppShell.jsx'), /\{ path: '\/studio\/bespoke', label: 'Bespoke'/, 'the laptop menu links it');
assert.equal(toMobilePath('/studio/bespoke'), '/mobile/studio/bespoke', 'a phone opening the laptop address gets the phone screen');
console.log('bespokeSettingsOnLaptop selfcheck OK (one editor, laptop route, menu, phone redirect)');
