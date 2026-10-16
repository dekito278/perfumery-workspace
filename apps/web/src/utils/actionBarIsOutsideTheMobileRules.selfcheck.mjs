// `node src/utils/actionBarIsOutsideTheMobileRules.selfcheck.mjs`
//
// mobile.css opens with the rule that every control in the phone app is at least 44px:
//
//   .mobile-app button, .mobile-app a, ... { min-height: 44px; }
//
// StickyBottomActionBar renders `createPortal(actionBar, document.body)`. A portal moves the DOM node,
// so the bar hangs off <body> — OUTSIDE .mobile-app — and not one of those rules reaches it. The bar
// holds the primary action of every phone screen: Lanjut on each step of the bespoke wizard, Bayar at
// checkout, Tambah ke keranjang on the product page.
//
// Measured on the live phone shop before the rule below existed: the bespoke wizard's Kembali and Lanjut
// were 36px tall and the product page's add-to-cart 40px, while every control that stayed inside the
// shell measured exactly 44. The gap was invisible in the source — both files look careful on their own.
//
// Only the tap size is borrowed, never the whole rulebook: `.mobile-app * { letter-spacing: 0 }` would
// flatten the tracking the bar's uppercase labels are set in.
//
// The rule is demanded only WHILE the portal exists. Someone who makes the bar a child of the shell
// instead has fixed the same problem a better way, and this check retires itself rather than insisting
// on CSS nothing needs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const bar = read('components', 'mobile-ui', 'StickyBottomActionBar.jsx');
const mobileCss = read('styles', 'mobile.css');

// The house rule this is all about. If it goes, the premise goes with it.
assert.match(mobileCss, /\.mobile-app button,[\s\S]{0,200}?min-height:\s*44px/,
  'mobile.css no longer sets a 44px minimum for controls inside .mobile-app — that rule is the whole '
  + 'reason this check exists');

const portalsToBody = /createPortal\(\s*actionBar\s*,\s*document\.body\s*\)/.test(bar);
if (portalsToBody) {
  assert.match(bar, /className=\{cn\(\s*'mobile-action-bar'/,
    'the bar is portaled out of .mobile-app and no longer carries the mobile-action-bar class, so the '
    + 'CSS rule written for it selects nothing');
  assert.match(mobileCss, /\.mobile-action-bar button,[\s\S]{0,200}?min-height:\s*44px/,
    'StickyBottomActionBar portals to document.body, so it sits outside .mobile-app and the 44px '
    + 'minimum never reaches it. Without a rule scoped to .mobile-action-bar, the primary action of '
    + 'every phone screen is whatever height its padding happens to give it — 36px on the bespoke '
    + 'wizard and 40px on the product page, measured live');
} else {
  assert.match(bar, /createPortal/,
    'the bar no longer portals at all: if it now renders inside the shell this check has retired, but '
    + 'say so here rather than leaving a rule in mobile.css that nothing explains');
}

// And the reserved space below it is still measured rather than guessed, because a taller control makes
// a taller bar: the spacer reads the height the component publishes.
assert.match(bar, /--mobile-action-bar-height/,
  'the bar must keep publishing its own height; the spacer under it is calculated from that, and a '
  + '44px minimum changes the number');
assert.match(mobileCss, /var\(--mobile-action-bar-height/,
  'mobile.css must keep reading the published height for the spacer');

console.log('actionBarIsOutsideTheMobileRules selfcheck OK (the portaled action bar carries the 44px '
  + 'minimum the shell could not give it)');
