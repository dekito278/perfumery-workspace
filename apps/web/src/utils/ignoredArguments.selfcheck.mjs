// `node src/utils/ignoredArguments.selfcheck.mjs`
//
// An argument a function does not accept is dropped in silence. JavaScript says nothing, the build says
// nothing, eslint says nothing, and the call site goes on reading as though the thing it asks for is
// happening.
//
// That is not a hypothetical, and it happened here. formatDate took one argument while buyer-facing
// screens called formatDate(value, t) — handing it the translator so dates would follow the shop's
// language. Fourteen calls across four files, every one looking finished, every one printing Indonesian
// month names to an English reader. The fix had been written and never wired up, and nothing could see
// it, because the only evidence was an argument going nowhere.
//
// It also made fixing it dangerous: turning that second parameter into a real one would have passed a
// function to toLocaleDateString and blanked the page. That is exactly what happened on the branch where
// this was first found — the repair crashed the member account page for a commit.
//
// On main the guard found two of its own, both in useProductionCostPage: createBulkScenario() takes
// nothing and was called with an index at two sites, an intent to number the quotes that was never
// implemented. Harmless, as it turns out — the screen numbers them positionally at render — which is
// precisely the kind of thing that stays in a codebase for years and teaches the next reader that the
// argument means something.
//
// So: a call may not pass more arguments than the function declares. That is the whole rule, checked
// against every exported arrow function in src/ and every place one is imported and called.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const sources = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) sources.push(full);
  }
};
walk(root);

const read = (file) => readFileSync(file, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// Only functions whose parameter list is countable. A destructured object is ONE argument however many
// keys it carries, and a rest parameter accepts anything — neither can be over-supplied, so neither is
// indexed rather than being guessed at.
const arities = new Map();
for (const file of sources) {
  for (const match of read(file).matchAll(/export const ([A-Za-z_$][\w$]*) = (?:async )?\(([^)]*)\) =>/g)) {
    const params = match[2].trim();
    if (params.includes('{') || params.includes('...')) continue;
    arities.set(match[1], params ? params.split(',').length : 0);
  }
}
assert.ok(arities.size >= 50,
  `expected to index the exported helpers, found ${arities.size} — the scan is broken, not the code`);

/**
 * Top-level commas only: nested calls, objects, arrays and strings all carry their own.
 *
 * Split into segments and drop the empty ones rather than counting separators. Counting commas made a
 * TRAILING comma — which this codebase writes on every multi-line call — look like one argument more
 * than there was, and the first run of this guard reported a two-argument call as three.
 */
const countArguments = (text) => {
  const segments = [''];
  let depth = 0;
  let quote = null;
  for (const character of text) {
    if (quote) {
      segments[segments.length - 1] += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      segments[segments.length - 1] += character;
      continue;
    }
    if ('([{'.includes(character)) depth += 1;
    else if (')]}'.includes(character)) depth -= 1;
    if (character === ',' && depth === 0) { segments.push(''); continue; }
    segments[segments.length - 1] += character;
  }
  return segments.filter((segment) => segment.trim()).length;
};

const offenders = [];
for (const file of sources) {
  const text = read(file);
  for (const [name, declared] of arities) {
    // Imported here, and not shadowed by a local definition of the same name — several pages define
    // their own formatNumber/formatStatus with a wider signature, and those are not this rule's business.
    if (!new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(text)) continue;
    if (new RegExp(`(?:const|function)\\s+${name}\\b`).test(text)) continue;
    const call = new RegExp(`(?<![\\w.])${name}\\(`, 'g');
    let match = call.exec(text);
    while (match) {
      let index = match.index + match[0].length;
      let depth = 1;
      const start = index;
      while (index < text.length && depth > 0) {
        const character = text[index];
        if ('([{'.includes(character)) depth += 1;
        else if (')]}'.includes(character)) depth -= 1;
        index += 1;
      }
      const given = countArguments(text.slice(start, index - 1));
      if (given > declared) {
        const line = text.slice(0, match.index).split('\n').length;
        offenders.push(`${file.slice(root.length + 1)}:${line} — ${name}() declares ${declared} argument(s), `
          + `given ${given}`);
      }
      match = call.exec(text);
    }
  }
}

assert.deepEqual(offenders, [],
  'a call passes arguments the function never receives, so whatever they were meant to do is not '
  + `happening and nothing else will say so:\n  ${offenders.join('\n  ')}`);

console.log(`ignoredArguments selfcheck OK (${arities.size} exported helpers, no call asking for something `
  + 'the function cannot hear)');
