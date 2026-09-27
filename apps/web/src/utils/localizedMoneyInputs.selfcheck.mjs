// `node src/utils/localizedMoneyInputs.selfcheck.mjs`
//
// <input type="number"> is the wrong control for Indonesian money. Measured in a browser, with the
// project's own React and the exact line from ProductForm: typing "150.000" leaves "150.000" on screen,
// sets validity.badInput to false, and hands the handler 150. "1.500.000" arrives as 1.5 — the browser
// drops the second dot before any JavaScript sees the value, so no parser downstream can recover it.
//
// Money and stock fields therefore use LocalizedNumberInput, which keeps the typed text and reports the
// parsed number. This guard fails when a new one goes back to type="number".
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) files.push(full);
  }
};
walk(srcRoot);

// What counts as money the owner types with separators. The first version of this list named only
// price/harga/cost/amount/subtotal/discount/diskon/ongkir — and "ongkir" is the Indonesian word, so the
// one field on this site where Dekito types a freight charge BY HAND was invisible to it: Studio ->
// Ekspor calls it `manualShipping`. He types 670.500 (the RaySpeed one-kilo minimum to the US), the
// browser reads the dot as a decimal point and Math.round hands the order Rp 671.
const MONEY = /price|harga|cost|amount|subtotal|discount|diskon|ongkir|shipping|fee|biaya|tarif|rupiah|idr|nominal/i;

// The element, not a window of lines. Slicing eight lines forward from `type="number"` and cutting at the
// first "/>" missed every element that writes `value=` ABOVE its `type=` — which is how the three voucher
// fields and both curation fields read as "no binding" and were never judged at all. Walk back to the
// tag's "<" and forward to its closing ">" at brace depth zero, so a `onChange={(event) => ...}` arrow
// inside the tag cannot end it early.
const elementAround = (source, at) => {
  const start = source.lastIndexOf('<', at);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const character = source[i];
    if (character === '{') depth += 1;
    else if (character === '}') depth -= 1;
    else if (character === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
};

// Survivors, each with the reason it is not money the owner types with separators.
const ALLOWED = new Map([
  ['components/production-costing/ProductionBulkTab.jsx', 'per-litre handling and overhead, parsed with parseLocalizedNumber'],
  ['components/production-costing/ProductionRetailTab.jsx', 'volumes, percentages and channel fees, not rupiah totals'],
  ['components/FormNumber.jsx', 'the number branch itself, kept for the ±100% solvent shift fields'],
]);

const offenders = [];
let numberInputs = 0;
for (const file of files) {
  const rel = relative(srcRoot, file);
  if (ALLOWED.has(rel)) continue;
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/type="number"/g)) {
    numberInputs += 1;
    const element = elementAround(source, match.index);
    const bound = element.match(/value=\{([^}]*)\}/);
    if (bound && MONEY.test(bound[1]) && !/readOnly/.test(element)) {
      const line = source.slice(0, match.index).split('\n').length;
      offenders.push(`${rel}:${line}  value={${bound[1].trim()}}`);
    }
  }
}
// The derivation reads whole elements now; if it ever stops finding them it must fail loudly rather than
// report a clean sweep of nothing.
assert.ok(numberInputs >= 20, `only ${numberInputs} number inputs found outside the exceptions — the scan lost them`);

assert.deepEqual(
  offenders,
  [],
  'these read money from an <input type="number">, which turns "150.000" into 150 and "1.500.000" into '
  + `1.5 without any visible sign:\n  ${offenders.join('\n  ')}\n`
  + 'Use LocalizedNumberInput (or FormNumber with `localized`), whose onChange reports the parsed number. '
  + 'If the field is genuinely not rupiah the owner types with separators, add its file to ALLOWED with a reason.',
);

// And the one field this rule was widened for stays on the localized control: the charge on an
// international order is typed here and nowhere else.
const exportPage = readFileSync(join(srcRoot, 'pages/ExportShippingCalculatorPage.jsx'), 'utf8');
assert.match(exportPage, /<LocalizedNumberInput\s+value=\{manualShipping\}/,
  'the hand-typed freight charge in Studio -> Ekspor must stay on LocalizedNumberInput');

console.log(`localizedMoneyInputs selfcheck OK (${files.length} files, ${numberInputs} number inputs judged whole-element, ${ALLOWED.size} reasoned exceptions)`);
