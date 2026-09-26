// `node src/utils/proofHistoryIsComplete.selfcheck.mjs`
//
// Both order detail screens build the payment-proof history: the audit log filtered down to the events
// about a receipt, each with a readable label. It is what gets read when a buyer says they paid and the
// money is not there.
//
// They disagreed about where the list of those events comes from. The phone derived it from its own
// label map with Object.keys; the desktop typed the four strings out in an array. Same four today, so
// nothing is wrong on screen — this is latent, not live.
//
// It is written down anyway because a hand-typed list sitting beside a derived one has cost this
// codebase real data twice this week: a snapshot that forgot three fields the form edits, and an editor
// state that forgot a column the save writes. The failure here is quieter than either: add a fifth proof
// action, and one screen shows it while the other drops it from the history without a gap to notice.
//
// The rule: one definition, and the actions are DERIVED from the labels rather than restated.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

const workflow = readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const stubs = 'const getBespokeItem = () => null;\nconst isBespokeOrder = () => false;\n'
  + 'const getOrderReservationExpiresAt = () => "";\nconst PAYMENT_RESERVATION_TTL_HOURS = 24;\n';
const { PAYMENT_PROOF_AUDIT_ACTIONS, PAYMENT_PROOF_AUDIT_LABELS } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + workflow, 'utf8').toString('base64')}`
);

// --- 1. The actions come from the labels, not from a second list ------------------------------------------
assert.deepEqual(PAYMENT_PROOF_AUDIT_ACTIONS, Object.keys(PAYMENT_PROOF_AUDIT_LABELS),
  'the actions are restated rather than derived, which is the whole thing this replaced');
assert.ok(PAYMENT_PROOF_AUDIT_ACTIONS.length >= 4,
  `expected the proof actions, found ${PAYMENT_PROOF_AUDIT_ACTIONS.join(', ')}`);
for (const action of ['payment_proof_uploaded', 'payment_proof_approved', 'payment_proof_rejected']) {
  assert.ok(PAYMENT_PROOF_AUDIT_ACTIONS.includes(action), `${action} is missing from the proof history`);
  assert.ok(PAYMENT_PROOF_AUDIT_LABELS[action], `${action} would render as its own raw action string`);
}
// A rejection has to be in there: it is the event a buyer argues with.
assert.match(PAYMENT_PROOF_AUDIT_LABELS.payment_proof_rejected, /tolak/i);

// --- 2. Neither screen keeps its own copy ------------------------------------------------------------------
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) screens.push(full);
  }
};
walk(join(src, 'pages'));

const proofScreens = screens.filter((file) => /getProofTimeline/.test(readFileSync(file, 'utf8')));
assert.ok(proofScreens.length >= 2,
  `expected both order detail screens, found ${proofScreens.length} — the scan is broken, not the code`);

for (const file of proofScreens) {
  const where = file.slice(src.length + 1);
  const text = readFileSync(file, 'utf8');
  // Inside getProofTimeline, not anywhere in the file: the import line mentions the constant too, so a
  // whole-file check passed a sabotage that replaced the filter with a literal array. That is the
  // weakness this repo keeps rediscovering, and I rediscovered it again writing this guard.
  const at = text.indexOf('const getProofTimeline');
  const timeline = text.slice(at, text.indexOf('\n\nconst ', at + 1));
  assert.ok(timeline, `${where} no longer has a proof timeline this guard can read`);
  assert.match(timeline, /PAYMENT_PROOF_AUDIT_ACTIONS/,
    `${where} decides for itself which events belong to a proof history`);
  // Its own list, in either shape — a typed array of the action strings, or a second label map.
  assert.doesNotMatch(text, /const paymentProofAuditActions = \[/,
    `${where} types the action list out again`);
  assert.doesNotMatch(text, /const paymentProofAuditLabels = \{/,
    `${where} keeps a second label map, which is where the two lists came from`);
}

console.log(`proofHistoryIsComplete selfcheck OK (${PAYMENT_PROOF_AUDIT_ACTIONS.length} proof actions `
  + `derived from their labels, ${proofScreens.length} screens reading the same list)`);
