// `node src/utils/firstBundleWeight.selfcheck.mjs`
//
// Seventh visitor audit, 13 Nov 2026: every page shipped the same 449 KB of JavaScript, and the first
// bundle carried all four hand-drawn motifs (217 KB, the 159 KB scribble included) for the one vessel the
// shop draws. Measured after: the entry chunk went from 812 KB to 561 KB raw (227 to 170 KB gzipped).
//   1. a screen imports the motif it draws, never the table of all of them;
//   2. pages that are rarely the first visit (bespoke, tracking, journal) load when visited;
//   3. Studio's DM Sans is not an @import in the shop's stylesheet (it blocked every shop page's render).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const lineArt = read('components', 'line', 'LineArt.jsx');
assert.doesNotMatch(lineArt, /from '\.\/paths\.js'/, 'LineArt must import each motif, not the table of all of them');
assert.match(lineArt, /import vessel from '\.\/motifs\/vessel\.js';/);
assert.deepEqual(readdirSync(join(src, 'components', 'line', 'motifs')).sort(), ['divider.js', 'mark.js', 'scribble.js', 'vessel.js']);

const app = read('App.jsx');
for (const page of ['BespokePage', 'PublicTrackingPage', 'PublicJournalPage']) {
  assert.match(app, new RegExp(`const ${page} = lazyRoute\\(\\(\\) => import\\('@/pages/${page}\\.jsx'\\)\\);`), `${page} loads when visited`);
}
for (const page of ['HomePage', 'CatalogPage', 'PublicProductDetailPage', 'CartPage', 'CheckoutPage']) {
  assert.match(app, new RegExp(`^import ${page} from '@/pages/${page}\\.jsx';`, 'm'), `${page} stays in the first bundle — the buying path never waits on a second request`);
}

assert.doesNotMatch(read('index.css'), /@import url\('https:\/\/fonts\.googleapis\.com/, 'no font @import blocking the shop');
assert.match(readFileSync(join(src, '..', 'index.html'), 'utf8'), /family=DM\+Sans[^"]*" media="print" onload="this\.media='all'"/, "Studio's face loads without blocking");

console.log('firstBundleWeight selfcheck OK (one motif per screen, rare pages on demand, no blocking font import)');
