// Runnable check for Indonesian number entry. `node src/utils/numberInputs.selfcheck.mjs`.
// The separator rule decides real money: "150.000" typed into a price box must not become 150.
import assert from 'node:assert/strict';
import { normalizeLocalizedDecimalInput, parseLocalizedNumber } from './numberInputs.js';

// "." groups thousands
assert.equal(parseLocalizedNumber('150.000'), 150000);
assert.equal(parseLocalizedNumber('1.500'), 1500);
assert.equal(parseLocalizedNumber('1.250.000'), 1250000);
assert.equal(parseLocalizedNumber('250.000'), 250000);

// "," is the decimal separator, and it wins over grouping dots
assert.equal(parseLocalizedNumber('150.000,5'), 150000.5);
assert.equal(parseLocalizedNumber('1,5'), 1.5);
assert.equal(parseLocalizedNumber('0,75'), 0.75);

// A leading zero keeps the dot decimal — gram fields depend on it
assert.equal(parseLocalizedNumber('0.750'), 0.75);
assert.equal(parseLocalizedNumber('0.5'), 0.5);

// Fewer than three trailing digits is still a decimal
assert.equal(parseLocalizedNumber('1.5'), 1.5);
assert.equal(parseLocalizedNumber('12.75'), 12.75);

// Mid-typing states must survive unchanged, or the input fights the user
assert.equal(normalizeLocalizedDecimalInput('150.'), '150.');
assert.equal(normalizeLocalizedDecimalInput('150'), '150');
assert.equal(normalizeLocalizedDecimalInput(''), '');
assert.equal(normalizeLocalizedDecimalInput('.5'), '0.5');

// Plain integers and empties
assert.equal(parseLocalizedNumber('45000'), 45000);
assert.equal(parseLocalizedNumber('', 7), 7);
assert.equal(parseLocalizedNumber('abc', 3), 3);

console.log('numberInputs selfcheck OK');
