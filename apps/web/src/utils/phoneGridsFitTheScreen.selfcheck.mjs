// `node src/utils/phoneGridsFitTheScreen.selfcheck.mjs`
//
// Dekito's screenshot, 14 Nov 2026, signed in on a phone: on checkout the line "Masuk sebagai
// aderizki68@gmail.com — data terisi otomatis" ran off the right edge, and every field under it with it.
// The line is one line by design (truncate), and truncation only works inside a box that has a width. The
// page's grid had NO column on a phone — `grid lg:grid-cols-[…]` — so its one implicit column was sized to
// the content, and the form grew to 501px on a 390px screen. The customer page did the same (487px).
//
// The rule, on every buyer page laid out as a two-column grid on a wide screen: on a phone the grid
// declares its one column as minmax(0,1fr), and the desktop columns are minmax(0,…) too.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUYER_PAGES = ['CheckoutPage.jsx', 'CustomerPortalPage.jsx', 'PaymentPage.jsx', 'BespokePage.jsx', 'CartPage.jsx',
  'InternationalCartPage.jsx', 'PublicProductDetailPage.jsx', 'CustomerInvoicePage.jsx', 'PublicTrackingPage.jsx', 'HelpPage.jsx'];
const present = new Set(readdirSync(join(root, 'pages')));

let checked = 0;
for (const file of BUYER_PAGES.filter((name) => present.has(name))) {
  const source = readFileSync(join(root, 'pages', file), 'utf8');
  // Page-level grids: a container whose columns appear only from a breakpoint up, with fr tracks.
  for (const match of source.matchAll(/className="([^"]*\bgrid\b[^"]*\b(?:md|lg):grid-cols-\[[^\]]*fr[^\]]*\][^"]*)"/g)) {
    const classes = match[1];
    checked += 1;
    assert.match(classes, /(^|\s)grid-cols-\[minmax\(0,1fr\)\]/,
      `${file}: "${classes}" has no column on a phone — its content decides its width and can push it off the screen`);
    const desktop = classes.match(/\b(?:md|lg):grid-cols-\[([^\]]*)\]/)[1];
    for (const track of desktop.split('_').filter((part) => /fr$/.test(part))) {
      assert.ok(false, `${file}: "${classes}" uses a bare ${track} track — write minmax(0,${track})`);
    }
  }
}
assert.ok(checked >= 5, `only ${checked} two-column page grids found — the scan is broken`);

// The line itself wraps rather than cutting the address off: it is the buyer's own account.
const checkout = readFileSync(join(root, 'pages', 'CheckoutPage.jsx'), 'utf8');
assert.match(checkout, /<span className="min-w-0 text-ng-sand \[overflow-wrap:anywhere\]">\{t\('checkout\.signedInAuto'/);

console.log(`phoneGridsFitTheScreen selfcheck OK (${checked} two-column buyer page grids keep to the screen on a phone)`);
