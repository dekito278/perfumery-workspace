// `node src/utils/phoneNumber.selfcheck.mjs`
//
// hasValidWhatsAppPhoneNumber gates every checkout: fail it and the buyer cannot submit, pass a wrong
// number and the order arrives with no way to reach them. The rules are order-dependent and none of them
// were pinned, so this is the shape they actually have.
import assert from 'node:assert/strict';
import { hasValidWhatsAppPhoneNumber, normalizeWhatsAppPhoneNumber } from './phoneNumber.js';

const norm = normalizeWhatsAppPhoneNumber;

// --- the ways an Indonesian buyer actually types their number ---------------------------------------
assert.equal(norm('081234567890'), '6281234567890', 'leading 0');
assert.equal(norm('0812 3456 7890'), '6281234567890', 'spaces');
assert.equal(norm('0812-3456-7890'), '6281234567890', 'dashes');
assert.equal(norm('+62 812 3456 7890'), '6281234567890', 'plus and country code');
assert.equal(norm('62 812 3456 7890'), '6281234567890', 'country code, no plus');
assert.equal(norm('812 3456 7890'), '6281234567890', 'no zero, no country code');
assert.equal(norm('0062 812 3456 7890'), '6281234567890', '00 international prefix');
// Country code AND the national leading zero — a very common double-entry. Without the 620 rule this
// became 620812..., a number that does not exist.
assert.equal(norm('+62 0812 3456 7890'), '6281234567890', 'country code plus leading zero');
assert.equal(norm('0812-3456-7890 (WA)'), '6281234567890', 'trailing note is stripped');

// All of the above are one number, so checkout must accept every spelling of it.
for (const spelling of ['081234567890', '+62 812 3456 7890', '812 3456 7890', '+62 0812 3456 7890']) {
  assert.equal(hasValidWhatsAppPhoneNumber(spelling), true, `rejected a valid number: ${spelling}`);
}

// --- what must not pass ----------------------------------------------------------------------------
assert.equal(hasValidWhatsAppPhoneNumber(''), false, 'empty');
assert.equal(hasValidWhatsAppPhoneNumber('   '), false, 'whitespace');
assert.equal(hasValidWhatsAppPhoneNumber('tidak punya'), false, 'letters only');
assert.equal(hasValidWhatsAppPhoneNumber('0812'), false, 'far too short');
// Sits just under the minimum: 08123456 normalises to nine characters. '0812' alone is rejected for so
// many reasons that it proves nothing about the length rule — this is the case that actually holds it.
assert.equal(hasValidWhatsAppPhoneNumber('08123456'), false, 'one short of the minimum');
assert.equal(hasValidWhatsAppPhoneNumber('0812345678901234567'), false, 'longer than E.164 allows');
// An email is not a WhatsApp number. The bespoke form deliberately accepts either in one field and does
// its own non-empty check, but anything routed through here must not treat an address as reachable.
assert.equal(hasValidWhatsAppPhoneNumber('nama@email.com'), false, 'email');
// The @ guard is load-bearing, and only a long-enough address proves it: strip the guard and
// "ade0812345678@gmail.com" normalises to a 13-character number that passes as a real WhatsApp contact.
assert.equal(hasValidWhatsAppPhoneNumber('ade0812345678@gmail.com'), false, 'an address whose digits would otherwise pass');

// --- known limitation, pinned so it is a decision rather than a surprise ----------------------------
// Any number beginning with 8 is assumed Indonesian. That is right for this shop and wrong for a foreign
// mobile that happens to start with 8: a Chinese +86 number becomes a 62 number that does not exist.
// Left as is deliberately — the convenience is worth more here than the edge case — but if the shop ever
// ships abroad, this is the line to revisit.
assert.equal(norm('+86 138 0013 8000'), '628613800138000', 'foreign 8-prefixed number is treated as Indonesian');
assert.equal(hasValidWhatsAppPhoneNumber('+86 138 0013 8000'), true, 'and it passes validation');

console.log('phoneNumber selfcheck OK');
