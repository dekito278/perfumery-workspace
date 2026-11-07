// `node src/utils/mobileNavActive.selfcheck.mjs`
//
// The phone Studio's two tabs, E-commerce and Studio, must say where you are — exactly one of them, on
// every Studio screen. With "starts with" both lit on every E-commerce page ('/mobile/studio' is the start
// of '/mobile/studio/products'), and none lit on the material detail, audit, categories and costing screens.
// Derived from the router, so a screen added later is checked by being added.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MOBILE_NAV_GROUP_PATHS, activeNavGroup, mostSpecificPath } from './mobileNavActive.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(src, 'App.jsx'), 'utf8');
const routes = [...app.matchAll(/<Route path="(\/mobile[^"]*)" element=\{\s*<ProtectedRoute>/g)].map((m) => m[1]);
assert.ok(routes.length >= 30, `expected the protected phone routes, found ${routes.length} — the scan broke`);

// Screens that belong to the account, not to either tab.
const NO_TAB = new Set(['/mobile/authenticator']);
const sample = (route) => route.replace(/:[A-Za-z]+/g, 'x1');
const homeless = routes.filter((route) => !NO_TAB.has(route) && !activeNavGroup(sample(route)));
assert.deepEqual(homeless, [], `these Studio screens light neither tab, so the phone cannot say where you are:\n  ${homeless.join('\n  ')}`);

for (const route of ['/mobile/studio/products', '/mobile/studio/products/x1/edit', '/mobile/studio/orders/x1', '/mobile/studio/export-shipping', '/mobile/studio/product-categories']) {
  assert.equal(activeNavGroup(route), 'commerce', `${route} is an E-commerce screen`);
}
for (const route of ['/mobile/studio', '/mobile/studio/dashboard', '/mobile/raw-material/x1', '/mobile/raw-material-audit', '/mobile/formulas/x1/edit', '/mobile/studio/site-images']) {
  assert.equal(activeNavGroup(route), 'studio', `${route} is a Studio screen`);
}
// Exactly one: no path may be claimed by both groups, or the tie is decided by object order.
const both = MOBILE_NAV_GROUP_PATHS.commerce.filter((path) => MOBILE_NAV_GROUP_PATHS.studio.includes(path));
assert.deepEqual(both, [], `paths claimed by both tabs: ${both.join(', ')}`);
assert.equal(mostSpecificPath('/mobile/studio/site-images', ['/mobile/studio', '/mobile/studio/site-images']), '/mobile/studio/site-images',
  'inside the sheet, the Dasbor item must not light up on every /mobile/studio/* screen');
assert.equal(mostSpecificPath('/mobile/raw-materials', ['/mobile/raw-material']), '', 'a prefix of a word is not a match');

const nav = readFileSync(join(src, 'components', 'mobile', 'MobileBottomNavigation.jsx'), 'utf8');
assert.match(nav, /activeNavGroup\(location\.pathname\)/, 'the bottom nav must take its active tab from activeNavGroup');
assert.doesNotMatch(nav, /group\.paths\.some\(/, 'the "any path starts with" rule that lit both tabs is back');

console.log(`mobileNavActive selfcheck OK (${routes.length} phone Studio routes, each lighting one tab)`);
