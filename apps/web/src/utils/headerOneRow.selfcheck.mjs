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
const css = readFileSync(join(root, 'styles', 'storefront.css'), 'utf8');
const header = readFileSync(join(root, 'components', 'storefront', 'PublicHeader.jsx'), 'utf8');

// --- The header lays out by flex, and never wraps ----------------------------------------------------
const rule = css.match(/\n\.editorial-header \{([\s\S]*?)\n\}/);
assert.ok(rule, '.editorial-header is readable');
assert.match(rule[1], /display: flex/, 'the header is a flex row');
assert.match(rule[1], /flex-wrap: nowrap/, 'and never wraps onto a second line');

// A column count is the thing that broke. Not at the base rule, and not at any breakpoint either — the
// 899px block set `1fr auto`, two columns for what was by then four children.
for (const [, body] of css.matchAll(/\.editorial-header \{([\s\S]*?)\n(\s*)\}/g)) {
  assert.doesNotMatch(body, /grid-template-columns/,
    'the header must not pin a column count: it has to be kept in sync with the number of children by hand, and it was not');
}

// --- The two children that have to hold their ground --------------------------------------------------
// Read each rule's OWN body. An anchor followed by an unbounded [\s\S]*? runs straight past the closing
// brace into whatever rule comes next, so deleting the property under test still matched something
// further down the file — two sabotages walked through exactly that hole.
const bodyOf = (selector) => {
  const at = css.indexOf(selector + ' {');
  assert.notEqual(at, -1, `${selector} is missing entirely`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
};

const nav = bodyOf('.editorial-header > .editorial-nav');
assert.match(nav, /flex: 1 1 auto/, 'the nav absorbs the slack, which is what the old 1fr column did');
assert.match(nav, /min-width: 0/, 'and shrinks rather than shoving the buttons off the end');

const actions = bodyOf('.editorial-header > .editorial-header__actions');
assert.match(actions, /margin-left: auto/,
  'the buttons stay pinned right even below 900px, where the nav is hidden entirely');

// --- The markup still has the children this layout was written for --------------------------------------
// Not a count — a count is what failed. These four just have to still be there, in this order, so the
// rules above are aiming at something real.
const order = ['editorial-wordmark', 'RegionSwitch', 'editorial-nav', 'editorial-header__actions'];
let at = -1;
for (const token of order) {
  const next = header.indexOf(token, at + 1);
  assert.notEqual(next, -1, `the header still renders ${token}`);
  assert.ok(next > at, `${token} comes after the one before it`);
  at = next;
}

console.log('headerOneRow selfcheck OK (a flex row that does not wrap, so a fifth child cannot push the buttons onto a second line)');
