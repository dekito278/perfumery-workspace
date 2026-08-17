// Runnable check for the import-pdf admin gate. `node api/formula/import-pdf.selfcheck.mjs`.
// The endpoint is the studio's mobile PDF-import fallback and hands its input to pdfjs,
// so the property that matters is that no unauthenticated body ever reaches the parser.
import assert from 'node:assert/strict';
import handler from './import-pdf.js';

process.env.VITE_SUPABASE_URL = 'https://project.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';

const realFetch = globalThis.fetch;

// Stands in for Supabase's rpc/is_admin: a bad token is rejected by Supabase itself,
// a good non-admin token returns false, the owner's token returns true.
const stubIsAdmin = (behaviour) => {
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith('/rest/v1/rpc/is_admin'), 'unexpected fetch target');
    const token = String(init.headers.Authorization || '').replace(/^Bearer\s+/, '');
    if (behaviour === 'reject-token') return { ok: false, json: async () => null };
    return { ok: true, json: async () => token === 'owner-token' };
  };
};

let bodyWasRead = false;
const call = async ({ authorization, method = 'POST' } = {}) => {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(payload) { this.body = JSON.parse(payload); },
  };
  const req = {
    method,
    headers: authorization ? { authorization } : {},
    // Reading the request stream is the expensive, attacker-controlled part. If the
    // gate ever moves below readBody, this iterator runs and the assertions below fail.
    async *[Symbol.asyncIterator]() {
      bodyWasRead = true;
      yield Buffer.from(JSON.stringify({ fileName: 'x.pdf', dataBase64: '' }));
    },
  };
  await handler(req, res);
  return res;
};

const assertRejected = async (label, options, expectedStatus) => {
  bodyWasRead = false;
  const res = await call(options);
  assert.equal(res.statusCode, expectedStatus, `${label}: expected ${expectedStatus}, got ${res.statusCode}`);
  assert.equal(bodyWasRead, false, `${label}: request body was read before the gate rejected it`);
};

// Method guard still answers first, without touching auth.
stubIsAdmin('ok');
await assertRejected('GET', { method: 'GET' }, 405);

// No credentials at all — the state the endpoint shipped in.
await assertRejected('no Authorization header', {}, 401);
await assertRejected('empty bearer', { authorization: 'Bearer   ' }, 401);

// Supabase rejected the JWT (expired, forged, wrong project).
stubIsAdmin('reject-token');
await assertRejected('invalid token', { authorization: 'Bearer tampered' }, 401);

// Valid login, but a customer rather than the studio owner: authenticated != admin.
stubIsAdmin('ok');
await assertRejected('authenticated non-admin', { authorization: 'Bearer customer-token' }, 403);

// The owner gets through the gate — reaches the body, and fails on empty PDF data
// rather than on auth.
bodyWasRead = false;
const admin = await call({ authorization: 'Bearer owner-token' });
assert.equal(bodyWasRead, true, 'admin request never reached the body');
assert.equal(admin.statusCode, 400, `admin expected 400 for empty PDF, got ${admin.statusCode}`);

globalThis.fetch = realFetch;
console.log('import-pdf admin gate selfcheck OK');
