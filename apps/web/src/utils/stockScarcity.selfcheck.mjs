// `node src/utils/stockScarcity.selfcheck.mjs`
import assert from 'node:assert/strict';
import { getScarcityLabel, getScarcityCount, SCARCITY_THRESHOLD } from './stockScarcity.js';

assert.equal(getScarcityLabel(1), 'Tersisa 1 botol', 'singular, not "1 botol-botol"');
assert.equal(getScarcityLabel(2), 'Tersisa 2 botol');
assert.equal(getScarcityLabel(SCARCITY_THRESHOLD), `Tersisa ${SCARCITY_THRESHOLD} botol`, 'the threshold itself still speaks');

// Silence above the threshold: a scarcity line on a well-stocked product is just an inventory report.
assert.equal(getScarcityLabel(SCARCITY_THRESHOLD + 1), '');
assert.equal(getScarcityLabel(40), '');

// Sold out is the add-to-cart button's job, not this one's.
assert.equal(getScarcityLabel(0), '');
assert.equal(getScarcityLabel(-3), '');

// Junk in, silence out — never "Tersisa NaN botol" on a live product page.
assert.equal(getScarcityLabel(null), '');
assert.equal(getScarcityLabel(undefined), '');
assert.equal(getScarcityLabel('banyak'), '');
assert.equal(getScarcityLabel(''), '');
assert.equal(getScarcityLabel('3'), 'Tersisa 3 botol', 'numeric strings are fine');
assert.equal(getScarcityLabel(2.9), 'Tersisa 2 botol', 'never round a bottle up into existence');
assert.equal(getScarcityCount(4), 4);

console.log('stockScarcity selfcheck OK');
