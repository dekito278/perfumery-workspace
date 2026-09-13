// `node src/utils/itemWeight.selfcheck.mjs`
//
// Shipping weight is a money path on both ends: the browser quotes a courier fee from it and the order
// endpoint reprices the order from it. If the two ever compute it differently, a buyer sees one fee and
// is charged another — the same class of bug as a price that moves at checkout.
//
// The four numbers below are measurements Dekito took, not a formula. Nothing may "tidy" them into a
// curve: the jump from 50 ml (350 g) to 100 ml (650 g) is not proportional and never was.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_ITEM_WEIGHT_GRAM,
  ITEM_WEIGHT_GRAM_BY_ML,
  isWeighedSize,
  itemWeightGram,
  parseSizeMl,
  totalItemWeightGram,
} from './itemWeight.js';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => readFileSync(join(webRoot, ...parts), 'utf8');

// --- the measurements -------------------------------------------------------------------------------
assert.deepEqual(ITEM_WEIGHT_GRAM_BY_ML, { 10: 100, 30: 250, 50: 350, 100: 650 },
  'these are weighed values, not a formula — changing one changes what a buyer is charged for shipping');
assert.equal(itemWeightGram('10 ml'), 100);
assert.equal(itemWeightGram('30 ml'), 250);
assert.equal(itemWeightGram('50 ml'), 350);
assert.equal(itemWeightGram('100 ml'), 650);

// The old flat assumption, for contrast: it over-weighed a 10 ml threefold and under-weighed a 100 ml by
// more than half. The second one is the one that cost money, and export brackets are steep.
assert.ok(itemWeightGram('100 ml') > DEFAULT_ITEM_WEIGHT_GRAM * 2);
assert.ok(itemWeightGram('10 ml') < DEFAULT_ITEM_WEIGHT_GRAM);

// --- reading a size out of a label ------------------------------------------------------------------
assert.equal(parseSizeMl('30 ml'), 30);
assert.equal(parseSizeMl('30ml'), 30);
assert.equal(parseSizeMl('30 ML'), 30);
assert.equal(parseSizeMl('Botol 100 ml'), 100);
// Bespoke bottle-size options are DB labels, and some carry their price. The size must still be found.
assert.equal(parseSizeMl('30 ml — Rp 650.000'), 30);
assert.equal(parseSizeMl('Rp 100.000 (30 ml)'), 30,
  'a price with thousands separators must not be mistaken for a volume');
assert.equal(parseSizeMl('100'), null, 'a bare number is not a size');
assert.equal(parseSizeMl(''), null);
assert.equal(parseSizeMl(undefined), null);
assert.equal(parseSizeMl(null), null);

// --- an unweighed size falls back, it is never guessed at --------------------------------------------
assert.equal(itemWeightGram('5 ml'), DEFAULT_ITEM_WEIGHT_GRAM, 'a size nobody weighed behaves as it did before');
assert.equal(itemWeightGram(''), DEFAULT_ITEM_WEIGHT_GRAM);
assert.equal(itemWeightGram('15 ml', 250), 250, 'the caller may pass its own env fallback');
assert.equal(itemWeightGram('30 ml', 999), 250, 'a weighed size wins over any fallback');
assert.equal(isWeighedSize('30 ml'), true);
assert.equal(isWeighedSize('15 ml'), false, 'Studio must be able to say which lines were not weighed');
assert.equal(isWeighedSize(''), false);

// --- totals -----------------------------------------------------------------------------------------
assert.equal(totalItemWeightGram([{ size: '30 ml', quantity: 2 }, { size: '100 ml', quantity: 1 }]), 1150);
assert.equal(totalItemWeightGram([{ size: '10 ml', quantity: 6 }]), 600);
// Never zero: a courier asked to price 0 g answers with an error or a suspiciously cheap rate.
assert.equal(totalItemWeightGram([]), DEFAULT_ITEM_WEIGHT_GRAM, 'an empty cart must not ask for a 0 g quote');
assert.equal(totalItemWeightGram([{ size: '30 ml', quantity: 0 }]), DEFAULT_ITEM_WEIGHT_GRAM);
// ...but the fallback is for an EMPTY total only. As a minimum weight it would round one 10 ml bottle up
// to 300 g and overcharge the lightest orders — caught by running this, not by reading it.
assert.equal(totalItemWeightGram([{ size: '10 ml', quantity: 1 }]), 100,
  'a single light bottle must keep its real weight, not be floored to the fallback');
assert.equal(totalItemWeightGram([{ size: '10 ml', quantity: 2 }]), 200);
assert.equal(totalItemWeightGram(null), DEFAULT_ITEM_WEIGHT_GRAM);
assert.equal(totalItemWeightGram([{ size: '30 ml', quantity: 'dua' }]), DEFAULT_ITEM_WEIGHT_GRAM,
  'junk quantity must not become NaN grams in a courier request');
assert.ok(Number.isFinite(totalItemWeightGram([{ size: '30 ml', quantity: 1.6 }])));

// --- one implementation, both ends of the money path -------------------------------------------------
const client = read('src', 'services', 'shippingService.js');
const server = read('api', 'orders', 'create.js');
for (const [label, source] of [['the checkout quote', client], ['the order endpoint', server]]) {
  assert.match(source, /totalItemWeightGram\(/, `${label} must weigh through the shared table`);
  assert.doesNotMatch(source, /quantity \|\| 0\)\), 0\)[\s\S]{0,80}\* *(defaultItemWeight|itemWeight)/,
    `${label} must not multiply a bottle count by one flat weight again`);
}
// The endpoint weighs the sizes IT decided on, not the ones the client sent — same rule as the price.
assert.match(server, /const weighedLines = isBespoke/);
assert.match(server, /catalog\.resolved/, 'the server must weigh its own resolved lines');

// Both bespoke pages quote the chosen bottle size, or their fee disagrees with the endpoint's.
for (const file of [['src', 'pages', 'BespokePage.jsx'], ['src', 'pages', 'mobile', 'MobileBespokePage.jsx']]) {
  assert.match(read(...file), /getCheckoutShippingWeight\(\[\{ quantity: 1, size:/,
    `${file.join('/')} must weigh the chosen bottle size, not a flat bottle`);
}

console.log('itemWeight selfcheck OK (four weighed sizes, one table, both ends of the money path)');
