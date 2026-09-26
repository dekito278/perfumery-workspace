// `node src/utils/orderTextIsBounded.selfcheck.mjs`
//
// api/orders/create.js copies two client strings into the order row exactly as they arrive: the buyer's
// notes and the checkout draft. Nothing bounded them, so the only ceiling was the platform's request
// body — megabytes of text in a row that both Studio order screens render in full, on an endpoint that
// takes no authentication (audit round 9, O-4).
//
// Refused rather than truncated, and that is a decision worth stating: cutting a note in half throws
// away the end, which on a bespoke brief is the part that carries the story. A buyer told her note is
// too long can shorten it; a buyer whose note was silently halved cannot.
//
// The limits were measured rather than chosen. The longest realistic checkout draft — a twenty-line cart
// with long product names, a full Malang address and a gift note — is 1,749 characters. A generously
// written bespoke brief is 881. The limits below sit an order of magnitude above both, which is why this
// guard runs those figures rather than restating the numbers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const endpoint = readFileSync(join(src, '..', 'api', 'orders', 'create.js'), 'utf8');

// --- 1. The check exists, and it refuses rather than trims ------------------------------------------------
const start = endpoint.indexOf('const tooLong = [');
assert.notEqual(start, -1,
  'the order endpoint no longer bounds the two client strings it writes into the row, so the only limit '
  + 'is the platform request body');
const block = endpoint.slice(start, endpoint.indexOf('}\n', endpoint.indexOf('if (tooLong)', start)) + 1);
assert.match(block, /jsonResponse\(res, 422/, 'an over-long note must be refused, not accepted');
assert.doesNotMatch(block, /\.slice\(|\.substring\(|truncat/i,
  'the text is trimmed instead of refused — the end of a bespoke brief is the half that carries the story');

// --- 2. Both fields are covered, and the limits clear real content ----------------------------------------
// Lifted and run, so the rule is the behaviour rather than the words.
const limits = Object.fromEntries(
  [...block.matchAll(/\['(\w+)', input\.\w+, (\d+)\]/g)].map((match) => [match[1], Number(match[2])]),
);
assert.deepEqual(Object.keys(limits).sort(), ['checkoutDraft', 'notes'],
  `both client strings written into the row must be bounded, found: ${Object.keys(limits).join(', ')}`);

// Measured on 2026-09-27 against the real builders, in the browser:
const MEASURED_LONGEST_DRAFT = 1749; // twenty-item cart, long names, full address, gift note
const MEASURED_LONGEST_BESPOKE = 881; // a generously written brief
assert.ok(limits.checkoutDraft > MEASURED_LONGEST_DRAFT * 5,
  `the checkout draft limit (${limits.checkoutDraft}) is too close to the longest real draft `
  + `(${MEASURED_LONGEST_DRAFT}); a big cart would be refused a genuine order`);
assert.ok(limits.notes > MEASURED_LONGEST_BESPOKE * 5,
  `the notes limit (${limits.notes}) is too close to a real bespoke brief (${MEASURED_LONGEST_BESPOKE})`);
// And still an actual bound: without an upper sanity check, "fixed" could mean a limit of 50 MB.
for (const [field, limit] of Object.entries(limits)) {
  assert.ok(limit <= 50000, `${field} is bounded at ${limit}, which is not a bound worth having`);
}

// --- 3. The refusal runs BEFORE the row is built ----------------------------------------------------------
// Checking length after the insert would bound nothing. Located by anchor, the way the order-count rule
// is, because this is a claim about sequence.
const writesTheRow = endpoint.indexOf("checkout_draft: isBespoke");
assert.notEqual(writesTheRow, -1, 'the row builder has moved; this guard cannot tell where the write is');
assert.ok(start < writesTheRow, 'the length check runs after the row is built, which bounds nothing');

// --- 4. And the refusal is readable by a buyer ------------------------------------------------------------
// This endpoint answers a person mid-checkout; "payload too large" is not an instruction.
const message = (block.match(/message: '([^']+)'/) || [])[1] || '';
assert.ok(/persingkat|shorten/i.test(message), `the refusal must tell the buyer what to do: "${message}"`);
assert.ok(!/payload|byte|character limit|4\.5/i.test(message), `the refusal reads like machinery: "${message}"`);

console.log(`orderTextIsBounded selfcheck OK (notes ≤ ${limits.notes}, checkoutDraft ≤ `
  + `${limits.checkoutDraft}, refused before the row is built, in a sentence a buyer can act on)`);
