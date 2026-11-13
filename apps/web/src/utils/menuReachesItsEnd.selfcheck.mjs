// `node src/utils/menuReachesItsEnd.selfcheck.mjs`
//
// Dekito's screenshot, 14 Nov 2026, iPhone: the open menu could not be scrolled to its end — "Bantuan &
// kebijakan" sat half under the browser's bottom bar. The panel's height was calc(100vh - 80px): on iOS
// 100vh is the screen with the browser's bars HIDDEN, and the header on that phone is taller than 80px, so
// the last links were below the visible screen, where no scroll inside the panel could bring them.
//
// The rule: the panel is as tall as the VISIBLE screen (dvh) below where it actually starts, measured.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'styles', 'naskah.css'), 'utf8');
const menu = css.match(/\.ng-menu \{[^}]*\}/)?.[0] || '';
assert.match(menu, /max-height: calc\(100dvh - var\(--ng-menu-top, 80px\)\);/, 'the menu is sized to the hidden-bars screen again');
assert.ok(menu.indexOf('100vh') < menu.indexOf('100dvh'), 'vh must come first, as the fallback, and dvh after it');
assert.match(menu, /overflow-y: auto;/);
assert.match(menu, /padding-bottom: env\(safe-area-inset-bottom, 0px\);/, 'the home indicator covers the last link');

const header = readFileSync(join(root, 'components', 'storefront', 'PublicHeader.jsx'), 'utf8');
assert.match(header, /wrap\?\.style\.setProperty\('--ng-menu-top', `\$\{top\}px`\);/, 'the panel top is guessed, not measured');
assert.match(header, /window\.addEventListener\('resize', placeMenu\);/, 'turning the phone leaves the old measurement');

console.log('menuReachesItsEnd selfcheck OK (the phone menu fits the visible screen below the header)');
