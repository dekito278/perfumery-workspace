// `node src/utils/headerOneRow.selfcheck.mjs`
//
// The storefront header is one row.
//
// It was two for as long as the region switch had existed. `.editorial-header` was a grid with
// `grid-template-columns: auto 1fr auto` — three columns — and the ID/EN switch arrived as a FOURTH
// child. The fourth item wrapped, so the account and cart buttons sat on a line of their own underneath,
// on every screen, and the switch stretched across the column meant for the nav.
//
// Nothing caught it because nothing was broken in the sense a build understands: the CSS was valid, the
// markup was valid, and the two were only wrong about each other.
//
// The fix was to stop counting. A flex row does not care how many children it has, which is the only
// property that makes this safe — the header has gained a child twice now (the switch, and the actions
// group before it) and will again.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// The header moved to naskah.css with the 2026-10-31 redesign; the rule did not change.
const css = readFileSync(join(root, 'styles', 'naskah.css'), 'utf8');
const header = readFileSync(join(root, 'components', 'storefront', 'PublicHeader.jsx'), 'utf8');

// --- The header lays out by flex, and never wraps ----------------------------------------------------
const rule = css.match(/\n\.ng-header \{([\s\S]*?)\n\}/);
assert.ok(rule, '.ng-header is readable');
assert.match(rule[1], /display: flex/, 'the header is a flex row');
assert.match(rule[1], /flex-wrap: nowrap/, 'and never wraps onto a second line');

// A column count is the thing that broke. Not at the base rule, and not at any breakpoint either — the
// 899px block set `1fr auto`, two columns for what was by then four children.
for (const [, body] of css.matchAll(/\.ng-header \{([\s\S]*?)\n(\s*)\}/g)) {
  assert.doesNotMatch(body, /grid-template-columns/,
    'the header must not pin a column count: it has to be kept in sync with the number of children by hand, and it was not');
}

// --- The nav on the centre line, the buttons pinned right ---------------------------------------------
// Every rule outside @media, comments stripped, as [selectors, body]. A selector is looked up in the
// whole list it shares, because the brand and the actions share one rule and the actions have a
// second of their own. (An anchor followed by an unbounded [\s\S]*? ran past the closing brace into
// the next rule — two sabotages walked through that hole when this read by regex.)
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
const baseRules = [];
for (let i = 0, depth = 0, start = 0, open = 0; i < bare.length; i += 1) {
  if (bare[i] === '{') {
    if (depth === 0) open = i;
    depth += 1;
  } else if (bare[i] === '}') {
    depth -= 1;
    if (depth === 0) {
      const selectors = bare.slice(start, open).trim();
      if (!selectors.startsWith('@')) baseRules.push([selectors.split(',').map((item) => item.trim()), bare.slice(open + 1, i)]);
      start = i + 1;
    }
  }
}
const declared = (selector) => {
  const bodies = baseRules.filter(([selectors]) => selectors.includes(selector)).map(([, body]) => body);
  assert.ok(bodies.length, `${selector} has no rule of its own`);
  return bodies.join('\n');
};

// The two sides take equal shares of what the nav leaves, which is what puts the nav on the page's
// centre line. When the nav took the slack instead it centred in the gap between them, 56px left of the
// centred price notice above it at 1280px (2026-11-06). The smoke's [chrome] run measures the result.
assert.match(declared('.ng-header__brand'), /flex: 1 1 0/, 'the wordmark side takes half the slack');
const actions = declared('.ng-header > .ng-header__actions');
assert.match(actions, /flex: 1 1 0/, 'and the actions side the other half');
assert.match(actions, /margin-left: auto/,
  'the buttons stay pinned right even below 900px, where the nav is hidden entirely');
assert.match(actions, /justify-content: flex-end/, 'at the far end of their half, not at its start');

const nav = declared('.ng-header > .ng-header__nav');
assert.match(nav, /flex: 0 1 auto/, 'the nav is as wide as its links, so the halves either side of it are equal');
assert.match(nav, /min-width: 0/, 'and shrinks rather than shoving the buttons off the end');

// --- The markup still has the children this layout was written for --------------------------------------
// Not a count — a count is what failed. These just have to still be there, in this order, so the rules
// above are aiming at something real. The wordmark sits in a box of its own, so the half it takes does
// not turn the link into a target that runs to the nav. The region switch sits inside the actions.
const order = ['ng-header__brand', 'ng-header__wordmark', 'ng-header__nav', 'ng-header__actions', '<RegionSwitch'];
let at = -1;
for (const token of order) {
  const next = header.indexOf(token, at + 1);
  assert.notEqual(next, -1, `the header still renders ${token}`);
  assert.ok(next > at, `${token} comes after the one before it`);
  at = next;
}

console.log('headerOneRow selfcheck OK (a flex row that does not wrap, its nav on the centre line between two equal halves)');
