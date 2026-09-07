// `node src/utils/productMood.selfcheck.mjs`
import assert from 'node:assert/strict';
import { isPlaceholderMood, moodForEditing } from './productMood.js';

// The stored default, in each language it has been written in.
assert.equal(isPlaceholderMood('Custom perfume profile'), true);
assert.equal(isPlaceholderMood('Profil parfum bespoke'), true);
assert.equal(isPlaceholderMood('  custom PERFUME profile  '), true, 'case and padding must not smuggle it through');
assert.equal(isPlaceholderMood(''), true);
assert.equal(isPlaceholderMood(null), true);
assert.equal(isPlaceholderMood(undefined), true);

// A mood someone actually chose survives.
assert.equal(isPlaceholderMood('Tenang, harian'), false);
assert.equal(isPlaceholderMood('Hangat malam'), false);

// An editor opens empty on a placeholder, and untouched on a real value.
assert.equal(moodForEditing('Custom perfume profile'), '');
assert.equal(moodForEditing('Tenang, harian'), 'Tenang, harian');
assert.equal(moodForEditing(undefined), '');

console.log('productMood selfcheck OK');
