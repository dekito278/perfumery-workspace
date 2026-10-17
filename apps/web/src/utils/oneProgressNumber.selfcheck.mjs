// `node src/utils/oneProgressNumber.selfcheck.mjs`
//
// Walked the bespoke flow on a phone-width preview and wrote down the figure in the header at each step:
//
//   step 1 of 5 -> 20%    step 2 -> 40%    step 3 -> 60%    step 4 -> 60%
//
// It looked stuck, and it was not: the badge counts steps FINISHED, and arriving on step 4 finishes
// nothing. The formula is right. What was wrong sat a few pixels below it — the bar was drawn from a
// different number:
//
//   badge:  ((step + Number(activeStep.isComplete())) / flowSteps.length) * 100   how much is done
//   bar:    ((step + 1) / flowSteps.length) * 100                                 where you are
//
// Two answers to one question, side by side in the same header, disagreeing by a whole step on every
// screen of the flow: on step 4 the bar said 80% while the badge said 60%, and on an untouched step 1
// the bar said 20% while the badge said 0%. Nobody chose that; the bar was written as decoration and
// the badge as information.
//
// The rule: the bar is drawn from the number the badge prints. Found by reading the header rather than
// by pinning either formula, so changing what progress MEANS is still a one-line change — it just has
// to change once.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(dirname(fileURLToPath(import.meta.url)));
const page = readFileSync(join(src, 'pages', 'mobile', 'MobileBespokePage.jsx'), 'utf8');

// The badge: the percentage a reader actually sees, as a word.
const badge = page.match(/\{(\w+)\}%<\/span>/);
assert.ok(badge, 'cannot find the percentage badge in the bespoke wizard header — this check reads it '
  + 'out of the page, so a refactor that moves it has to update this line too');
const shown = badge[1];

// The bar: the width of the filled track, anywhere in the file.
const bars = [...page.matchAll(/style=\{\{\s*width:\s*`\$\{([^`]+)\}%`/g)].map((match) => match[1].trim());
assert.ok(bars.length >= 1, 'cannot find a progress bar width in the bespoke wizard');
for (const width of bars) {
  assert.equal(width, shown,
    `the bespoke progress bar is drawn from \`${width}\` while the badge beside it prints \`${shown}\`. `
    + 'Two numbers for one question, a whole step apart on every screen of the flow');
}

// And the number itself has to be the completion one, not the position one: a bar that fills to 100%
// while the last step is still empty is the version this came from.
const completion = page.match(new RegExp(`const ${shown} = ([^;]+);`));
assert.ok(completion, `${shown} is rendered but never defined — the parse is broken, not the page`);
assert.match(completion[1], /isComplete\(\)/,
  `${shown} no longer counts finished steps, so the header now reports position while calling it a `
  + 'percentage — a buyer on the last step would read 100% with nothing filled in');

console.log(`oneProgressNumber selfcheck OK (bespoke wizard: badge and ${bars.length} bar(s) both drawn `
  + `from ${shown}, which counts finished steps)`);
