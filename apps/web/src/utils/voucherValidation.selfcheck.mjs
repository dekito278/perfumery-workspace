// Runnable check for voucher eligibility. `node src/utils/voucherValidation.selfcheck.mjs`.
// The empty-item case decides whether a product-restricted voucher can discount a bespoke order.
import assert from 'node:assert/strict';
import { getVoucherEligibleSubtotal, validateVoucher } from './voucherValidation.js';

const items = [
  { slug: 'rain-letter', category: 'Perfume', priceNumber: 300000, quantity: 1 },
  { slug: 'other-scent', category: 'Body Mist', priceNumber: 100000, quantity: 2 },
];

// No restrictions: the whole order counts, with or without an item list
assert.equal(getVoucherEligibleSubtotal({}, items, 500000), 500000);
assert.equal(getVoucherEligibleSubtotal({}, [], 500000), 500000);

// Restricted to one product: only that line counts
assert.equal(getVoucherEligibleSubtotal({ eligibleProductSlugs: ['rain-letter'] }, items, 500000), 300000);
// Restricted to a category
assert.equal(getVoucherEligibleSubtotal({ eligibleCategories: ['Body Mist'] }, items, 500000), 200000);
// Restricted, but nothing to check against → nothing is eligible (was: the entire order)
assert.equal(getVoucherEligibleSubtotal({ eligibleProductSlugs: ['rain-letter'] }, [], 500000), 0);
assert.equal(getVoucherEligibleSubtotal({ eligibleCategories: ['Perfume'] }, undefined, 500000), 0);

// End to end: a product-restricted voucher must not apply to an order with no catalog lines (bespoke)
const voucher = {
  code: 'RAIN50', active: true, discountType: 'percent', discountValue: 50,
  eligibleProductSlugs: ['rain-letter'],
};
assert.equal(validateVoucher({ code: 'RAIN50', voucher, subtotal: 545000, items: [] }).valid, false);
assert.equal(validateVoucher({ code: 'RAIN50', voucher, subtotal: 545000, items: [] }).discountAmount, 0);
// ...but still applies to the product it names
assert.equal(validateVoucher({ code: 'RAIN50', voucher, subtotal: 500000, items }).discountAmount, 150000);

console.log('voucherValidation selfcheck OK');
