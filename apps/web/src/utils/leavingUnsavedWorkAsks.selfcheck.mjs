// `node src/utils/leavingUnsavedWorkAsks.selfcheck.mjs`
//
// Every way out of a page with unsaved work asks first — not only the page's own back button.
//
// Until 2026-11-10 each editor added its own beforeunload listener and put a confirm on its own back
// button. That covered closing the tab and that one button. The sidebar, the phone's bottom nav and back
// gesture, and the formula editors' "Batal" (which had no confirm at all) took the work without a word.
// The router could not hold a navigation: <BrowserRouter> has no blocker, only a data router does.
//
// So: one hook asks for every page (useUnsavedChangesWarning), the app mounts a data router so the hook
// can work at all — useBlocker THROWS outside one, which would crash every editor — and any page that
// tracks unsaved work must go through the hook rather than wire its own half of it.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    // .js/.jsx only, and no dotfiles: other chains write temporary .mjs files here while this one runs.
    else if (/\.jsx?$/.test(name) && !name.startsWith('.')) files.push(full);
  }
};
walk(src);
assert.ok(files.length > 300, `the sweep found only ${files.length} files — it is broken, not the code`);

// --- 1. The router can hold a navigation --------------------------------------------------------------
const app = stripComments(read('App.jsx'));
assert.match(app, /createBrowserRouter\(/, 'App.jsx must build a data router: useBlocker throws under <BrowserRouter>');
assert.match(app, /<RouterProvider router=\{router\} \/>/, 'and mount it');
assert.ok(!/\bBrowserRouter\b|<Router[\s>]/.test(app), 'a second, plain router would put the editors outside the data router');
// A data router catches render errors itself; thrown on, they still reach AppErrorBoundary.
assert.match(app, /ErrorBoundary: RethrowRouteError/, 'route render errors must still reach AppErrorBoundary');
assert.match(app, /const RethrowRouteError = \(\) => \{ throw useRouteError\(\); \};/);

// --- 2. The hook asks on every way out, and not after a save -------------------------------------------
const hook = stripComments(read('hooks', 'useUnsavedChangesWarning.js'));
assert.match(hook, /addEventListener\('beforeunload'/, 'closing the tab must still ask');
assert.match(hook, /useBlocker\(/, 'moving inside the app must be held by the router');
assert.match(hook, /currentLocation\.pathname !== nextLocation\.pathname/,
  'only a change of page is leaving; a query-string change (a tab, the story product picker) is not');
assert.match(hook, /if \(!enabled\) \{\s*blocker\.proceed\(\);/,
  'a navigation held while the page was saving must go through once the page is clean, not ask "discard?" about saved work');
assert.match(hook, /confirmAction\(/);
assert.match(hook, /blocker\.reset\(\)/, 'cancelling must keep the person on the page');
assert.doesNotMatch(hook, /window\.confirm/);

// --- 3. Nothing wires its own half -----------------------------------------------------------------------
const ownListeners = files
  .filter((file) => /addEventListener\(\s*'beforeunload'/.test(stripComments(readFileSync(file, 'utf8'))))
  .map((file) => relative(src, file));
assert.deepEqual(ownListeners, ['hooks/useUnsavedChangesWarning.js'],
  'a page with its own beforeunload listener protects the tab and nothing else; use useUnsavedChangesWarning');

// Every page that keeps a dirty flag hands it to the hook.
const DIRTY = /const (isDirty|hasUnsavedChanges|hasUnsavedComposition) =|isFormulaComposerDirty\(/;
const trackers = files.filter((file) => DIRTY.test(readFileSync(file, 'utf8')) && !file.includes('/utils/'));
assert.ok(trackers.length >= 9, `only ${trackers.length} editors keep a dirty flag — the pattern no longer finds them`);
for (const file of trackers) {
  assert.match(readFileSync(file, 'utf8'), /useUnsavedChangesWarning\(/,
    `${relative(src, file)} keeps a dirty flag but does not ask before leaving`);
}

// --- 4. Saving clears the flag before the page moves on --------------------------------------------------
// Otherwise the very navigation that follows a save asks "discard?" about work that is in the database,
// and a prompt that is wrong every time gets clicked through the one time it is right.
for (const [page, clear] of [
  ['pages/CreateFormulaPage.jsx', 'setFormulaCreated(true);'],
  ['pages/mobile/MobileCreateFormulaPage.jsx', 'setFormulaCreated(true);'],
  ['pages/EditFormulaPage.jsx', 'setSavedSnapshot(currentSnapshot);'],
  ['pages/mobile/MobileEditFormulaPage.jsx', 'setSavedSnapshot(currentSnapshot);'],
]) {
  const text = stripComments(read(...page.split('/')));
  const saved = text.indexOf(clear);
  assert.notEqual(saved, -1, `${page}: a successful save no longer clears the unsaved flag`);
  assert.match(text.slice(saved, saved + 200), /^[^\n]*\n\s*navigate\(/, `${page}: clear the flag, then navigate`);
}

console.log(`leavingUnsavedWorkAsks selfcheck OK (data router; ${trackers.length} editors ask on every way out; saves do not ask)`);
