// `node src/utils/moneyFormatterIsTotal.selfcheck.mjs`
//
// Eighteen screens write their own one-line rupiah formatter. Fourteen coerce first —
// `format(Number(value || 0))` — and four did not: OrdersPage, MobileOrdersPage, MobileCheckoutPage,
// MobileCartPage handed the raw value to Intl.
//
// Intl.NumberFormat is not total. format(null) and format('') give "0", which hides the difference, but
// format(undefined) and format(NaN) both give "NaN". So a missing subtotal printed "Rp NaN" on the order
// list, in the cart, and at the checkout — three of the four being screens a buyer looks at — while the
// same missing value printed "Rp 0" everywhere else.
//
// This is the shape that produced the English-dates bug a commit ago, in its purest form: a one-line
// helper copied by hand into every file that needed it, fixed in most copies, and left alone in the few
// nobody happened to open.
//
// The four are fixed. They are NOT collapsed onto pricingUtils.formatPrice, which already exists and is
// total, because that one also ROUNDS: it would turn every fractional rupiah on eighteen screens into a
// whole one. Changing what eighteen money displays show is not a tidy-up, and it is not this finding.
//
// The rule: a formatter that turns a number into rupiah is total. Derived from disk — every local money
// formatter is found and each is RUN against the values that break an untotal one.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// --- 1. Intl really is not total, which is the whole premise ---------------------------------------------
const intl = new Intl.NumberFormat('id-ID');
assert.equal(intl.format(undefined), 'NaN',
  'if Intl ever became total this guard would be protecting nothing — delete it rather than leave it');
assert.equal(intl.format(NaN), 'NaN');
assert.equal(intl.format(null), '0', 'null slips through, which is why the gap stayed invisible');

// --- 2. Every local money formatter on disk, run -----------------------------------------------------------
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(src);

const DECLARATION = /^const (formatTotal|formatRupiah|rupiah|formatMoney) = \(([^)]*)\) => (`Rp [^`]*`);$/gm;
const formatters = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(DECLARATION)) {
    formatters.push({ file: file.slice(src.length + 1), name: match[1], params: match[2], body: match[3] });
  }
}
assert.ok(formatters.length >= 15,
  `expected the one-line rupiah formatters, found ${formatters.length} — the scan is broken, not the code`);

for (const formatter of formatters) {
  const run = (await import(
    `data:text/javascript;base64,${Buffer.from(`export const f = (${formatter.params}) => ${formatter.body};`, 'utf8').toString('base64')}`
  )).f;
  const where = `${formatter.file} — ${formatter.name}()`;
  // The two Intl lets through as NaN. A screen showing "Rp NaN" has told the reader nothing and looks
  // broken doing it; "Rp 0" is at least a number that can be questioned.
  for (const nothing of [undefined, NaN]) {
    assert.doesNotMatch(run(nothing), /NaN/,
      `${where} prints "Rp NaN" for ${String(nothing)}. Coerce first: Number(value || 0)`);
  }
  // And it must still format a real amount, so nobody satisfies the rule by returning a constant.
  assert.match(run(289000), /289\.000/, `${where} no longer formats an actual amount`);
  assert.match(run('289000'), /289\.000/, `${where} cannot read a numeric string, which is how these arrive from the database`);
}

console.log(`moneyFormatterIsTotal selfcheck OK (${formatters.length} local rupiah formatters, every one `
  + 'of them total)');
