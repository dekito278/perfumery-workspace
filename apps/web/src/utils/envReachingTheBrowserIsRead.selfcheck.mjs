// `node src/utils/envReachingTheBrowserIsRead.selfcheck.mjs`
//
// Found by grepping the LIVE production bundle for a carrier name and hitting a commit message instead.
//
// Vite inlines every VITE_-prefixed environment variable into the client bundle. Vercel, for a project it
// detects as Vite, copies its own system variables into VITE_-prefixed twins — sixteen of them were being
// served to every visitor of solivagantscent.com, and the app reads none. One carried the whole commit
// BODY, which in this repo is a page of prose about pricing decisions, margins and defects found; others
// carried the private repository's owner and name, the project id and the deployment id.
//
// Nothing read any of them. They were in the bundle because Vite inlines the entire env object the moment
// a module reads `import.meta.env?.X` with optional chaining instead of a statically replaceable
// `import.meta.env.X` — so a `define` for one key would never have been reached.
//
// Three ways, strongest first: the built OUTPUT is searched, the dropping code is RUN, and the config is
// checked for calling it before Vite ever sees the environment.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { dropUnreadClientEnv, VERCEL_INJECTED_ENV_PREFIX } from './clientEnv.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const web = dirname(src);
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const walk = (dir) => {
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  return entries.flatMap((entry) => {
    if (/^(node_modules|dist|\.git)$/.test(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(js|jsx|mjs|ts|tsx)$/.test(entry) ? [full] : [];
  });
};

// --- 1. Every VITE_ name the app actually READS, found by walking ---------------------------------------
// Derived, not listed, so a name added in a new file is covered the day it is written. Comments stripped
// first: this very file names the leaked variables in its own header, and prose is not a read.
// Selfchecks are left out: their fixtures and prose are not what gets shipped, and this one has to name
// the leaked variables to test the drop at all.
const sources = ['src', 'api', 'tools'].flatMap((dir) => walk(join(web, dir)))
  .filter((file) => !file.endsWith('.selfcheck.mjs'));
assert.ok(sources.length > 300, `expected the whole app, walked ${sources.length} files — the scan is broken`);
const readNames = new Map();
for (const file of sources) {
  for (const [name] of stripComments(readFileSync(file, 'utf8')).matchAll(/VITE_[A-Z0-9_]+/g)) {
    // The prefix constant itself is the rule, not a variable anybody reads.
    if (name === VERCEL_INJECTED_ENV_PREFIX) continue;
    if (!readNames.has(name)) readNames.set(name, []);
    if (!readNames.get(name).includes(file)) readNames.get(name).push(file);
  }
}
assert.ok(readNames.size >= 8, `only ${readNames.size} env names found — the scan is broken, not the code`);
console.log(`  ${readNames.size} VITE_ names the app reads:`);
for (const name of [...readNames.keys()].sort()) {
  const where = readNames.get(name).map((file) => relative(web, file));
  console.log(`    ${name} — ${where.length} file(s): ${where.slice(0, 3).join(', ')}${where.length > 3 ? ', …' : ''}`);
}

// --- 2. Nothing that gets dropped is a name the app reads ----------------------------------------------
// The assertion that makes dropping safe at all. If a feature ever needs one of Vercel's variables it
// fails HERE, loudly, instead of silently reading undefined in production — and then the drop needs
// narrowing, not this guard deleting.
const readButDropped = [...readNames.keys()].filter((name) => name.startsWith(VERCEL_INJECTED_ENV_PREFIX));
assert.deepEqual(readButDropped, [],
  `the app reads ${readButDropped.join(', ')}, which the build deletes before Vite sees it — in production `
  + 'that reads as undefined. Narrow the drop, or read the unprefixed variable on the server instead');

// --- 3. The dropping code, run for real ----------------------------------------------------------------
// vite.config.js imports its plugins through Vite's own resolver and cannot be loaded by node, which is
// why the loop lives in an importable module. Run it on a fixture rather than reading it for shape: a loop
// that is present and wrong looks exactly like one that works.
const fixture = {
  VITE_VERCEL_GIT_COMMIT_MESSAGE: 'a page of notes about pricing',
  VITE_VERCEL_PROJECT_ID: 'prj_x',
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_STOREFRONT_WHATSAPP_NUMBER: '62877',
  PATH: '/usr/bin',
};
const dropped = dropUnreadClientEnv(fixture);
assert.deepEqual(dropped.sort(), ['VITE_VERCEL_GIT_COMMIT_MESSAGE', 'VITE_VERCEL_PROJECT_ID']);
assert.deepEqual(Object.keys(fixture).sort(), ['PATH', 'VITE_STOREFRONT_WHATSAPP_NUMBER', 'VITE_SUPABASE_URL'],
  'the drop took something that was not Vercel-injected — that is how a shop loses its Supabase URL');
assert.deepEqual(dropUnreadClientEnv({}), [], 'and an empty environment is not an error');

// --- 4. The build calls it, at module scope ------------------------------------------------------------
// A module nothing calls drops nothing, and a call nested in a function drops nothing until that function
// runs — a plugin hook fires long after Vite has collected the environment. Evaluating vite.config.js IS
// the only moment guaranteed to be early enough, so the call has to sit at the top level of the file.
const config = stripComments(readFileSync(join(web, 'vite.config.js'), 'utf8'));
const callLines = config.split('\n').filter((line) => line.includes('dropUnreadClientEnv(process.env)'));
assert.equal(callLines.length, 1,
  `vite.config.js calls the drop ${callLines.length} times — it must be exactly once, or nothing drops at `
  + 'all and the whole Vercel environment is back in the bundle');
assert.doesNotMatch(callLines[0], /^\s/,
  `the drop is indented, so it is nested inside something: ${callLines[0].trim()}. A call inside a plugin `
  + 'hook or a factory runs after Vite has already collected the environment');

// --- 5. And the built output, searched ------------------------------------------------------------------
// The only check that cannot be satisfied by well-shaped code. `npm run build` runs before the selfchecks,
// so in the gate this is the one that matters; it says so when there is no build to look at.
const dist = join(web, 'dist');
if (existsSync(dist)) {
  const built = walk(dist).filter((file) => file.endsWith('.js'));
  const leaking = built.filter((file) => readFileSync(file, 'utf8').includes(VERCEL_INJECTED_ENV_PREFIX))
    .map((file) => relative(dist, file));
  assert.deepEqual(leaking, [],
    `${VERCEL_INJECTED_ENV_PREFIX} is in the built bundle: ${leaking.join(', ')} — rebuild and look at what `
    + 'is being served, because this is the version visitors download');
  console.log(`  searched ${built.length} built file(s) in dist/ — clean`);
} else {
  console.log('  no dist/ to search (run `npm run build` first for the strongest check)');
}

console.log(`envReachingTheBrowserIsRead selfcheck OK (${readNames.size} names read, everything under `
  + `${VERCEL_INJECTED_ENV_PREFIX} dropped before Vite collects the environment)`);
