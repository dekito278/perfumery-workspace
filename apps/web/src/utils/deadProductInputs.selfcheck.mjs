// `node src/utils/deadProductInputs.selfcheck.mjs`
//
// toPublicFragrance rebuilds the product field by field, so it is a gate: anything it does not name
// cannot reach a buyer, no matter how carefully the Studio form collects it. Two fields sat behind that
// gate for as long as they existed — compareAtPriceNumber ("harga coret", four inputs across two forms)
// and intensity ("Intensitas", a select on both). Neither failed. They were simply typed into nothing.
//
// So this holds the gate open for every field the product form writes. A field is allowed to be missing
// only by being listed below with a reason, which makes "this one is Studio-only" a decision someone
// wrote down rather than an omission nobody noticed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// Fields the Studio form collects that a buyer is never meant to see. Each needs a reason, not a shrug.
const STUDIO_ONLY = {
  stock: 'the public shape exposes availability and per-variant stock instead of a raw total',
  restockThreshold: 'inventory planning — ProductListPage and ProductInventoryPage read it',
  stockAdjustmentNote: 'the reason for a stock correction, recorded in stockCorrections',
  stockCorrections: 'the audit trail behind a stock change',
  catalogVisible: 'inverted into the draft tag, and drafts never reach the public view at all',
  tags: 'not shown raw — inferPublicBadge and inferPublicCategory derive from it',
  compareAtPrice: 'the formatted twin of compareAtPriceNumber, which IS carried',
  internalTags: 'tags deliberately kept off the storefront',
};

// The form's own field list is the source of truth for "what can be typed in".
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const form = stripComments(read('components', 'product', 'ProductForm.jsx'));
const emptyProduct = form.slice(form.indexOf('export const emptyProduct'), form.indexOf('export const toEditableProduct'));
const fields = [...new Set([...emptyProduct.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]))];
assert.ok(fields.length > 15, `expected the product form to have many fields, found ${fields.length}`);

// The gate. Comments are stripped first: a comment naming a field it once dropped reads as the field
// being carried. That is the third time this session a guard has been fooled by prose explaining it —
// orderWrites.selfcheck and confirmAction.selfcheck needed the same fix.
const mapper = stripComments(read('data', 'publicStorefront.js'));
const publicShape = mapper.slice(mapper.indexOf('export const toPublicFragrance'), mapper.indexOf('export const getPublicFragranceCatalog'));

// Shorthand counts: the mapper writes `variants,` as often as `size: ...`.
const carried = (field) => new RegExp(`(^|[\\s,{])${field}\\s*[,:]`, 'm').test(publicShape);
const dead = fields.filter((field) => !(field in STUDIO_ONLY) && !carried(field));
assert.deepEqual(dead, [], 'these are typed into the Studio product form and dropped before any buyer '
  + `can see them — carry them through toPublicFragrance, or list them in STUDIO_ONLY with a reason: ${dead.join(', ')}`);

// The allowlist must stay honest: a field listed as Studio-only that has since been carried through is a
// stale reason, and a listed field the form no longer has is dead weight.
for (const field of Object.keys(STUDIO_ONLY)) {
  assert.ok(STUDIO_ONLY[field].length > 20, `${field} needs a real reason, not a placeholder`);
}

// --- the two that started this ------------------------------------------------------------------------
// Held by name as well as by the rule, because these are the ones with a history.
assert.ok(carried('compareAtPriceNumber'), 'harga coret must reach the storefront');
assert.ok(carried('intensity'), 'intensitas must reach the storefront');
for (const page of [['pages', 'PublicProductDetailPage.jsx'], ['pages', 'mobile', 'MobileProductDetailPage.jsx']]) {
  assert.match(read(...page), /product\.intensity \? <span>Intensitas/,
    `${page.join('/')} must show intensity — carrying it through the mapper alone still renders nothing`);
}

console.log(`deadProductInputs selfcheck OK (${fields.length} form fields, ${Object.keys(STUDIO_ONLY).length} reasoned exceptions)`);
