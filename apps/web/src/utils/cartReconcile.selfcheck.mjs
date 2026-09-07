// Runnable check for cart reconciliation. `node src/utils/cartReconcile.selfcheck.mjs`.
// This decides what the buyer is actually charged for a cart restored from localStorage.
import assert from 'node:assert/strict';
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

// An empty catalog is still a no-op (it means "not loaded", not "everything is gone")
assert.deepEqual(reconcileCartLines(stored, []), stored);

console.log('cartReconcile selfcheck OK');
