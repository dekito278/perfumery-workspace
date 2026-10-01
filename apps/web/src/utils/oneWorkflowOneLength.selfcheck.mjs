// `node src/utils/oneWorkflowOneLength.selfcheck.mjs`
//
// The bespoke workflow has one length, and every screen that draws it has to agree.
//
// The six steps were written out FOUR times: as a literal array in CustomerPortalPage (the buyer's own
// progress bar), again in MobileOrderDetailPage (the owner's checklist), as an i18n key map beside the
// first, and as `grid-cols-6` in the portal's layout. The canonical list — the keys of
// bespokeProductionStatusLabels, in workflow order — was already right there and imported by both pages
// for its labels.
//
// All four agreed, and only because nobody had added a step. A seventh would have been dropped silently
// from both screens, and the portal's grid would still have laid out six columns for seven children.
//
// Measured 2026-10-02: 17 bespoke orders, all still at review_brief — the workflow dropdown has never been
// used in production, so a step added today would break screens nobody had reason to re-check.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// Lifted and RUN: orderService reaches supabase, so the two pure declarations are taken out and the list is
// built the same way the app builds it — Object.keys on the labels map, where insertion order IS the
// workflow order. Asserting the array literal would prove nothing about what the pages receive.
const orderSource = readFileSync(join(src, 'services', 'orderService.js'), 'utf8');
const lift = (needle, end) => {
  const at = orderSource.indexOf(needle);
  assert.notEqual(at, -1, `orderService no longer declares ${needle} — update this chain, not the rule`);
  const stop = orderSource.indexOf(end, at);
  return orderSource.slice(at, stop + end.length).replace(/^export /, '');
};
const shim = [
  lift('const bespokeProductionStatusLabels = {', '\n};'),
  lift('export const BESPOKE_PRODUCTION_STEPS', ';'),
  'export { BESPOKE_PRODUCTION_STEPS, bespokeProductionStatusLabels };',
].join('\n');
const { BESPOKE_PRODUCTION_STEPS, bespokeProductionStatusLabels } = await import(
  `data:text/javascript;base64,${Buffer.from(shim, 'utf8').toString('base64')}`
);

assert.deepEqual(BESPOKE_PRODUCTION_STEPS, Object.keys(bespokeProductionStatusLabels),
  'the steps must BE the labelled statuses, in their order — not a parallel list that happens to match');
assert.ok(BESPOKE_PRODUCTION_STEPS.length >= 6,
  `expected at least the six workflow steps; found ${BESPOKE_PRODUCTION_STEPS.length}`);
assert.equal(BESPOKE_PRODUCTION_STEPS[0], 'review_brief',
  'the first step is where every order starts, and indexOf() is the progress index');
console.log(`  ${BESPOKE_PRODUCTION_STEPS.length} steps: ${BESPOKE_PRODUCTION_STEPS.join(' -> ')}`);

// --- 1. Nobody keeps their own copy of the list -------------------------------------------------------
//
// Swept, not listed: the next page to draw a progress bar has to be caught by this.
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx?$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');

const ownCopies = [];
const drawers = [];
for (const rel of files) {
  if (rel === 'services/orderService.js') continue;
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  // A copy is an array literal holding two or more of the step names.
  for (const array of source.matchAll(/\[([^[\]]*?)\]/gs)) {
    const named = BESPOKE_PRODUCTION_STEPS.filter((step) => array[1].includes(`'${step}'`));
    if (named.length >= 2) ownCopies.push(`${rel}: ${named.join(', ')}`);
  }
  if (/BESPOKE_PRODUCTION_STEPS\.map\(/.test(source)) drawers.push(rel);
}
assert.deepEqual(ownCopies, [],
  'these keep their own copy of the workflow order, so a step added to orderService never reaches them:\n  '
  + ownCopies.join('\n  '));
console.log(`  screens drawing the workflow: ${drawers.join(', ')}`);
assert.ok(drawers.length >= 2,
  `expected the buyer's progress bar and the owner's checklist; found ${drawers.length}: ${drawers.join(', ')}`);

// --- 2. A column count typed as a number is a copy of the length ---------------------------------------
//
// Tailwind cannot take a computed class, so the lookup-with-a-fallback idiom MobileCommerceLayout already
// uses for its bottom nav is reused. What this holds is that the number is not typed next to the list.
for (const rel of drawers) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  const stepBlock = source.slice(Math.max(0, source.indexOf('BESPOKE_PRODUCTION_STEPS.map(') - 600));
  const hardcoded = /grid-cols-(\d+)/.exec(stepBlock.slice(0, 700));
  assert.equal(hardcoded, null,
    `${rel} lays the workflow out in grid-cols-${hardcoded?.[1]} — a copy of the step count, typed as a `
    + 'number. Derive it from BESPOKE_PRODUCTION_STEPS.length, the way the bottom nav derives its columns.');
}

// And wherever the count IS derived, every length the list can take must have a class, or Tailwind purges
// it and the layout silently collapses to the fallback.
const portal = strip(readFileSync(join(src, 'pages', 'CustomerPortalPage.jsx'), 'utf8'));
const lookup = /const stepGridColumns = \{([^}]*)\};/.exec(portal);
assert.ok(lookup, 'CustomerPortalPage must map a step count to a Tailwind column class');
const covered = [...lookup[1].matchAll(/(\d+):\s*'grid-cols-(\d+)'/g)];
assert.ok(covered.length >= 3,
  `the column lookup covers ${covered.length} lengths — too few to survive a step being added or removed`);
for (const [, key, value] of covered) {
  assert.equal(key, value, `grid-cols-${value} is mapped to ${key} steps, which would lay out the wrong number`);
}
assert.ok(covered.some(([, key]) => Number(key) === BESPOKE_PRODUCTION_STEPS.length),
  `today's ${BESPOKE_PRODUCTION_STEPS.length} steps have no entry in the lookup, so the layout falls back`);

// --- 3. The i18n key map is a different question, and must still cover every step ----------------------
// It maps steps to translation keys rather than restating their order, so it is not a copy — but a step
// with no key renders the buyer an untranslated fallback on the English shop.
const keyMap = /const bespokeProductionKeys = \{([\s\S]*?)\};/.exec(portal);
assert.ok(keyMap, 'CustomerPortalPage must still map each step to an i18n key');
const keyed = [...keyMap[1].matchAll(/^\s*(\w+):/gm)].map((match) => match[1]);
assert.deepEqual(keyed, BESPOKE_PRODUCTION_STEPS,
  'the buyer\'s progress bar translates these steps, and they must be exactly the workflow, in order');

console.log(`oneWorkflowOneLength selfcheck OK (${BESPOKE_PRODUCTION_STEPS.length} steps, one list, `
  + `${drawers.length} screens, no typed column count)`);
