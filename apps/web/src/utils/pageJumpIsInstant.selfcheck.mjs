// A new page opens at its top at once (Dekito, 26 Nov 2026): the storefront's `scroll-behavior: smooth` made
// the route change animate from the old page's depth, and on an iPhone the slide stopped halfway down.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(HERE, '../components/ScrollToTop.jsx'), 'utf8');
assert.match(source, /root\.style\.scrollBehavior = 'auto';\s*window\.scrollTo\(0, top\);\s*root\.style\.scrollBehavior = before;/,
  'the route-change scroll must lift smooth scrolling for its one jump, then put it back');
assert.match(source, /if \(scroller === window\) \{\s*jumpWindowTo\(top\);/, 'and every window scroll on navigation goes through it');
console.log('pageJumpIsInstant selfcheck OK');
