// `node src/utils/internationalOrderIsComplete.selfcheck.mjs`
//
// Two places in this codebase write an international order, and Studio reads them back through one
// function. The checkout at api/orders/create.js writes one. The export quote tool in Studio writes the
// other — and it is not the lesser of the two: every international order placed before the English
// checkout existed came from that screen, and a parcel arranged over WhatsApp still does.
//
// It wrote the dollars, the rate, the Jenius account and the pending-quote flag, and left out the
// country. internationalOrderSummary reads destinationCountry, so six Studio screens — the order list on
// both layouts, both order detail screens, and the shipping queue — printed "Tujuan -" on an order whose
// entire distinguishing fact is which country it leaves for. Fulfilment is the one that stings: it is
// where the courier gets chosen, and it fell back to the word "Luar negeri".
//
// Nothing could see it. The field is optional to the database, absent is indistinguishable from empty at
// every reader, and the two writers sit in different halves of the repo — one a browser page, one a node
// endpoint — so no test, type or lint ever held them side by side.
//
// The rule is therefore not "the calculator writes destinationCountry". It is: whatever the reader reads,
// every writer writes. Both sides are derived from disk, so a third writer or a seventh field is caught
// the day it lands rather than the day an order goes out with the wrong courier.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const root = join(src, '..');

const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// --- 1. What the reader needs, read off the reader ------------------------------------------------------
const workflow = strip(readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8'));
const summary = workflow.slice(
  workflow.indexOf('export const internationalOrderSummary'),
  workflow.indexOf('export const daysAwaitingQuote'),
);
assert.ok(summary, 'internationalOrderSummary has moved; this guard no longer points at the reader');

const required = [...new Set([...summary.matchAll(/response[?.]*\.(\w+)/g)].map((match) => match[1]))];
assert.ok(required.length >= 4,
  `expected to derive the fields Studio reads off an international order, found ${required.join(', ')} — `
  + 'the scan is broken, not the code');
assert.ok(required.includes('destinationCountry'), 'the country is the field this guard was written for');

// --- 2. Every writer of one, found on disk --------------------------------------------------------------
// A writer is any file that builds an object saying currency USD. Listing the two by hand is exactly how
// the second one drifted: the fix went to the file someone was looking at.
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(join(root, 'src'));
walk(join(root, 'api'));

/** The object literal surrounding an index, by balancing braces outwards then forwards. */
const objectAround = (text, index) => {
  let depth = 0;
  let start = index;
  while (start > 0) {
    start -= 1;
    if (text[start] === '}') depth += 1;
    else if (text[start] === '{') {
      if (depth === 0) break;
      depth -= 1;
    }
  }
  let end = start;
  depth = 0;
  while (end < text.length) {
    if (text[end] === '{') depth += 1;
    else if (text[end] === '}') {
      depth -= 1;
      if (depth === 0) { end += 1; break; }
    }
    end += 1;
  }
  return text.slice(start, end);
};

// Anchored on the amount and confirmed by the currency, both inside the SAME object literal. Anchoring
// on the currency alone caught src/data/internationalAccount.js, which is the Jenius account and writes
// no order at all — and a guard that has to be told to ignore a file is one hand-written list again.
const writers = [];
for (const file of files) {
  const text = strip(readFileSync(file, 'utf8'));
  for (const match of text.matchAll(/amountUsd/g)) {
    const body = objectAround(text, match.index);
    if (!body.includes("currency: 'USD'")) continue;
    writers.push({ file: file.slice(root.length + 1), body });
    break;
  }
}
assert.ok(writers.length >= 2,
  `expected at least the checkout endpoint and the Studio export tool to write international orders, found `
  + `${writers.length} — either the scan broke or one of the two stopped writing dollars at all`);
assert.ok(writers.some((writer) => writer.file.startsWith('api/')),
  'the authoritative writer is the order endpoint; if it no longer appears, this guard is watching the '
  + 'wrong half of the repo');
assert.ok(writers.some((writer) => writer.file.startsWith('src/pages/')),
  'the Studio export tool writes orders too, and it is the half that drifted');

// --- 3. Each one names every field the reader will look for ---------------------------------------------
for (const writer of writers) {
  for (const field of required) {
    assert.ok(writer.body.includes(field),
      `${writer.file} writes an international order without ${field}, and Studio reads it back — the `
      + `screens that show it will print a dash. Fields the reader asks for: ${required.join(', ')}`);
  }
}

console.log(`internationalOrderIsComplete selfcheck OK (${writers.length} writers, each naming all `
  + `${required.length} fields Studio reads: ${required.join(', ')})`);
