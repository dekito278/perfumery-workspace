// `node src/utils/studioEntry.selfcheck.mjs`
//
// Dekito sent a screenshot from someone else's phone, signed in with their own account, checking out:
// a floating "Studio" button sitting over the Rp 288.000 total.
//
// The shop asks every buyer to sign in — that is what the member price is for — and the owner's shortcut
// back to Studio was gated on isAuthenticated. So it appeared for all of them, and tapping it bounced
// them out to their own account page, because ProtectedRoute gates the destination on isAdmin.
//
// The rule: a door shown to a buyer must be a door they can walk through. Anything pointing at Studio on
// a buyer-facing surface must carry the SAME check the destination does.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. What the destination demands ---------------------------------------------------------------------
const protectedRoute = read('components', 'ProtectedRoute.jsx');
assert.match(protectedRoute, /const \{ isAuthenticated, isAdmin[^}]*\} = useAuth\(\);/, 'the gate still reads both');
assert.match(protectedRoute, /if \(!isAdmin\) \{/, 'and still turns a signed-in non-admin away');

const auth = read('contexts', 'AuthContext.jsx');
assert.match(auth, /ADMIN_EMAILS\.includes\(email\)/,
  'isAdmin is an allow-list of emails, not merely "is signed in" — the whole point of the gate');
assert.match(auth, /isAdmin: !!session\?\.user && isAdminUser\(session\.user\)/, 'and the context exposes exactly that');

// --- 2. Buyer-facing surfaces may not offer a door they cannot open ---------------------------------------
// The surfaces are read from the code: anything that renders the shop's own chrome is something a buyer
// looks at. A new storefront component inherits the rule.
const surfaces = [];
for (const dir of [['layouts'], ['components', 'storefront'], ['components', 'mobile'], ['pages'], ['pages', 'mobile']]) {
  for (const name of readdirSync(join(root, ...dir))) {
    if (!name.endsWith('.jsx')) continue;
    const source = read(...dir, name);
    // Everything under components/storefront IS the shop's own chrome — the header and footer define the
    // links rather than rendering themselves, and a sabotage that added a Studio row to the footer nav
    // walked past a check that only looked for files RENDERING that chrome.
    const isBuyerChrome = dir.join('/') === 'components/storefront'
      || /<MobileCommerceLayout|<PublicHeader|<StorefrontFooter|MobileCommerceLayout = /.test(source);
    if (isBuyerChrome) surfaces.push([[...dir, name], source]);
  }
}
assert.ok(surfaces.length >= 5, `expected the buyer surfaces to be found, got ${surfaces.length}`);

const WINDOW = 400;
let gated = 0;
for (const [parts, source] of surfaces) {
  // `to="/mobile/studio"` AND `{ labelKey, to: '/mobile/studio' }`: the header and footer keep their links
  // as objects, so an attribute-only scan never saw the rows that actually build the shop's navigation.
  for (const link of source.matchAll(/(?:to|href|path)\s*[:=]\s*["'`](\/(?:mobile\/)?studio[^"'`]*)/g)) {
    gated += 1;
    const before = source.slice(Math.max(0, link.index - WINDOW), link.index);
    assert.match(before, /isAdmin/,
      `${parts.join('/')} offers ${link[1]} to a buyer without the isAdmin gate the destination itself uses — `
      + 'signing in is what the member price asks of them, so "signed in" is every buyer');
  }
}
assert.ok(gated >= 1, 'the scan found no Studio link at all — it is no longer looking at the right thing');

// --- 3. And the hidden owner tap sends a buyer somewhere that exists ---------------------------------------
const layout = read('layouts', 'MobileCommerceLayout.jsx');
assert.match(layout, /navigate\(isAdmin \? '\/mobile\/studio' : '\/mobile\/login'\)/,
  'the triple-tap owner access must not send a signed-in buyer to a page that throws them out again');
assert.doesNotMatch(layout, /\{isAuthenticated \? \(\s*<Link\s+to="\/mobile\/studio"/,
  'and the floating link must never go back to the "any signed-in person" gate');

console.log('studioEntry selfcheck OK (the owner door is the owner\'s, on a shop that asks everyone to sign in)');
