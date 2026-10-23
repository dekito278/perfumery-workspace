// `node src/utils/everyAddToCartCarriesTheVariant.selfcheck.mjs`
//
// A cart line without a variant cannot be priced for export.
//
// Export prices live in storefront_product_prices keyed by (product_id, variant_id, tier). Every one of
// the nineteen is keyed by a variant — '30-ml', '10-ml', 'variant-1779213046244'. A line carrying
// variantId '' therefore matches nothing, and the English cart says so:
//
//     "Maskumambang, L'iris has no international price yet — remove it from the cart"
//     quoted on request
//
// MEASURED ON PRODUCTION, 2026-10-23, in one cart at one moment: La Tulipe added from the product page
// kept its US$80; Maskumambang and L'iris added from the CATALOGUE CARD both lost their price. Same
// code, same data, same second — the only difference was which button the buyer pressed. The catalogue
// grid is the fastest path into the cart, so this was the common one, and the card had just advertised
// US$95 to the buyer it then refused to quote.
//
// Three of the four addItem callers already built the line correctly. The fourth passed the bare
// product. So the rule is not "CatalogPage must do X" — it is that NOBODY may add a line without a
// variant, and the subject is derived by finding the callers rather than listing them here.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx?$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');

// The call sites, found rather than listed. useCart.js is where addItem is DEFINED, not called.
const callers = files
  .filter((rel) => !/hooks\/useCart\.js$/.test(rel))
  .map((rel) => [rel, readFileSync(join(src, rel), 'utf8')])
  .filter(([, body]) => /\baddItem\(/.test(body));

assert.ok(callers.length >= 4,
  `only ${callers.length} addItem call sites found; the search has stopped matching`);

// Each call must name the variant inside the object it builds. A bare `addItem(product, 1)` is the bug.
//
// READ BY BALANCING BRACKETS, NOT BY REGEX. The first version of this used a bounded `[\s\S]{0,400}?`
// and silently matched nothing on a long call — removing variantId from MobileProductDetailPage left it
// green. A guard that cannot fail is worse than no guard, so the argument list is now walked.
const argumentsOf = (body, at) => {
  let depth = 0;
  for (let i = at; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) return body.slice(at, i + 1);
    }
  }
  return '';
};
const withoutVariant = [];
for (const [rel, body] of callers) {
  const calls = [...body.matchAll(/\baddItem\(/g)];
  assert.ok(calls.length > 0, `${rel} was listed as a caller but has no addItem( in it`);
  for (const call of calls) {
    const args = argumentsOf(body, call.index + 'addItem'.length);
    assert.ok(args, `${rel}: an addItem( call never closes its bracket`);
    if (!/variantId:/.test(args)) withoutVariant.push(`${rel}: addItem${args.replace(/\s+/g, ' ').slice(0, 60)}…`);
  }
}
assert.deepEqual(withoutVariant, [],
  'these add a cart line with no variant, which the export price lookup cannot match:\n  '
  + `${withoutVariant.join('\n  ')}\n`
  + 'Build the line the way the product pages do: cartSlug + variantId from the chosen variant.');

// --- The catalogue card has no variant picker, so it must resolve one -------------------------------
// It is the only caller with nothing selected by the buyer. Reusing getPrimaryVariant keeps it on the
// same rule as the stock, price-range and voucher-preview code rather than inventing a second answer.
const catalog = readFileSync(join(src, 'pages', 'CatalogPage.jsx'), 'utf8');
assert.match(catalog, /getPrimaryVariant\(/,
  'the catalogue card must resolve the variant with the shared helper, not pick one of its own');
assert.match(catalog, /import \{[^}]*getPrimaryVariant[^}]*\} from '@\/services\/productCatalogService\.js'/,
  'and import it from the service that owns that rule');

console.log(`everyAddToCartCarriesTheVariant OK (${callers.length} call sites, every line carries a variant)`);
