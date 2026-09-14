// `node src/utils/pwaFirstVisit.selfcheck.mjs`
//
// The service worker calls clients.claim() on activate, so the FIRST worker takes control of the page
// that just installed it and fires controllerchange. There is nothing to refresh to at that moment —
// the page is already running the code the worker was built from.
//
// Reloading there cost every first-time visitor a second full page load. Measured on the live site from
// a clean browser profile: first visit 3 navigations and 6 Supabase calls, a second visit (worker
// already in control) 1 and 3. The people paying for it were new visitors, on their first impression.
//
// The fix is one bit of state, and it has to be read BEFORE registration: if there was no controller
// when the page loaded, this worker is the first, and its taking control changes nothing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const pwa = strip(readFileSync(join(src, 'utils', 'pwa.js'), 'utf8'));
const sw = strip(readFileSync(join(src, '..', 'public', 'sw.js'), 'utf8'));

// --- the worker still claims, which is what makes the guard necessary --------------------------------
assert.match(sw, /clients\.claim\(\)/,
  'the worker claims control on activate; if that ever stops, this guard should be revisited rather '
  + 'than silently protecting nothing');

// --- a reload only for a real update -----------------------------------------------------------------
assert.match(pwa, /const hadControllerAtStartup = Boolean\(navigator\.serviceWorker\.controller\);/,
  'whether a controller already existed has to be captured, or first install cannot be told from update');
assert.match(pwa, /if \(!hadControllerAtStartup \|\| refreshing\) \{/,
  'controllerchange must not reload when this is the first worker to take control');

// It must be read before register(), not after: by then the worker may already have claimed the page.
const capture = pwa.indexOf('hadControllerAtStartup =');
const register = pwa.indexOf('navigator.serviceWorker.register(');
assert.ok(capture !== -1 && register !== -1 && capture < register,
  'the controller check must run BEFORE register(), otherwise it can read the controller the new worker '
  + 'just installed and conclude an update happened on a first visit');

// The reload itself must stay — an update that installs and is never applied is its own bug.
assert.match(pwa, /refreshing = true;\s*window\.location\.reload\(\);/,
  'a genuine update still has to take effect');

console.log('pwaFirstVisit selfcheck OK (a first visit loads once; only a real update reloads)');
