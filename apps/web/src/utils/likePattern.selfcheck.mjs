// Runnable check for LIKE-pattern escaping. `node src/utils/likePattern.selfcheck.mjs`.
// Every stocked dilution row is named with a '%', which is a LIKE wildcard — an unescaped lookup
// matched the wrong material and silently merged a new one into it.
import assert from 'node:assert/strict';

// Mirrors rawMaterialsService.escapeLikePattern
const escapeLikePattern = (value) => String(value || '').replace(/([\\%_])/g, '\\$1');

assert.equal(escapeLikePattern('Iso E Super 10%'), 'Iso E Super 10\\%');
assert.equal(escapeLikePattern('Hedione'), 'Hedione');
assert.equal(escapeLikePattern('Ambrox_DL'), 'Ambrox\\_DL');
assert.equal(escapeLikePattern('50%_mix'), '50\\%\\_mix');
assert.equal(escapeLikePattern('back\\slash'), 'back\\\\slash');
assert.equal(escapeLikePattern(''), '');
assert.equal(escapeLikePattern(null), '');

// The point of it: an escaped pattern only matches its own literal text.
const likeMatches = (pattern, value) => {
  // minimal LIKE: \x is a literal x, % is any run, _ is any single char
  let rx = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '\\') { rx += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i += 1; }
    else if (ch === '%') rx += '.*';
    else if (ch === '_') rx += '.';
    else rx += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${rx}$`, 'i').test(value);
};

// Unescaped, "Iso E Super 10%" would also match the neat material's longer name
assert.equal(likeMatches('Iso E Super 10%', 'Iso E Super 10% in DPG'), true);
// Escaped, it matches only itself
assert.equal(likeMatches(escapeLikePattern('Iso E Super 10%'), 'Iso E Super 10% in DPG'), false);
assert.equal(likeMatches(escapeLikePattern('Iso E Super 10%'), 'Iso E Super 10%'), true);

console.log('likePattern selfcheck OK');

// The or()-group sanitiser: ordinary material names must survive, structural chars must not
const { sanitizeOrFilterSearch } = await import('./likePattern.js');
assert.equal(sanitizeOrFilterSearch('Ambrox (DL)'), 'Ambrox  DL');
assert.equal(sanitizeOrFilterSearch('Iso E Super 10%'), 'Iso E Super 10');
assert.equal(sanitizeOrFilterSearch('Hedione'), 'Hedione');
assert.equal(sanitizeOrFilterSearch('a,b'), 'a b');
assert.equal(sanitizeOrFilterSearch(''), '');
assert.equal(sanitizeOrFilterSearch(null), '');
console.log('sanitizeOrFilterSearch selfcheck OK');
