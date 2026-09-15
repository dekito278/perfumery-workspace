// `node src/utils/catalogPageSize.selfcheck.mjs`
//
// The collection showed 12 of 18. Six perfumes — Pantura among them, in stock, priced, with its English
// story written — sat behind a "Show more" that bought the shop nothing: the card images below the fold
// are lazy, so they were not being downloaded either way. A click that costs discovery and saves no
// bytes is not a trade.
//
// Two rules here, and the second is the one that rots quietly: both shops must show the same amount of
// the same shelf. Desktop and mobile drifting apart is this repo's commonest defect, and this drift
// would be invisible — neither page looks wrong on its own.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOG_PAGE_SIZE } from './catalogPageSize.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => strip(readFileSync(join(root, ...parts), 'utf8'));

assert.ok(Number.isInteger(CATALOG_PAGE_SIZE) && CATALOG_PAGE_SIZE >= 18,
  `the first page must cover the shelf: ${CATALOG_PAGE_SIZE} would hide part of an 18-perfume catalogue `
  + 'behind a button again');

// One constant, read by both. A local number in either file is how the two shops start disagreeing.
for (const page of [['pages', 'CatalogPage.jsx'], ['pages', 'mobile', 'MobileCatalogPage.jsx']]) {
  const source = read(...page);
  const name = page.join('/');
  assert.match(source, /import \{ CATALOG_PAGE_SIZE \} from '@\/utils\/catalogPageSize\.js';/,
    `${name} must take the page size from the shared constant`);
  // Every place that sets or grows the visible count uses it — a literal in any one of them puts the
  // two shops back out of step, or resets a filtered view to a different size than it opened at.
  const sizing = source.split('\n').filter((line) => /visibleCount/i.test(line) && /(useState|setVisibleCount)\(/.test(line));
  assert.ok(sizing.length >= 2, `${name}: the scan must find where the visible count is set and grown`);
  for (const line of sizing) {
    assert.ok(line.includes('CATALOG_PAGE_SIZE'),
      `${name} sizes the collection with a literal instead of CATALOG_PAGE_SIZE:\n  ${line.trim()}`);
  }
}

console.log(`catalogPageSize selfcheck OK (${CATALOG_PAGE_SIZE} per page, one number for both shops, nothing hidden behind a click that saves no bytes)`);
