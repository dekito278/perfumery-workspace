// `node src/utils/oneScrollLock.selfcheck.mjs`
//
// `document.body.style.overflow` is one global that every overlay owns at once, and the two writers in
// this app disagreed about it.
//
// MobileBottomSheet saved the previous value and put it back. ProductGallery's lightbox set 'hidden' and,
// on close, wrote '' — clobbering whatever an enclosing overlay had set, so the page behind a still-open
// sheet would start scrolling again. Whichever overlay closed FIRST decided for both.
//
// Not reachable on today's screens, and that is worth saying plainly: the only sheet on the mobile product
// page is the add-to-cart prompt, which covers the gallery, so the lightbox cannot be opened while it is
// up. MobileProductDetailPage is nonetheless the one screen that mounts both, and the moment one overlay
// sits inside another the clobber bites.
//
// So: one spelling, in utils/bodyScrollLock.js, and nobody else touches the global. Both halves derived —
// the helper is RUN against a pre-existing lock, and the writers are swept off disk.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// --- 1. The helper, run — including the case the old code got wrong -----------------------------------
const styles = { body: {}, html: {} };
globalThis.document = {
  body: { style: styles.body },
  documentElement: { style: styles.html },
};
const { lockBodyScroll } = await import(pathToFileURL(join(src, 'utils', 'bodyScrollLock.js')).href);

// An enclosing overlay is already holding the lock.
styles.body.overflow = 'hidden';
styles.html.overscrollBehavior = 'none';
const release = lockBodyScroll();
assert.equal(styles.body.overflow, 'hidden', 'a nested overlay still locks');
release();
assert.equal(styles.body.overflow, 'hidden',
  'releasing the INNER overlay must leave the outer one locked. Writing \'\' here is the bug: the page '
  + 'behind a still-open sheet starts scrolling again');
assert.equal(styles.html.overscrollBehavior, 'none', 'and the outer overlay keeps its overscroll setting too');

// With nothing holding it, the release gives the page back.
styles.body.overflow = '';
styles.html.overscrollBehavior = '';
const releaseOuter = lockBodyScroll();
assert.equal(styles.body.overflow, 'hidden');
assert.equal(styles.html.overscrollBehavior, 'none');
releaseOuter();
assert.equal(styles.body.overflow, '', 'the last overlay out restores the page');
assert.equal(styles.html.overscrollBehavior, '');

// A value someone set by hand is handed back as it was, not normalised to ''.
styles.body.overflow = 'clip';
lockBodyScroll()();
assert.equal(styles.body.overflow, 'clip', 'whatever was there comes back, not an empty string');

// And it must not throw where there is no document at all — this app prerenders 47 pages.
delete globalThis.document;
assert.equal(typeof lockBodyScroll(), 'function', 'with no document it is a no-op, not a crash');
lockBodyScroll()();

// --- 2. Nobody else touches the global ----------------------------------------------------------------
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx?$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');
assert.ok(files.length >= 300, `expected to sweep the app; found ${files.length} files`);

const GLOBAL_SCROLL = /(?:document\.)?body\.style\.overflow|documentElement\.style\.overscrollBehavior/;
const writers = files.filter((rel) => GLOBAL_SCROLL.test(strip(readFileSync(join(src, rel), 'utf8'))));
console.log(`  writers of the global scroll lock: ${writers.join(', ')}`);
assert.deepEqual(writers, ['utils/bodyScrollLock.js'],
  'these set the page scroll lock directly instead of through lockBodyScroll(). One global with two '
  + 'owners means whichever overlay closes first decides for both:\n  ' + writers.join('\n  '));

// --- 3. And every overlay that locks it releases through the helper ------------------------------------
const users = files.filter((rel) => /lockBodyScroll\(/.test(strip(readFileSync(join(src, rel), 'utf8')))
  && rel !== 'utils/bodyScrollLock.js');
console.log(`  overlays using it: ${users.join(', ')}`);
assert.ok(users.length >= 2,
  `expected the bottom sheet and the gallery lightbox; found ${users.length}: ${users.join(', ')}`);
const leaking = [];
for (const rel of users) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  // The return value is the release. Called and dropped, the lock is never lifted at all.
  if (!/(?:const \w+ = lockBodyScroll\(\)|return lockBodyScroll\(\))/.test(source)) leaking.push(rel);
}
assert.deepEqual(leaking, [],
  'these call lockBodyScroll() without keeping its release function, so the page stays locked after the '
  + 'overlay closes:\n  ' + leaking.join('\n  '));

console.log(`oneScrollLock selfcheck OK (1 writer, ${users.length} overlays, a nested release leaves the outer lock alone)`);
