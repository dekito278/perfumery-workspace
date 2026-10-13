// `node src/utils/buyerTextComesFromTheMessageFile.selfcheck.mjs`
//
// The shop has two languages, and the strings a SCREEN READER announces were leaking in both directions:
//
//   BackToTop            aria-label="Kembali ke atas"        Indonesian, in the English shop too
//   ProductGallery x5    aria-label="Previous product image" English, in the Indonesian shop too
//   MobileProductDetail  aria-label="Product action"         same
//   MobileCommerceLayout aria-label="Solivagant owner access"
//
// The last one was its own problem. That wordmark is the OWNER's way in -- three taps opens Studio -- and
// the label announced that hidden affordance to every buyer who uses a screen reader. It says SOLIVAGANT
// now: the brand needs no translation, and the gesture goes back to being quiet.
//
// storefrontMessages.selfcheck.mjs could not catch any of it. That guard scans a hand-written list of
// Indonesian PHRASES, so a leak in English is invisible to it, and so is an Indonesian phrase nobody
// thought to add. This one reads a DIRECTORY instead -- components/storefront is buyer-facing by
// construction, so there is no list to fall behind -- and asks a different question: does every string a
// screen reader reads come from the message file?
//
// Scope is deliberately narrow and stated: this directory plus the mobile commerce layout. Buyer PAGES
// are not swept here, because no rule separates them from Studio pages by name -- MobileCustomersPage is
// Studio. Widening it means naming them, and a named list is the thing this guard exists to avoid.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// Strings a screen reader or a hint field reads out, plus the ones a component renders as visible text
// when a caller hands them over as a prop. Not className, not href, not data-*. The list is measured, not
// guessed: across every buyer-reachable file these are the only text-bearing props that are ever given a
// literal, and `eyebrow` joined it because PaymentPage labelled its header "Secure" in English.
const SPOKEN_PROPS = /\b(aria-label|alt|title|subtitle|placeholder|eyebrow|\w*[Ll]abel)="([^"{}]{2,})"/g;
// The same question asked of a prop DEFAULT. A default is invisible to the scan above, which is how
// aria-label="Clear search" survived inside a search bar the shop and Studio share.
const SPOKEN_PROP_NAME = /^(?:aria-label|alt|title|subtitle|placeholder|eyebrow)$|[Ll]abel$/;

// Each exemption carries its reason, because an allowlist without one becomes a dumping ground.
// Public, but not the buyer's: reached only by someone who tried a protected route and was bounced to
// sign in. One reader, who speaks Indonesian — the same reason Studio stays out of MESSAGES.
const OWNER_DOOR = new Set(['LoginPage', 'MobileLoginPage', 'ResetPasswordPage']);

// Mounted in the buyer shell but gated on isAdmin inside, so a buyer never sees the words.
// storefrontMessages.selfcheck.mjs owns that rule and asserts each gate still exists; duplicating the
// assertion here would mean two places to update when a gate moves.
const SELF_GATED = new Set(['PwaUpdatePrompt', 'ConfirmHost', 'Toaster']);

const ALLOWED = new Map([
  ['SOLIVAGANT', 'the brand name, which is the same word in both shops and must not be translated'],
  ['Solivagant', 'the brand name on the desktop header logo'],
  ['Kembali ke dashboard Studio', 'rendered only inside {isAdmin ? ...} — Studio is Indonesian, and a '
    + 'buyer never sees this control'],
  ['081234567890', 'an Indonesian phone-number example on a checkout that is domestic-only; not prose'],
  ['SOLI09232', 'an order-code example — a code format, the same characters in either language'],
  ['123456', 'a six-digit code example'],
]);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return /\.jsx$/.test(entry.name) ? [full] : [];
});

// The PAGES come from the route table, not from a list anybody maintains. Every <Route> whose element is
// not wrapped in <ProtectedRoute> is reachable without signing in, which is the only definition of
// "buyer-facing" the app actually enforces — and it means a new public page is swept the day it is routed.
//
// Two traps, both hit while writing this:
//   * the import convention is lazyRoute(() => import('@/...')), not lazy(...), so a narrower pattern
//     resolved 9 of 24 components and silently skipped the rest;
//   * a route block must be cut at the next <Route, not at the first "/>" — `element={<ByShop a={<X />}
//     b={<Y />} />}` ends at X's slash, which dropped InternationalCartPage from the sweep entirely.
const app = readFileSync(join(src, 'App.jsx'), 'utf8');
const imports = new Map();
for (const m of app.matchAll(/import\s+(\w+)\s+from\s+'@\/([^']+)'/g)) imports.set(m[1], m[2]);
for (const m of app.matchAll(/const\s+(\w+)\s*=\s*\w*[Ll]azy\w*\(\s*\(\)\s*=>\s*import\('@\/([^']+)'\)/g)) imports.set(m[1], m[2]);
const routeBlocks = app.split(/(?=<Route\b)/).slice(1).map((part) => {
  const next = part.slice(1).search(/<Route\b/);
  return next === -1 ? part : part.slice(0, next + 1);
});
const publicNames = new Set();
const protectedNames = new Set();
const STRUCTURAL = ['Route', 'ProtectedRoute', 'Navigate', 'ByShop', 'DomesticOnly'];
for (const block of routeBlocks) {
  const target = /<ProtectedRoute/.test(block) ? protectedNames : publicNames;
  for (const m of block.matchAll(/<([A-Z]\w+)/g)) {
    if (!STRUCTURAL.includes(m[1])) target.add(m[1]);
  }
}
// Reachable without signing in, and never also mounted behind the gate.
const resolveComponent = (name) => {
  const rel = imports.get(name);
  if (!rel) return null;
  for (const candidate of [rel, `${rel}.jsx`]) {
    if (existsSync(join(src, candidate))) return join(src, candidate);
  }
  return null;
};
const routedBuyerFiles = [...publicNames]
  .filter((name) => !protectedNames.has(name) && !OWNER_DOOR.has(name) && !SELF_GATED.has(name))
  .map(resolveComponent)
  .filter(Boolean);
assert.ok(routedBuyerFiles.length >= 20,
  `only ${routedBuyerFiles.length} public pages resolved from the route table — the derivation is broken, `
  + 'not the shop. The lazyRoute trap produces exactly this symptom');
// A count floor does NOT catch the truncation trap: cutting each route at its first "/>" still leaves
// twenty-odd pages, it just loses the ones nested inside another element. So the pages that can only be
// reached THROUGH a wrapper are named. Both of these are mounted as <ByShop domestic={...}
// international={...} />, and a naive cut drops whichever comes second.
for (const name of ['InternationalCartPage', 'MobileInternationalCartPage']) {
  const file = resolveComponent(name);
  assert.ok(file && routedBuyerFiles.includes(file),
    `${name} is routed for the English shop but fell out of the sweep — it is nested inside another `
    + 'element, which is exactly what a route block cut at its first "/>" loses');
}

// Buyer-reachable means reachable BY IMPORT from one of those pages — not "lives in a buyer folder".
// Stopping at the routed file missed two whole layers: the route table mounts MobileCommerceTabsPage and
// the catalog, storefront and articles screens are its children, and every shared control the buyer
// screens render (the search bar, the sticky action bar, the top bar) lives under components/mobile-ui
// next to Studio's. Following the imports needs no list and no naming convention.
const resolveModule = (rel) => {
  for (const candidate of [rel, `${rel}.jsx`]) {
    if (existsSync(join(src, candidate))) return join(src, candidate);
  }
  return null;
};
const reachable = new Set([
  ...walk(join(src, 'components', 'storefront')),
  join(src, 'layouts', 'MobileCommerceLayout.jsx'),
  ...routedBuyerFiles,
]);
const queue = [...reachable];
while (queue.length) {
  const file = queue.pop();
  for (const match of readFileSync(file, 'utf8').matchAll(/from\s+'@\/((?:pages|components|layouts)\/[^']+)'/g)) {
    const next = resolveModule(match[1]);
    // A self-gated component stays out however it is reached: the gate is inside it, so a buyer never
    // hears its words no matter which buyer file imports it.
    if (!next || reachable.has(next) || SELF_GATED.has(basename(next, '.jsx'))) continue;
    reachable.add(next);
    queue.push(next);
  }
}
const files = [...reachable].filter((file) => file.endsWith('.jsx'));
assert.ok(files.length >= 60,
  `only ${files.length} buyer files found — this guard's file set is broken, not the shop. The closure `
  + 'reached 74 when it was written; a number near the routed-page count means the import walk died');
assert.ok(files.some((file) => file.endsWith('MobileCatalogPage.jsx')),
  'the mobile catalog is not in the sweep — it is mounted as a child of MobileCommerceTabsPage, so only '
  + 'the import walk can find it, and that is the hole this closure exists to close');
// One level is not enough, and a count floor cannot tell the difference: the tabs page reaches the
// articles screen, which reaches the search bar. A walk that forgot to queue what it found still
// collected enough files to pass every count here.
assert.ok(files.some((file) => file.endsWith(join('mobile-ui', 'MobileSearchBar.jsx'))),
  'the shared search bar is not in the sweep, so the walk is only going one level deep: it is reached '
  + 'through MobileCommerceTabsPage -> MobileArticlesPage -> MobileSearchBar');

const leaks = [];
const seen = new Set();
for (const file of files) {
  for (const match of strip(readFileSync(file, 'utf8')).matchAll(SPOKEN_PROPS)) {
    const [, prop, value] = match;
    seen.add(value.trim());
    if (ALLOWED.has(value.trim())) continue;
    leaks.push(`${file.replace(`${src}/`, '')}  ${prop}="${value.trim()}"`);
  }
}
assert.deepEqual(leaks, [],
  'a string a screen reader reads is written straight into a buyer-facing file instead of coming from the '
  + `message file, so it is wrong in one of the two shops:\n  ${leaks.join('\n  ')}`);

// --- A default is a string too ----------------------------------------------------------------------
// MobileSearchBar hard-coded aria-label="Clear search", and no caller could fix it: Studio renders that
// bar too, so the string cannot simply be translated. The repair is a prop whose default stays Studio's
// — which moves the string somewhere the attribute scan above cannot see it. So the rule is: a shared
// control may keep a spoken default, but every buyer-facing caller has to override it.
const openingTag = (text, from) => {
  let depth = 0;
  let quote = null;
  for (let index = from; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (char === '>' && depth === 0) {
      return text.slice(from, index + 1);
    }
  }
  return text.slice(from);
};
// `'aria-label': ariaLabel = 'Mobile actions'` is one prop with two names; the JSX one is what a caller
// writes, and reading the alias instead reported all six action bars as unfixed when all six pass it.
const spokenDefaults = new Map();
for (const file of files) {
  const text = strip(readFileSync(file, 'utf8'));
  for (const match of text.matchAll(/(?:'([^']+)'\s*:\s*\w+|\b(\w+))\s*=\s*'([^']{2,})'\s*(?=,|\n\s*\})/g)) {
    const prop = match[1] || match[2];
    if (!SPOKEN_PROP_NAME.test(prop)) continue;
    if (!spokenDefaults.has(file)) spokenDefaults.set(file, []);
    spokenDefaults.get(file).push({ prop, value: match[3] });
  }
}
const defaultedProps = [...spokenDefaults.values()].flat().map((entry) => entry.prop);
for (const prop of ['clearLabel', 'backLabel']) {
  assert.ok(defaultedProps.includes(prop),
    `the default scan never found ${prop}, which is declared with a string default in a file in scope — `
    + 'it has stopped reading defaults, so the check below is passing on nothing');
}

const defaultLeaks = [];
for (const file of files) {
  const text = strip(readFileSync(file, 'utf8'));
  // Every name an import clause brings in, default AND named: the ui primitives arrive as
  // `import { Spinner } from ...`, and a default-import-only pattern left this rule silent for all of
  // them — removing the storefront spinner's aria-hidden walked straight past it.
  const rendered = new Map();
  for (const match of text.matchAll(/import\s+([^;]*?)\s+from\s+'@\/([^']+)'/g)) {
    const target = resolveModule(match[2]);
    if (!target || !spokenDefaults.has(target)) continue;
    for (const name of match[1].match(/[A-Z]\w+/g) || []) rendered.set(name, target);
  }
  for (const [name, target] of rendered) {
    for (const match of text.matchAll(new RegExp(`<${name}(?=[\\s/>])`, 'g'))) {
      const tag = openingTag(text, match.index);
      // aria-hidden settles it too: a control removed from the accessibility tree says nothing in any
      // language, which is the right answer for a spinner sitting beside a translated loading line.
      if (/(?:^|\s)aria-hidden\s*=/.test(tag)) continue;
      for (const { prop, value } of spokenDefaults.get(target)) {
        if (new RegExp(`(?:^|\\s)${prop}\\s*=`).test(tag)) continue;
        // The allowlist answers defaults as well as attributes, and for the same reason: the brand name
        // is the same word in both shops, so a caller has nothing to override.
        if (ALLOWED.has(value)) continue;
        defaultLeaks.push(`${file.replace(`${src}/`, '')}  <${name}> leaves ${prop} at "${value}"`);
      }
    }
  }
}
assert.deepEqual(defaultLeaks, [],
  'a buyer-facing screen renders a shared control without overriding a spoken prop, so the control falls '
  + `back to the one language its default is written in:\n  ${defaultLeaks.join('\n  ')}`);

// --- The scan proves itself ---------------------------------------------------------------------------
// If SPOKEN_PROPS stopped matching, the leak assertion above would pass on a shop full of leaks. So the
// proof runs THROUGH the same regex: the strings the allowlist exempts are real literals in these files,
// so the scan must have seen them. Checking the raw file text instead proves nothing about the regex —
// which is exactly how a sabotaged pattern walked past the first version of this file.
const MUST_BE_SEEN = ['SOLIVAGANT', 'Kembali ke dashboard Studio'];
for (const value of MUST_BE_SEEN) {
  assert.ok(ALLOWED.has(value), `${value} must stay on the allowlist with its reason`);
  assert.ok(seen.has(value),
    `the scan never saw "${value}", which is written into a file in scope — SPOKEN_PROPS has stopped `
    + 'matching, so the leak check above is passing on nothing');
}

// --- The keys the fixed labels now use must exist in BOTH shops --------------------------------------
// A missing key renders the key itself, which is worse than either language.
for (const key of [
  'a11y.backToTop', 'a11y.galleryPrevImage', 'a11y.galleryNextImage',
  'a11y.galleryCloseZoom', 'a11y.galleryPrev', 'a11y.galleryNext', 'a11y.productAction',
  'a11y.breadcrumb', 'a11y.back', 'a11y.clearSearch', 'bsp.contactPlaceholder', 'pay.secureEyebrow',
]) {
  for (const shop of ['id', 'en']) {
    assert.ok(MESSAGES[shop]?.[key], `${key} is missing from the ${shop} shop`);
  }
  assert.notEqual(MESSAGES.id[key], MESSAGES.en[key],
    `${key} reads the same in both shops — one of them has not been translated`);
}

// --- And the wordmark must not advertise the owner's door --------------------------------------------
const layout = readFileSync(join(src, 'layouts', 'MobileCommerceLayout.jsx'), 'utf8');
assert.ok(!/aria-label="[^"]*owner access"/i.test(layout),
  'the brand wordmark announces the owner entrance again — three taps on it opens Studio, and saying so '
  + 'in its label tells every screen-reader buyer about a door meant to be quiet');

console.log(`buyerTextComesFromTheMessageFile selfcheck OK (${files.length} buyer-facing files, every `
  + `spoken string from the message file, ${spokenDefaults.size} shared controls with a spoken default, `
  + '12 keys paired across both shops)');
