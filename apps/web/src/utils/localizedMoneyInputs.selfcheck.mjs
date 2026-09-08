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

const MONEY = /price|harga|cost|amount|subtotal|discount|diskon|ongkir/i;

// Survivors, each with the reason it is not money the owner types with separators.
const ALLOWED = new Map([
  ['components/production-costing/ProductionBulkTab.jsx', 'per-litre handling and overhead, parsed with parseLocalizedNumber'],
  ['components/production-costing/ProductionRetailTab.jsx', 'volumes, percentages and channel fees, not rupiah totals'],
  ['components/FormNumber.jsx', 'the number branch itself, kept for the ±100% solvent shift fields'],
]);

const offenders = [];
for (const file of files) {
  const rel = relative(srcRoot, file);
  if (ALLOWED.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (!line.includes('type="number"')) return;
    // Same element only: the binding sits on the line itself or within the tag that follows it.
    const element = lines.slice(index, index + 8).join('\n').split('/>')[0];
    const bound = element.match(/value=\{([^}]*)\}/);
    if (bound && MONEY.test(bound[1]) && !/readOnly/.test(element)) {
      offenders.push(`${rel}:${index + 1}  value={${bound[1].trim()}}`);
    }
  });
}

assert.deepEqual(
  offenders,
  [],
  'these read money from an <input type="number">, which turns "150.000" into 150 and "1.500.000" into '
  + `1.5 without any visible sign:\n  ${offenders.join('\n  ')}\n`
  + 'Use LocalizedNumberInput (or FormNumber with `localized`), whose onChange reports the parsed number. '
  + 'If the field is genuinely not rupiah the owner types with separators, add its file to ALLOWED with a reason.',
);

console.log(`localizedMoneyInputs selfcheck OK (${files.length} files, ${ALLOWED.size} reasoned exceptions)`);
