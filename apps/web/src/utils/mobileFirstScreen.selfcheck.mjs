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
