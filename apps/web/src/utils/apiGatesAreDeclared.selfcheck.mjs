// Every serverless endpoint declares who may call it, and the declaration is checked against the code.
//
// Written after sweeping the twelve handlers BY EYE and getting two of them wrong: a grep for the usual
// auth words reported formula/import-pdf.js and imports/index.js as ungated, when both call assertAdmin
// through a helper the grep did not know about. An eyeball sweep of an auth surface is exactly the thing
// that should not be trusted twice.
//
// So the table below is the claim, and each row is verified against the file. A NEW endpoint fails this
// chain until someone writes down what gates it — which is the only moment anybody is thinking about it.
//
// WHAT THE AUDIT OF 2026-10-25 FOUND, so the next reader does not re-derive it:
//
//   - Only shipping/rates.js is reachable with no credential of any kind, and it proxies a QUOTA-LIMITED
//     PAID API. Exhausting that quota does not merely cost money: computeShippingFee then throws and no
//     domestic order can be created at all. There is no rate limit and no cache (measured from outside:
//     200, 8 results, `cache-control: public, max-age=0, must-revalidate`, x-vercel-cache MISS). A naive
//     per-IP limit would misfire, because orders/create.js calls this same endpoint through the public
//     edge from Vercel's own egress IP — every checkout in the world would look like one client.
//
//   - Four endpoints are keyed on nothing but an order number. That number is NOT a secret: this repo
//     says so itself in paymentLinkToken.js ("printed on every invoice and quoted in every WhatsApp
//     thread"), and the generator is Date.now() in base36 plus six characters of Math.random(). What
//     they disclose to a holder of that number was measured from 25 real DOKU payload rows rather than
//     guessed: amount, invoice number, status, virtual account number and dates. No name, no email, no
//     phone, no address. A virtual account number is where money is paid IN, so it is not a way out.
//     Keyed, not secret — written down here because the next person to add such an endpoint will assume
//     one or the other.
//
//   - Three things that were NOT true, each killed by measurement: a forged Host header redirecting
//     computeShippingFee (Vercel's edge answers 404 DEPLOYMENT_NOT_FOUND before any function runs);
//     order numbers being sequential and enumerable (they are random); and customer PII in the DOKU
//     status payload (there is none).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = path.resolve(HERE, '../../api');

// What gates each endpoint, and the text that proves it. Comments are stripped before matching: a file
// that only TALKS about assertAdmin must not pass for calling it.
const GATES = {
  'doku/checkout.js': 'order-number',
  'doku/notification.js': 'doku-signature',
  'doku/qris.js': 'order-number',
  'doku/status.js': 'order-number',
  'formula/import-pdf.js': 'admin',
  'imports/index.js': 'admin',
  'not-found.js': 'public',
  'orders/create.js': 'public',
  'orders/expire-reservations.js': 'cron-secret',
  'orders/notify-proof.js': 'order-number',
  'shipping/rates.js': 'public',
  'telegram/webhook.js': 'shared-secret',
};

const PROOF = {
  admin: /assertAdmin\(/,
  'doku-signature': /secureCompare\(receivedSignature, expectedSignature\)/,
  'cron-secret': /process\.env\.CRON_SECRET/,
  'shared-secret': /secret_token|secret-token|TELEGRAM_WEBHOOK_SECRET/i,
  // Both spellings, because some handlers read the parsed body into `input` first. The first version
  // only knew `body.` and failed three of the four — a reminder that the proof pattern is itself a
  // guess until it is run.
  'order-number': /(input|body)\.(orderNumber|invoiceNumber|order)\b/,
  public: null,
};

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const handlers = walk(API)
  .filter((file) => file.endsWith('.js'))
  .map((file) => path.relative(API, file).split(path.sep).join('/'))
  .sort();

// --- 1. Nothing new slips in undeclared --------------------------------------------------------------
assert.deepEqual(handlers, Object.keys(GATES).sort(),
  'an endpoint was added or removed without declaring what gates it. Add it to GATES with the right kind '
  + 'and read the audit notes at the top of this file before choosing "public".');

// A floor, so a walk that finds nothing cannot pass by having nothing to check.
assert.ok(handlers.length >= 12, `only ${handlers.length} handler(s) walked — the walk is broken, not the api`);

// --- 2. Each declared gate is really in the code -------------------------------------------------------
for (const [file, gate] of Object.entries(GATES)) {
  assert.ok(gate in PROOF, `${file} claims an unknown gate kind: ${gate}`);
  const proof = PROOF[gate];
  if (!proof) continue;
  const source = stripComments(fs.readFileSync(path.join(API, file), 'utf8'));
  assert.match(source, proof, `${file} claims the ${gate} gate and the code does not show it`);
}

// --- 3. The admin gate is the real one, not a lookalike -----------------------------------------------
// assertAdmin must be CALLED and awaited before anything else happens. import-pdf.js says it out loud:
// "an unauthenticated caller must not get to stream 8 MB at us."
for (const [file, gate] of Object.entries(GATES)) {
  if (gate !== 'admin') continue;
  const source = stripComments(fs.readFileSync(path.join(API, file), 'utf8'));
  assert.match(source, /await assertAdmin\(/, `${file} must await assertAdmin, not merely reference it`);
  const bodyRead = source.search(/readBody\(|request\.body/);
  const adminAt = source.search(/await assertAdmin\(/);
  if (bodyRead > -1) {
    assert.ok(adminAt < bodyRead,
      `${file} reads the request body before checking the caller is an admin`);
  }
}

// --- 4. Only the endpoints that are MEANT to be open are open -----------------------------------------
// Three today, each for a stated reason: the 404 catch-all, the buyer's own checkout, and the shipping
// quote the checkout screen needs before anyone has an account. A fourth appearing here is the finding.
const open = Object.entries(GATES).filter(([, gate]) => gate === 'public').map(([file]) => file);
assert.deepEqual(open, ['not-found.js', 'orders/create.js', 'shipping/rates.js'],
  'the set of endpoints callable with no credential at all has changed — that set is the attack surface, '
  + 'so it changes on purpose or not at all');
