// `node src/utils/blankLineSeparators.selfcheck.mjs`
//
// A message built as an array of lines uses '' for a blank line between paragraphs, and the same '' for
// an optional line that did not apply. Filtering on truthiness removes both, so the message arrives as
// one unbroken block.
//
// This was found five separate times: the customer order notifications, the checkout draft an admin
// sends, the bespoke brief, the owner's own order alerts, the payment reminder, and the packing list.
// Twice I believed I had found the last one. So this looks for the shape instead of remembering.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const roots = [join(here, '..'), join(here, '..', '..', 'api')];

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx?|mjs)$/.test(entry.name) && !entry.name.endsWith('.selfcheck.mjs')) files.push(full);
  }
};
roots.forEach(walk);

// The receiver of a truthiness filter is the tell: only flag when the array being filtered is one that
// carries blank-line separators. Two ways to see that — the array is written inline, or it comes from a
// declaration that builds one (buildNotificationMessage filtered `templates[eventKey]?.(order)`).
const BARE_SEPARATOR = /(?:\[|,)\s*\n\s*''\s*,/;
const TRUTHY_FILTER = /\.filter\(\s*(?:Boolean\b|\(?\s*(\w+)\s*\)?\s*=>\s*\1\s*!==\s*'')/g;
const DECLARATION = /^(?:export )?const (\w+)\s*=/gm;

// Every top-level declaration that builds line arrays with blank separators, and where each one starts.
const separatorOwners = (source) => {
  const starts = [...source.matchAll(DECLARATION)].map((m) => ({ name: m[1], at: m.index }));
  return starts
    .filter(({ at }, i) => BARE_SEPARATOR.test(source.slice(at, starts[i + 1]?.at ?? source.length)))
    .map(({ name }) => name);
};

const offenders = [];
for (const file of files) {
  const rel = file.split('/apps/web/')[1] || file;
  const source = readFileSync(file, 'utf8').replace(/^[ \t]*\/\/.*$/gm, ' ');
  if (!BARE_SEPARATOR.test(source)) continue;

  const owners = separatorOwners(source);
  for (const match of source.matchAll(TRUTHY_FILTER)) {
    // What the filter is called on: the array literal it closes, or the expression just before it.
    const before = source.slice(0, match.index);
    const literal = before.endsWith(']') ? before.slice(before.lastIndexOf('[')) : '';
    const receiver = literal || before.slice(-160);

    if (BARE_SEPARATOR.test(literal) || owners.some((name) => receiver.includes(name))) {
      offenders.push(`${rel}:${source.slice(0, match.index).split('\n').length}`);
    }
  }
}

assert.deepEqual(
  offenders,
  [],
  'these filter a line array on truthiness, and that array uses \'\' as a blank line, so every paragraph '
  + `break is thrown away with the lines that did not apply:\n  ${offenders.join('\n  ')}\n`
  + 'Make the optional entries null and filter on `line != null`, so an absent line disappears and a '
  + 'deliberate blank survives.',
);

console.log(`blankLineSeparators selfcheck OK (${files.length} files, 0 messages losing their paragraphs)`);
