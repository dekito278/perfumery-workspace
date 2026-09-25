// `node src/utils/publishedPriceIsShown.selfcheck.mjs`
//
// Both batch screens can turn a production batch into a product. Both take a selling price, both fall
// back to a suggestion when the field is left empty, and the suggestion is COGS doubled — a number with
// no relationship to what this shop actually charges. On the batch open in Studio while this was found,
// COGS was Rp 96.897 a bottle, the suggestion Rp 194.000, and the catalogue sells 30 ml at Rp 1.260.000.
//
// The phone screen has always shown it: a "Sell price" tile reading the figure with the helper "suggested
// price", and a "Margin" tile beside it. The desktop screen showed neither. The only trace of the number
// that was about to be written onto a product was a grey placeholder inside the input — and a placeholder
// is a form's word for "example", not for "this is the value".
//
// Draft products are not sold: the public storefront reads storefront_products_public, which excludes
// them. So nobody was charged Rp 194.000. What the buyer sees is not the point — the point is that when
// Dekito later opens that draft to publish it, the price is already filled in with a figure that looks
// like somebody decided it.
//
// Two rules, and the first is why the second can be trusted: ONE definition of the suggestion, and every
// screen that publishes at a price shows that price and what it leaves.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// productionCosting.js reaches for the '@/' alias, which node cannot resolve. Rewritten to absolute file
// URLs rather than stubbed: the point of section 1 is to run the real arithmetic.
const costingSource = readFileSync(join(src, 'utils', 'productionCosting.js'), 'utf8')
  .replace(/'@\//g, `'${pathToFileURL(src).href}/`);
const { suggestedBottlePrice, SUGGESTED_PRICE_MARKUP } = await import(
  `data:text/javascript;base64,${Buffer.from(costingSource, 'utf8').toString('base64')}`
);

// --- 1. The suggestion, run ------------------------------------------------------------------------------
assert.equal(suggestedBottlePrice(96897), 194000, 'COGS doubled, rounded up to the nearest thousand');
assert.equal(suggestedBottlePrice(100000), 200000, 'a round number does not get an extra thousand');
assert.equal(suggestedBottlePrice(100001), 201000, 'and a rupiah over does');
for (const nothing of [0, -1, null, undefined, 'abc', NaN]) {
  assert.equal(suggestedBottlePrice(nothing), 0,
    `${JSON.stringify(nothing)} must give 0, not a price — a suggestion built from no cost at all would `
    + 'publish a product at zero');
}
assert.ok(SUGGESTED_PRICE_MARKUP > 1, 'a markup at or below 1 would suggest selling at a loss');

// --- 2. Nobody computes it a second time ------------------------------------------------------------------
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(src);

const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const longhand = files
  .filter((file) => !file.endsWith(join('utils', 'productionCosting.js')))
  .filter((file) => /Math\.ceil\(\([^)]*[Cc]ogs[^)]*\*\s*\d/.test(strip(readFileSync(file, 'utf8'))))
  .map((file) => file.slice(src.length + 1));
assert.deepEqual(longhand, [],
  'a screen works out the suggested price itself instead of calling suggestedBottlePrice. Both batch '
  + 'screens did, identically, and a markup written out twice is a markup that will be corrected once: '
  + longhand.join(', '));

// --- 3. Every screen that publishes at a price shows the price and the margin ------------------------------
// Found on disk: a file that creates a product with a priceNumber is a file that commits to a price.
const publishers = files.filter((file) => {
  const text = strip(readFileSync(file, 'utf8'));
  return /saveCustomProduct\(/.test(text) && /priceNumber/.test(text) && /suggestedBottlePrice\(/.test(text);
});
assert.ok(publishers.length >= 2,
  `expected both batch screens to publish products at a price, found ${publishers.length} — the scan is `
  + 'broken, not the code');

for (const file of publishers) {
  const where = file.slice(src.length + 1);
  const text = strip(readFileSync(file, 'utf8'));
  // Shown OUTSIDE an input's placeholder. That is the whole defect: the desktop screen did mention the
  // figure, as a placeholder attribute, where it reads as an example of what to type.
  const outsidePlaceholders = text.replace(/placeholder=\{[^}]*\}/g, '');
  assert.match(outsidePlaceholders, /label="Sell price"/,
    `${where} publishes a product at a price it never displays — the fallback figure reaches the product `
    + 'and the only sign of it on screen is a greyed placeholder, which is a form telling you what you '
    + 'MAY type, not what it WILL use');
  assert.match(outsidePlaceholders, /(?:suggested price|manual price)/,
    `${where} shows a price without saying whether anyone chose it`);
  assert.match(outsidePlaceholders, /label="Margin"/,
    `${where} shows a price with nothing to judge it against — the suggestion is COGS doubled and this `
    + 'shop sells at many times that, so the margin is the number that makes it obviously a placeholder');
}

console.log(`publishedPriceIsShown selfcheck OK (${publishers.length} screens publish products, one `
  + 'definition of the suggestion, and both show the price and the margin before committing)');
