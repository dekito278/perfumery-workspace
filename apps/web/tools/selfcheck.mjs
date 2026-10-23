// Run every selfcheck chain in the repo. `node tools/selfcheck.mjs`.
//
// WHY THIS FILE EXISTS. On 2026-10-23 `tools/journal-prerender.selfcheck.mjs` was found red and had
// been red since 13 September — six weeks. Two things had to be true at once for that to happen:
// the chains did not run in the Vercel build, and the sweeps that did run were typed by hand as
// `find src`, which silently omits `tools/`. Neither failure was visible, because a chain nobody
// runs looks exactly like a chain that passes.
//
// So this runner takes its subject from the FILESYSTEM, never from a list. Add a chain anywhere
// under apps/web and it runs on the next build without anyone remembering to register it — which is
// the whole lesson of the unregistered guards, applied to the thing that runs the guards.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const SUFFIX = '.selfcheck.mjs';
// Directories that are not ours to walk. Everything else under apps/web is in scope on purpose: the
// point is that a new directory needs no edit here.
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage', '.vercel', '.vite']);

/** Every chain under `dir`, found by walking. Sorted so a failure list is stable between runs. */
export const findChains = (dir = ROOT) => {
  const found = [];
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(path.join(current, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(SUFFIX)) {
        found.push(path.join(current, entry.name));
      }
    }
  };
  walk(dir);
  return found.sort();
};

const runOne = (file) => new Promise((resolve) => {
  execFile(process.execPath, [file], { cwd: ROOT, timeout: 120000 }, (error, stdout, stderr) => {
    resolve({ file, ok: !error, output: `${stdout}${stderr}`.trim() });
  });
});

/** Run them all, a few at a time. Returns every failure rather than stopping at the first. */
export const runChains = async (files, concurrency = Math.max(2, os.cpus().length - 1)) => {
  const queue = [...files];
  const failures = [];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const result = await runOne(next);
      if (!result.ok) failures.push(result);
    }
  });
  await Promise.all(workers);
  return failures.sort((a, b) => a.file.localeCompare(b.file));
};

const main = async () => {
  const chains = findChains();
  if (chains.length === 0) {
    // Not "nothing to do". A sweep that finds no chains in a repo full of them is the failure this
    // whole file is about, so it is louder than any single red chain.
    console.error('[selfcheck] found NO chains — the sweep is broken, not the code');
    process.exit(1);
  }
  const started = Date.now();
  const failures = await runChains(chains);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  for (const failure of failures) {
    console.error(`\n[selfcheck] FAILED ${path.relative(ROOT, failure.file)}`);
    console.error(failure.output.split('\n').slice(0, 12).join('\n'));
  }
  if (failures.length > 0) {
    console.error(`\n[selfcheck] ${failures.length} of ${chains.length} chain(s) failed in ${seconds}s`);
    process.exit(1);
  }
  console.log(`[selfcheck] ${chains.length} chain(s) passed in ${seconds}s`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
