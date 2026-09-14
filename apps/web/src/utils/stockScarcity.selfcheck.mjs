// `node src/utils/stockScarcity.selfcheck.mjs`
import assert from 'node:assert/strict';
import { getScarcityLabel, getScarcityCount, SCARCITY_THRESHOLD } from './stockScarcity.js';
import { translate } from '../i18n/messages.js';

// The line is written in the shop's language now, so the tests speak it too.
const id = (key, vars) => translate('id', key, vars);
const en = (key, vars) => translate('en', key, vars);

assert.equal(getScarcityLabel(1, id), 'Tersisa 1 botol', 'singular, not "1 botol-botol"');
assert.equal(getScarcityLabel(1, en), '1 bottle left', 'and singular in English too');
assert.equal(getScarcityLabel(2, en), '2 bottles left', 'plural in English');
// No translator, no sentence. A default would print Indonesian into the English shop in silence.
assert.equal(getScarcityLabel(2), '', 'without a translator there is no line at all');
assert.equal(getScarcityLabel(2, 'not a function'), '');
assert.equal(getScarcityLabel(2, id), 'Tersisa 2 botol');
assert.equal(getScarcityLabel(SCARCITY_THRESHOLD, id), `Tersisa ${SCARCITY_THRESHOLD} botol`, 'the threshold itself still speaks');

// Silence above the threshold: a scarcity line on a well-stocked product is just an inventory report.
assert.equal(getScarcityLabel(SCARCITY_THRESHOLD + 1, id), '');
assert.equal(getScarcityLabel(40, id), '');

// Sold out is the add-to-cart button's job, not this one's.
assert.equal(getScarcityLabel(0, id), '');
assert.equal(getScarcityLabel(-3, id), '');

// Junk in, silence out — never "Tersisa NaN botol" on a live product page.
assert.equal(getScarcityLabel(null, id), '');
assert.equal(getScarcityLabel(undefined, id), '');
assert.equal(getScarcityLabel('banyak', id), '');
assert.equal(getScarcityLabel('', id), '');
assert.equal(getScarcityLabel('3', id), 'Tersisa 3 botol', 'numeric strings are fine');
assert.equal(getScarcityLabel(2.9, id), 'Tersisa 2 botol', 'never round a bottle up into existence');
assert.equal(getScarcityCount(4), 4);

console.log('stockScarcity selfcheck OK (a short shelf says so, in the shop\'s own language, and says nothing without one)');
