// `node src/utils/mobileFirstScreen.selfcheck.mjs`
//
// The greeting card in every parcel points at this site, and most of those visits open on a phone. The
// first thing they saw was "APP INITIALIZATION — Loading workspace…" — studio jargon shown to a customer —
// and nine seconds later a sheet asking them to install the app before the page had given one reason to.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { INSTALL_PROMPT_MIN_VISITS, INSTALL_PROMPT_SCROLL_PX, isMobileCommercePath, recordVisit, shouldSurfaceInstallPrompt } from './mobileFirstScreen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Which /mobile paths are the storefront ---------------------------------------------------------
for (const path of ['/mobile', '/mobile/', '/mobile/dashboard', '/mobile/catalog', '/mobile/products/lintang-asmoro', '/mobile/customer/invoice/SOLI1', '/mobile/checkout', '/mobile/home']) {
  assert.equal(isMobileCommercePath(path), true, `${path} is the storefront and gets the wordmark`);
}
for (const path of ['/mobile/studio', '/mobile/studio/orders', '/mobile/login', '/mobile/authenticator', '/mobile/raw-materials', '/mobile/journal/new', '/studio', '/catalog', '']) {
  assert.equal(isMobileCommercePath(path), false, `${path} is not the storefront; "Loading workspace" stays honest there`);
}
assert.equal(isMobileCommercePath('/mobile/catalogue-x'), false, 'prefix match must respect the path boundary');

// --- 2. When the install prompt may appear ---------------------------------------------------------------
assert.equal(shouldSurfaceInstallPrompt({ visits: 1, scrolledPx: 0 }), false, 'first visit, no scroll: not yet — this is the case that used to fire');
assert.equal(shouldSurfaceInstallPrompt({ visits: 2, scrolledPx: 0 }), true, 'second visit: they came back');
assert.equal(shouldSurfaceInstallPrompt({ visits: 1, scrolledPx: INSTALL_PROMPT_SCROLL_PX }), true, 'first visit but a real scroll: they are reading');
assert.equal(shouldSurfaceInstallPrompt({ visits: 1, scrolledPx: INSTALL_PROMPT_SCROLL_PX - 1 }), false, 'a nudge of the thumb is not a scroll');
assert.equal(shouldSurfaceInstallPrompt({ visits: 9, scrolledPx: 9999, dismissed: true }), false, 'dismissed stays dismissed');
assert.equal(shouldSurfaceInstallPrompt({ visits: 9, scrolledPx: 9999, standalone: true }), false, 'already installed: never');
assert.equal(shouldSurfaceInstallPrompt(), false, 'called with nothing: not yet, and no crash');
assert.equal(shouldSurfaceInstallPrompt({ visits: 'abc', scrolledPx: null }), false, 'garbage counts as zero');
assert.ok(INSTALL_PROMPT_MIN_VISITS >= 2, 'the threshold must be a return visit, or the rule means nothing');

// --- 3. Visits are counted once per session, across sessions ------------------------------------------
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
const local = mem(); let session = mem();
assert.equal(recordVisit(local, session), 1, 'first visit counts once');
assert.equal(recordVisit(local, session), 1, 'a second component in the same session must not double count');
session = mem();
assert.equal(recordVisit(local, session), 2, 'a new session is a new visit');
// Blocked or throwing storage: the property that matters is not the exact number but that it can NEVER
// unlock the prompt — a browser that forgets everything must be treated as a first-time visitor forever.
assert.ok(recordVisit(null, null) < INSTALL_PROMPT_MIN_VISITS, 'storage blocked: never a return visit, and no crash on first paint');
const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
assert.ok(recordVisit(throwing, throwing) < INSTALL_PROMPT_MIN_VISITS, 'a storage that throws must not unlock the prompt either');
assert.ok(recordVisit(throwing, throwing) < INSTALL_PROMPT_MIN_VISITS, 'and not on the second call either — it cannot remember, so it cannot count');

// --- 4. The storefront gets the wordmark, the studio keeps its loading state -----------------------------
const app = read('App.jsx');
assert.match(app, /if \(isMobileCommercePath\(pathname\)\) \{\s*return <StorefrontSplash \/>;/, 'storefront paths must fall back to the splash');
assert.ok(app.indexOf('isMobileCommercePath(pathname)') < app.indexOf("pathname === '/mobile' || pathname.startsWith('/mobile/')"), 'the storefront check must come BEFORE the generic mobile one, or it never runs');
assert.match(app, /title="Loading workspace\.\.\."/, 'the studio keeps its own loading state');

const splash = read('components', 'mobile-ui', 'StorefrontSplash.jsx');
assert.doesNotMatch(splash, /workspace|initialization|Menyiapkan/i, 'no studio jargon on the customer splash');
assert.match(splash, /SOLIVAGANT/, 'the wordmark is the whole screen');
assert.match(splash, /aria-label="Memuat Solivagant"/, 'and a screen reader is told what it is');

// --- 4b. EVERY public route, not just the mobile ones ---------------------------------------------------
// The list above is hand-written, and its own comment claims it is "derived from the route table in
// App.jsx" — a claim nothing checked. /mobile/about was missing from it, so the one buyer page on the
// phone that is shared with the desktop opened on "APP INITIALIZATION — Loading workspace…", which is
// the exact screen this guard exists to keep away from customers.
//
// So the question is asked of every public route instead: which fallback does RouteFallback hand it?
// The lists are read out of App.jsx rather than restated here, and the branch ORDER is asserted against
// the file, because replaying it in the wrong order would answer a different question than the app does.
{
  const list = (name) => {
    const body = app.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
    assert.ok(body, `${name} has moved or been renamed — this check reads it out of App.jsx`);
    const entries = body[1].split(',').map((entry) => entry.trim().replace(/^'|'$/g, '')).filter(Boolean);
    assert.ok(entries.length, `${name} parsed as empty`);
    return entries;
  };
  const storefrontPrefixes = list('storefrontRoutePrefixes');
  const studioPrefixes = list('desktopProtectedRoutePrefixes');
  const ownerDoor = list('OWNER_DOOR_ROUTES');

  // The order the file actually checks them in. Each pair fails the day one moves above the other.
  const at = (needle) => {
    const index = app.indexOf(needle);
    assert.ok(index > 0, `RouteFallback no longer contains ${needle} — the branch it guarded has moved`);
    return index;
  };
  assert.ok(at("pathname === '/home'") < at('isDesktopProtectedRoute(pathname)'), 'home is answered first');
  assert.ok(at('isStorefrontRoute(pathname)') < at('isMobileCommercePath(pathname)'), 'desktop before phone');
  assert.ok(at('isMobileCommercePath(pathname)') < at("pathname === '/mobile' || pathname.startsWith('/mobile/')"),
    'the storefront check must come BEFORE the generic mobile one, or it never runs');
  assert.ok(at("pathname === '/mobile' || pathname.startsWith('/mobile/')") < at('OWNER_DOOR_ROUTES.includes(pathname)'),
    'the phone branches must come before the desktop catch-all, which only excludes /mobile by hand');

  const matches = (prefixes, path) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const fallbackFor = (path) => {
    if (path === '/home' || path === '/') return 'shop';
    if (!path.startsWith('/mobile') && matches(studioPrefixes, path)) return 'studio';
    if (!path.startsWith('/mobile') && matches(storefrontPrefixes, path)) return 'shop';
    if (isMobileCommercePath(path)) return 'shop';
    if (path === '/mobile' || path.startsWith('/mobile/')) return 'studio';
    if (!ownerDoor.includes(path)) return 'shop';
    return 'studio';
  };

  // Public means: no <ProtectedRoute> in the route block. The block ends at the next <Route so that
  // each one carries its own element and no other — a <Navigate> route is a redirect, not a page, so it
  // never renders a fallback and must not be counted as one. The catch-all stands for every address
  // nobody has, which lands on NotFoundPage — a shop page.
  //
  // This rule asks only "whose loading screen does this path get", and that is decided by the path, so
  // it survives a sloppier cut; the floor below is what protects it from a parse that collapses.
  const blocks = app.split(/(?=<Route\b)/).slice(1).map((part) => {
    const next = part.slice(1).search(/<Route\b/);
    return next === -1 ? part : part.slice(0, next + 1);
  });
  const publicPaths = [];
  for (const block of blocks) {
    const path = (block.match(/path="([^"]+)"/) || [])[1];
    if (!path || /<ProtectedRoute/.test(block) || /element=\{<Navigate/.test(block)) continue;
    if (/^\/(?:studio|mobile\/studio)/.test(path)) continue;
    publicPaths.push(path === '*' ? '/an-address-nobody-has' : path.replace(/\/:[^/]+/g, '/x'));
  }
  assert.ok(publicPaths.length >= 40,
    `only ${publicPaths.length} public routes parsed from App.jsx — the parse is broken, not the router`);
  assert.ok(publicPaths.includes('/mobile/about'),
    'the /mobile/about route is missing from the parse, and it is the one that was broken');

  const studioScreened = publicPaths.filter((path) => fallbackFor(path) === 'studio' && !ownerDoor.includes(path));
  assert.deepEqual(studioScreened, [],
    'these are addresses a stranger can open, and the first thing they would see while the page loads is '
    + `the studio's own loading screen -- "APP INITIALIZATION / Loading workspace...":\n  ${studioScreened.join('\n  ')}`);
  for (const door of ownerDoor) {
    assert.equal(fallbackFor(door), 'studio',
      `${door} is the owner's door and keeps the studio screen; if it now shows the shop skeleton, the `
      + 'exemption list above is pointing at nothing');
  }
}

// --- 4c. The two shop fallbacks say nothing of their own -------------------------------------------------
// Both render components that read their own copy from the message file, and both used to override it
// with a literal: "Preparing storefront" over an Indonesian sentence on all 25 storefront routes, and a
// whole second English hero -- a third wording of the eyebrow, the headline and the brand sentence -- on
// the home page, which an Indonesian visitor read until the chunk arrived and then watched change.
{
  // Only the two SHOP fallbacks. The studio branches in the same function keep their own words on
  // purpose -- "Loading workspace" is honest in front of the one person who speaks Indonesian -- so
  // slicing the whole of RouteFallback would have failed on copy that is right.
  const home = app.slice(app.indexOf('const HomeRouteFallback'), app.indexOf('const RouteFallback'));
  const storefrontBranch = app.slice(app.indexOf('if (isStorefrontRoute(pathname))'),
    app.indexOf('if (isMobileCommercePath(pathname))'));
  for (const [what, source] of [['the home skeleton', home], ['the storefront skeleton', storefrontBranch]]) {
    const literals = (source
      .replace(/\bclassName=(?:"[^"]*"|\{[^}]*\})/g, '')
      .match(/'[^'\n]*'|"[^"\n]*"/g) || [])
      .filter((literal) => / /.test(literal) && /[A-Za-zÀ-ÿ]{2}/.test(literal));
    assert.deepEqual(literals, [],
      `${what} holds copy of its own instead of the keys the real page uses: ${literals.join(' | ')}`);
    assert.doesNotMatch(source, />\s*[A-Za-z][^<>{}]{3,}</,
      `${what} prints a bare sentence, so it can only ever be in one of the two languages`);
  }
  assert.match(home, /t\('home\.eyebrow'\)[\s\S]*t\('home\.heroTitle'\)[\s\S]*t\('home\.lead'\)/,
    'the home skeleton must borrow the hero\'s own three keys, so the words do not change when the real '
    + 'page arrives');
  assert.match(storefrontBranch, /<StorefrontLoadingState mode=/,
    'the storefront skeleton must pass only its mode: title and description come from the message file');
  assert.doesNotMatch(home, /actions=\{/,
    'the home skeleton passes its own action list again; the header\'s default list is already translated');
}

// --- 5. The prompt goes through the gate, everywhere it can fire --------------------------------------------
const prompt = read('components', 'mobile', 'PwaInstallPrompt.jsx');
assert.match(prompt, /recordVisit\(window\.localStorage, window\.sessionStorage\)/, 'the prompt must count the visit');
assert.match(prompt, /addEventListener\('scroll', onScroll, \{ passive: true \}\)/, 'and watch the scroll, passively');
assert.equal((prompt.match(/shouldShowPrompt\(visits, scrolledPx\)/g) || []).length, 3, 'iOS timer, Android deferred prompt and the beforeinstallprompt handler must all pass the gate');
assert.doesNotMatch(prompt, /shouldShowPrompt\(\)/, 'no ungated call may remain');

// Every effect that READS the gate must list what the gate reads. The Android branch did not, so it kept
// the values from its first run: beforeinstallprompt fires before any scroll, the gate said no, and the
// effect never ran again — the scroll path was dead on Android and only a second visit worked. Found from
// an eslint react-hooks/exhaustive-deps warning that I shipped and then described as "unchanged".
for (const deps of prompt.match(/\}, \[[^\]]*\]\);/g) || []) {
  const body = prompt.slice(0, prompt.indexOf(deps));
  const effectStart = body.lastIndexOf('useEffect(');
  const effectBody = prompt.slice(effectStart, prompt.indexOf(deps));
  if (!/shouldShowPrompt\(visits, scrolledPx\)/.test(effectBody)) continue;
  assert.match(deps, /visits/, 'an effect that reads the gate must re-run when visits changes');
  assert.match(deps, /scrolledPx/, 'and when the scroll distance changes');
}
assert.match(prompt, /shouldSurfaceInstallPrompt\(\{/, 'the gate is the shared rule, not a local re-guess');

// --- 6. Scroll is measured from where the page STARTED, not from the top ---------------------------------
// Seen live after #151 shipped: the browser restored scrollY = 800 from an earlier visit to the same URL and
// fired a scroll event for it, so a first visit with no touch opened the gate. Intent is distance travelled
// since mount; a restored position is the browser's doing, not the visitor's.
assert.match(prompt, /const startY = window\.scrollY \|\| 0;/, 'the listener must capture the position at mount');
assert.match(prompt, /Math\.max\(0, \(window\.scrollY \|\| 0\) - startY\)/, 'and score only the distance travelled since then');
assert.doesNotMatch(prompt, /setScrolledPx\(window\.scrollY/, 'never the absolute position');

console.log('mobileFirstScreen selfcheck OK (wordmark first, install prompt only once they have shown they want to be here)');
