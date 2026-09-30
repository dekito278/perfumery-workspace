// Runnable check for cart reconciliation. `node src/utils/cartReconcile.selfcheck.mjs`.
// This decides what the buyer is actually charged for a cart restored from localStorage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { reconcileCartLines } from './cartReconcile.js';

const catalog = [{
  id: 'p1',
  slug: 'rain-letter',
  category: 'Perfume',
  images: ['https://example.test/rain.jpg'],
  imageUrl: 'https://example.test/rain.jpg',
  priceNumber: 300000,
  variants: [
    { id: '30-ml', size: '30 ml', priceNumber: 320000, stock: 2 },
    { id: '50-ml', size: '50 ml', priceNumber: 480000, stock: 0 },
  ],
}];

const stored = [{
  productId: 'p1', slug: 'rain-letter-30-ml', productSlug: 'rain-letter', variantId: '30-ml',
  name: 'Rain Letter', price: 'Rp 250.000', priceNumber: 250000, size: '30 ml', quantity: 5, maxStock: 0,
}];

const [line] = reconcileCartLines(stored, catalog);
assert.equal(line.priceNumber, 320000);          // charged at today's price, not the stored one
assert.equal(line.price, 'Rp 320.000');
assert.equal(line.priceChanged, true);
assert.equal(line.previousPriceNumber, 250000);
assert.equal(line.maxStock, 2);                   // the stepper finally has a real cap
assert.equal(line.quantity, 2);                   // and the stored quantity is clamped to it
assert.equal(line.imageUrl, 'https://example.test/rain.jpg');
assert.equal(line.outOfStock, false);
assert.equal(line.unavailable, false);

// A sold-out variant (stock 0) is flagged, not treated as "no cap" — checkout blocks on this.
const [soldOut] = reconcileCartLines([{ ...stored[0], slug: 'rain-letter-50-ml', variantId: '50-ml', size: '50 ml' }], catalog);
assert.equal(soldOut.outOfStock, true);
assert.equal(soldOut.maxStock, 0);

// A line that was flagged while the product was away clears once it is back in stock.
const [recovered] = reconcileCartLines([{ ...stored[0], unavailable: true, outOfStock: true }], catalog);
assert.equal(recovered.unavailable, false);
assert.equal(recovered.outOfStock, false);

// An unchanged price is not flagged
const [same] = reconcileCartLines([{ ...stored[0], priceNumber: 320000 }], catalog);
assert.equal(same.priceChanged, false);

// A product that left the catalog keeps its stored fields but is flagged unavailable
const gone = [{ ...stored[0], productId: 'gone', productSlug: 'deleted', slug: 'deleted' }];
const [goneLine] = reconcileCartLines(gone, catalog);
assert.equal(goneLine.unavailable, true);
assert.equal(goneLine.priceNumber, 250000);
assert.deepEqual({ ...goneLine, unavailable: undefined, outOfStock: undefined }, { ...gone[0], unavailable: undefined, outOfStock: undefined });

// --- The cart and the endpoint must give the same answer about a variant ------------------------------
//
// Two implementations of one rule, and the buyer meets them in order: the cart reconciler decides what to
// show and what to flag, then api/orders/create.js decides whether to accept it. When they disagree the
// disagreement is always the same shape — the cart says fine, the endpoint says no — and the buyer finds
// out at the last step, in English, after paying attention to a price that was never theirs.
//
// So the endpoint's own matching lines are LIFTED and RUN here against the same fixtures, rather than
// this guard restating what they are believed to do.
const here = dirname(fileURLToPath(import.meta.url));
const endpointSource = readFileSync(join(here, '..', '..', 'api', 'orders', 'create.js'), 'utf8')
  // Comments first: a rule that is only quoted in prose must not be able to satisfy a search for it.
  .replace(/^\s*\/\/.*$/gm, '');

const lifted = endpointSource.match(
  /const variantRef = [\s\S]*?throw new Error\(`No matching variant for \$\{slug\}[^\n]*\n/,
);
assert.ok(lifted, 'could not lift the variant matching out of api/orders/create.js — update this guard, not the endpoint');

const endpointAccepts = new Function('variants', 'line', 'slug', `
  try {
    ${lifted[0]}
    return true;
  } catch { return false; }
`);

// Every shape a stored cart line can be in by the time the catalogue has moved under it. Deliberately
// includes the two that must still be ACCEPTED, so a reconciler that flagged everything would fail here.
const twoVariants = [
  { id: '30-ml', size: '30 ml', priceNumber: 320000, stock: 2 },
  { id: '50-ml', size: '50 ml', priceNumber: 480000, stock: 7 },
];
const cases = [
  { what: 'names a variant that still exists', variants: twoVariants, line: { variantId: '30-ml', size: '30 ml' } },
  { what: 'names a dead variant id, but a size that is still sold', variants: twoVariants, line: { variantId: 'gone', size: '30 ml' } },
  { what: 'names a dead variant id and a dead size', variants: twoVariants, line: { variantId: 'gone', size: '5 ml' } },
  { what: 'names no variant, and its size is still sold (quick-add from a card)', variants: twoVariants, line: { variantId: '', size: '50 ml' } },
  { what: 'names no variant, and its size is gone', variants: twoVariants, line: { variantId: '', size: '5 ml' } },
  { what: 'is a gift whose aroma was retired from the vial', variants: [{ id: 'hug-n-1', size: 'HUG N°1', priceNumber: 0, stock: 12 }], line: { variantId: 'sudra', size: 'Sudra' } },
  { what: 'belongs to a product carrying no variants at all', variants: [], line: { variantId: '', size: '30 ml' } },
];

let agreed = 0;
let refusedSomething = 0;
for (const testCase of cases) {
  const product = { id: 'p9', slug: 'subject', priceNumber: 300000, variants: testCase.variants };
  const stored = {
    productId: 'p9', slug: 'subject', productSlug: 'subject', name: 'Subject',
    priceNumber: 250000, quantity: 1, ...testCase.line,
  };
  const [reconciled] = reconcileCartLines([stored], [product]);
  const cartKeeps = !reconciled.unavailable;
  const endpointKeeps = endpointAccepts(testCase.variants, stored, 'subject');
  assert.equal(cartKeeps, endpointKeeps,
    `the cart and api/orders/create.js disagree about a line that ${testCase.what}: `
    + `cart ${cartKeeps ? 'keeps' : 'flags'} it, endpoint ${endpointKeeps ? 'accepts' : 'refuses'} it`);
  agreed += 1;
  if (!endpointKeeps) refusedSomething += 1;
  // A flagged line must keep the price it was stored at. Re-pricing it to another bottle is the half of
  // this bug that costs money: the buyer was shown the 50 ml price for a 30 ml line that no longer exists.
  if (!cartKeeps) assert.equal(reconciled.priceNumber, 250000, `a flagged line must not be re-priced (${testCase.what})`);
}
assert.equal(agreed, cases.length);
assert.ok(refusedSomething >= 3, `the fixtures must actually reach the refusing branch — only ${refusedSomething} did`);
assert.ok(cases.length - refusedSomething >= 2, 'and at least two fixtures must still be accepted, or agreement is trivial');

// An empty catalog is still a no-op (it means "not loaded", not "everything is gone")
assert.deepEqual(reconcileCartLines(stored, []), stored);

console.log('cartReconcile selfcheck OK');
