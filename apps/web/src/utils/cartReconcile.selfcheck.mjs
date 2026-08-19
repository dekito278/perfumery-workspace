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

// An unchanged price is not flagged
const [same] = reconcileCartLines([{ ...stored[0], priceNumber: 320000 }], catalog);
assert.equal(same.priceChanged, false);

// A product that left the catalog is left exactly as stored, and an empty catalog is a no-op
const gone = [{ ...stored[0], productId: 'gone', productSlug: 'deleted', slug: 'deleted' }];
assert.deepEqual(reconcileCartLines(gone, catalog), gone);
assert.deepEqual(reconcileCartLines(stored, []), stored);

console.log('cartReconcile selfcheck OK');
