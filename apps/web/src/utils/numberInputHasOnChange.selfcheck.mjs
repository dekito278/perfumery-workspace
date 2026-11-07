// `node src/utils/numberInputHasOnChange.selfcheck.mjs`
//
// LocalizedNumberInput reports through `onChange` and nothing else; any other prop is spread onto the
// <input>. The export shipping policy on Ekspor passed `onValueChange` to its four boxes — the support for
// one bottle and for two or more, the courier rate, the bottle cap — so every keystroke called an
// onChange that did not exist, threw, and left the number where it was. The policy the shop's carts read
// could not be changed from Studio from #566 until 2026-11-08, when the phone scan logged React's
// "Unknown event handler property onValueChange".
//
// So: every <LocalizedNumberInput> in the app names onChange, and none names a look-alike.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.jsx$/.test(entry.name)) files.push(full);
  }
};
walk(src);

const offenders = [];
let uses = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  for (const match of text.matchAll(/<LocalizedNumberInput\b([\s\S]*?)\/>/g)) {
    uses += 1;
    const props = match[1];
    const line = text.slice(0, match.index).split('\n').length;
    if (!/\bonChange=/.test(props)) offenders.push(`${file.slice(src.length + 1)}:${line} has no onChange`);
    if (/\bon(Value|Number)Change=/.test(props)) offenders.push(`${file.slice(src.length + 1)}:${line} passes ${props.match(/\bon(Value|Number)Change/)[0]}, which the input never calls`);
  }
}
assert.ok(uses >= 15, `expected many LocalizedNumberInput uses, found ${uses} — the scan broke`);
assert.deepEqual(offenders, [], `a number box that cannot report what was typed:\n  ${offenders.join('\n  ')}`);

const component = readFileSync(join(src, 'components', 'LocalizedNumberInput.jsx'), 'utf8');
assert.match(component, /\(\{ as: Field = 'input', value, onChange, \.\.\.props \}\)/, 'the component still reports through onChange');

console.log(`numberInputHasOnChange selfcheck OK (${uses} number boxes, each reporting through onChange)`);
