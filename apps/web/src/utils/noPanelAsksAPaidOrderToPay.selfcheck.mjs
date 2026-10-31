// `node src/utils/noPanelAsksAPaidOrderToPay.selfcheck.mjs`
//
// /payment?order=<n> renders ONE of several panels, chosen by payment provider, and each panel is a
// different way to hand the buyer a way to pay. A paid order must not be shown any of them.
//
// Two of them already knew that. PaymentFrame learned it in audit round 7 — the DOKU return URL lands
// back on this page with the order already paid, and the iframe invited a second payment for the same
// invoice — and QrisPanel was written with it. ManualTransferPanel, the panel 20 of this shop's 35
// orders use, was not: it went on printing the BCA account number, big and copyable, under the sentence
// "Transfer ke rekening berikut", with "Total transfer" beside it.
//
// Measured on production 2026-10-10 (service role, read-only): 14 orders are paid manual transfers.
// Each one's own payment link — the link its notification carries — offered the account and the total
// again, and 2 of the 14, marked paid with no proof on file, were also still asked to upload one.
//
// The rule is not "these three panels". It is: every panel this page hands a session to refuses a paid
// one. The subject is read from the page's own chooser, so a fourth provider added tomorrow is checked
// the day it is wired up rather than the day someone pays twice.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'pages', 'PaymentPage.jsx'), 'utf8');

// ── The subject: whatever the page hands a payment session to ───────────────────────────────────────
// There were two choosers — the phone's ternary and the desktop's — compared for parity. One page serves
// every screen since the phone storefront retired (2026-10-31), so the subject is the one chooser: every
// component this page hands the session to and that may ask for money. The breakdown only prints totals.
const chooserPanels = (source) => [...source.matchAll(/<([A-Z]\w+)\s+session=\{session\}/g)].map((m) => m[1]);
const PRINTS_ONLY = new Set(['PaymentTotalBreakdown']);
assert.doesNotMatch(page, /if \(isMobile\) \{/, 'a phone branch is back — it would need its own panels checked');
const mobilePanels = [...new Set(chooserPanels(page))].filter((name) => !PRINTS_ONLY.has(name)).sort();
assert.ok(mobilePanels.length >= 3, `only ${mobilePanels.length} payment panels found — the parse is broken`);
assert.ok(chooserPanels(page).includes('PaymentTotalBreakdown'), 'the exemption names a component the page no longer renders');

// ── Every one of them refuses a paid order, before it renders anything else ─────────────────────────
const componentBody = (name) => {
  const start = page.indexOf(`const ${name} = (`);
  assert.notEqual(start, -1, `could not find ${name} — the chooser names a panel this file does not define`);
  const end = page.indexOf('\n};', start);
  assert.notEqual(end, -1, `could not find the end of ${name}`);
  return page.slice(start, end);
};

for (const name of mobilePanels) {
  const body = componentBody(name);

  // The panel has to ASK. A panel that renders a success state it never reaches is no protection, so
  // the condition and the early return are matched together rather than looked for separately.
  const shortCircuit = body.match(/if \(([^)]*\bpaid\b[^)]*)\)\s*\{\s*return \(?\s*<PaymentSuccessPanel/);
  assert.ok(
    shortCircuit,
    `${name} never turns a paid order away — it must short-circuit to <PaymentSuccessPanel>, the way PaymentFrame and QrisPanel do`,
  );
  // A POSITIVE test. `if (!paid)` matches every regex above and means the opposite.
  assert.ok(
    !shortCircuit[1].includes('!'),
    `${name} turns away the wrong orders: its paid check reads "${shortCircuit[1].trim()}"`,
  );

  // Where the answer comes from: the order's own payment status, not a prop or a guess.
  assert.match(
    body,
    /session\.paymentStatus === 'paid'/,
    `${name} must read session.paymentStatus to know the order is paid`,
  );

  // Before anything a buyer could act on. Measured against the panel's own main render: a short-circuit
  // placed after it is not a short-circuit.
  const mainReturn = body.lastIndexOf('return (');
  assert.ok(
    shortCircuit.index < mainReturn,
    `${name} checks for a paid order after it has already rendered its payment panel`,
  );
}

// ── The phone's sticky bar is a fourth way to pay ───────────────────────────────────────────────────
// It sits outside the panels, carries the amount, and its button scrolls the proof uploader into view
// and opens the file picker. Under a success panel it read "Total transfer … Upload bukti".
// The phone's bar is the page's own .ng-buybar since 2026-10-31 (StickyBottomActionBar left with the phone
// storefront); the condition that opens it is what is held.
const bar = page.match(/\{session && [^?]*\? \(\s*\n\s*<div className="ng-buybar\b/);
assert.ok(bar, "could not find the phone's payment action bar — this guard's parse is broken, not the page");
assert.match(
  bar[0],
  /session\.paymentStatus !== 'paid'/,
  "the phone's payment action bar must not offer a paid order a way to pay",
);

// ── And the success panel itself must not be a payment panel ────────────────────────────────────────
const success = componentBody('PaymentSuccessPanel');
for (const forbidden of ['accountNumber', 'pay.bankAccount', 'pay.totalDue', 'paymentUrl']) {
  assert.ok(
    !success.includes(forbidden),
    `PaymentSuccessPanel names ${forbidden} — the panel shown INSTEAD of a payment panel must not carry one`,
  );
}

console.log(`noPanelAsksAPaidOrderToPay: ok — ${mobilePanels.length} panels (${mobilePanels.join(', ')}), one chooser, each turning a paid order away before it renders`);
