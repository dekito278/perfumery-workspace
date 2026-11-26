// A new page opens at its top at once (Dekito, 26 Nov 2026): the storefront's `scroll-behavior: smooth` made
// the route change animate from the old page's depth, and on an iPhone the slide stopped halfway down.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(HERE, '../components/ScrollToTop.jsx'), 'utf8');
assert.match(source, /root\.style\.scrollBehavior = 'auto';\s*void window\.getComputedStyle\(root\)\.scrollBehavior;/,
  'the route-change scroll must lift smooth scrolling AND flush it before jumping — unflushed, the browser never saw it');
assert.match(source, /window\.scrollTo\(\{ top, left: 0, behavior: 'instant' \}\)/, 'and ask for an instant jump itself');
assert.match(source, /root\.style\.scrollBehavior = before;\s*\};/, 'then put smooth scrolling back');
assert.match(source, /if \(scroller === window\) \{\s*jumpWindowTo\(top\);/, 'and every window scroll on navigation goes through it');
console.log('pageJumpIsInstant selfcheck OK');
