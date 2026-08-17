// Runnable check for the brief-intent endpoint. `node tools/api-selfchecks/brief-intent.selfcheck.mjs`.
// Covers the paths that answer without touching an AI gateway: method guard, empty
// brief, the gas/fuel keyword branch, and the generic fallback. Guards the ESM
// conversion done when this file moved out of the never-deployed repo-root api/.
import assert from 'node:assert/strict';
import handler, { buildFallbackIntent } from '../../api/brief-intent.js';

// Minimal stand-in for the req/res helpers Vercel's Node runtime injects.
const call = async (req) => {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  await handler({ method: 'POST', body: {}, ...req }, res);
  return res;
};

const assertIntentShape = (intent, label) => {
  for (const stage of ['top', 'middle', 'base']) {
    assert.ok(intent.stage_blueprints?.[stage], `${label}: missing ${stage} blueprint`);
    assert.ok(Array.isArray(intent.question_plan?.[stage]), `${label}: missing ${stage} question plan`);
  }
  assert.ok(intent.confidence >= 0 && intent.confidence <= 1, `${label}: confidence out of range`);
};

// Method guard.
const notAllowed = await call({ method: 'GET' });
assert.equal(notAllowed.statusCode, 405);
assert.equal(notAllowed.headers.Allow, 'POST');

// Empty brief short-circuits to the fallback — never an error status, the wizard
// consumes this response directly.
const empty = await call({ body: { freeText: '   ' } });
assert.equal(empty.statusCode, 200);
assert.equal(empty.body.source, 'fallback');
assertIntentShape(empty.body, 'empty brief');

// Explicitly disabled still returns a usable intent rather than failing the wizard.
process.env.DISABLE_BRIEF_AI_INTENT = '1';
const disabled = await call({ body: { freeText: 'kayu dan hujan' } });
assert.equal(disabled.statusCode, 200);
assert.equal(disabled.body.source, 'fallback');
assertIntentShape(disabled.body, 'disabled');
delete process.env.DISABLE_BRIEF_AI_INTENT;

// Keyword routing: the gas/fuel branch must win over the generic default, in both
// languages, and must not fire on unrelated briefs.
for (const text of ['realistic gas smell', 'aroma bensin yang nyata', 'cold fuel vapor']) {
  assert.equal(buildFallbackIntent(text).confidence, 0.72, `expected gas branch for "${text}"`);
}
assert.equal(buildFallbackIntent('soft floral musk').confidence, 0.35, 'expected generic branch');

// Caller-supplied reason wins over the branch default.
assert.equal(buildFallbackIntent('gas', 'gateway down').fallback_reason, 'gateway down');

console.log('brief-intent selfcheck OK');
