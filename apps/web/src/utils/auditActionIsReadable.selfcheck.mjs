// `node src/utils/auditActionIsReadable.selfcheck.mjs`
//
// An order's history is only worth keeping if it can be read.
//
// Three screens render `log.action`, and the words came from THREE different maps:
//
//   orderWorkflow.js   PAYMENT_PROOF_AUDIT_LABELS   4 proof actions
//   OrderDetailPage    auditActionLabels            all 10, in Indonesian — a module-local const
//   DashboardPage      auditActionLabels            9 of them, in English
//
// The phone's order detail could reach only the first, because the complete map was a const inside a
// desktop page. Measured 2026-10-02 against the live audit log: 535 of 558 rows (96%) rendered there as
// raw keys — 217 `payment_status_updated`, 198 `order_cancelled`, 63 `order_deleted`, 47
// `shipment_updated`, 10 `order_status_updated`. The phone is the surface this shop is run from.
//
// DashboardPage's map was also missing `bespoke_production_updated` entirely, so the first use of the
// bespoke workflow control would print the key. Zero rows carry it today — every bespoke order is still at
// review_brief — which is why nobody has seen it.
//
// Both halves derived, and neither from a list in this file: the actions come from the database's own CHECK
// constraint, lifted from the newest migration that defines it, and the renderers are found on disk.
// Dekito's English wording on the dashboard is his and is not touched; the rule here is only that every
// action has words, wherever it is shown.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx?$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');

// --- 1. Every action the DATABASE allows --------------------------------------------------------------
//
// The authority is not a sweep of the code: it is the CHECK constraint on storefront_order_audit_logs.
// An action it forbids never becomes a row at all — the migration that added the bespoke one says so:
// "without this the insert fails the action CHECK and the audit log silently falls back to localStorage".
//
// LIFTED FROM THE NEWEST MIGRATION THAT DEFINES IT, because it is redefined three times and a redefinition
// silently replaces the whole list. Reading the wrong file would have given nine actions, or five.
//
// Two sweeps of the JS came before this and both had holes a sabotage walked through: a list of past-tense
// suffixes missed `order_refunded`, and matching on context missed the ternary that writes
// order_status_updated while dragging in `sync_required` from a different record's action field.
const migrations = join(src, '..', '..', '..', 'supabase', 'migrations');
const defining = readdirSync(migrations)
  .filter((name) => name.endsWith('.sql'))
  .filter((name) => /storefront_order_audit_logs_action_check|action text not null check/
    .test(readFileSync(join(migrations, name), 'utf8')))
  .sort();
assert.ok(defining.length >= 1, 'no migration defines the audit action CHECK any more');
const newest = readFileSync(join(migrations, defining[defining.length - 1]), 'utf8');
const list = /action in \(([\s\S]*?)\)/.exec(newest);
assert.ok(list, `${defining.at(-1)} defines the constraint but this guard cannot read its list`);
const actions = [...list[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort();
console.log(`  actions the database allows (${actions.length}, from ${defining.at(-1)}): ${actions.join(', ')}`);
assert.ok(actions.length >= 10,
  `expected the full action vocabulary; found ${actions.length} in ${defining.at(-1)}. A redefinition that `
  + 'drops actions silently stops them being recorded at all.');

// And nothing in the code writes an action the database would refuse. The live log's seven distinct
// actions (measured 2026-10-02) are all in the list above, which is the other half of the same check.
const writes = new Set();
const sweep = (root, pattern) => {
  const found = [];
  const walkAny = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { walkAny(rel); continue; }
      if (pattern.test(entry.name) && !/selfcheck/.test(entry.name)) found.push(rel);
    }
  };
  walkAny('');
  for (const rel of found) {
    const text = strip(readFileSync(join(root, rel), 'utf8'));
    for (const line of text.split('\n')) {
      if (!/\bauditAction\b|action:\s*'/.test(line)) continue;
      for (const match of line.matchAll(/'([a-z]+(?:_[a-z]+)+)'/g)) writes.add(`${rel}: ${match[1]}`);
    }
  }
};
sweep(src, /\.jsx?$/);
sweep(join(src, '..', 'api'), /\.js$/);
// A different record's action field is not an order audit action: the sync-issue queue writes its own.
const SYNC_ISSUE_ACTIONS = ['payment_blocked_until_sync', 'sync_failed', 'sync_required'];
const refused = [...writes]
  .filter((entry) => !SYNC_ISSUE_ACTIONS.some((action) => entry.endsWith(action)))
  .filter((entry) => !actions.includes(entry.split(': ')[1]));
assert.deepEqual(refused, [],
  'these are written as an order audit action but the CHECK constraint forbids them, so the row is never '
  + 'recorded at all — it falls back to localStorage and is lost:\n  ' + refused.join('\n  '));

// --- 2. Every screen that renders one, and the map it reads from --------------------------------------
const renderers = files.filter((rel) => /\[log\.action\]|\[event\]/.test(strip(readFileSync(join(src, rel), 'utf8'))));
console.log(`  screens rendering an action: ${renderers.join(', ')}`);
assert.ok(renderers.length >= 3,
  `expected the three screens that print an audit action; found ${renderers.length}: ${renderers.join(', ')}`);

// Lifted, not imported: orderWorkflow reaches into services for other reasons, and Node cannot resolve
// the '@/' alias. The three maps are pure objects, so running them needs no collaborators at all.
const workflowSource = readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const { ORDER_AUDIT_LABELS, PAYMENT_PROOF_AUDIT_LABELS, PAYMENT_PROOF_AUDIT_ACTIONS } = await import(
  `data:text/javascript;base64,${Buffer.from(workflowSource, 'utf8').toString('base64')}`
);

const unreadable = [];
for (const rel of renderers) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  // Which map this screen resolves through: the shared one, or a local const of its own.
  const usesShared = /ORDER_AUDIT_LABELS\[/.test(source);
  const localMap = /const auditActionLabels = \{([\s\S]*?)\};/.exec(source);
  const known = usesShared
    ? new Set(Object.keys(ORDER_AUDIT_LABELS))
    : new Set([...(localMap?.[1] || '').matchAll(/^\s*(\w+):/gm)].map((m) => m[1]));
  assert.ok(known.size >= 4, `${rel} renders an audit action but no label map could be found for it`);
  for (const action of actions) {
    if (!known.has(action)) unreadable.push(`${rel}: ${action}`);
  }
}
assert.deepEqual(unreadable, [],
  'these screens print a raw snake_case key instead of words, for an action the code actually writes:\n  '
  + unreadable.join('\n  '));

// --- 3. The proof filter is still exactly the proof actions -------------------------------------------
// ORDER_AUDIT_LABELS is the union. If it were built the other way round — the proof map spread out of the
// big one — PAYMENT_PROOF_AUDIT_ACTIONS would quietly become "every action", and the proof history panel
// would fill with cancellations.
assert.deepEqual(PAYMENT_PROOF_AUDIT_ACTIONS, Object.keys(PAYMENT_PROOF_AUDIT_LABELS),
  'the proof-action filter must stay the proof map, not the union');
assert.ok(PAYMENT_PROOF_AUDIT_ACTIONS.every((action) => action.startsWith('payment_proof_')),
  `the proof filter picked up something that is not a proof action: ${PAYMENT_PROOF_AUDIT_ACTIONS.join(', ')}`);
assert.ok(Object.keys(ORDER_AUDIT_LABELS).length > PAYMENT_PROOF_AUDIT_ACTIONS.length,
  'the union must be wider than the proof map, or the phone is back to four labelled actions');
for (const [action, words] of Object.entries(ORDER_AUDIT_LABELS)) {
  assert.ok(words && words !== action && !/_/.test(words),
    `${action} is "labelled" with something that is still a key, not words: ${words}`);
}

// --- 4. Both directions, which is also the floor under the sweep --------------------------------------
//
// Every assertion above is about what was NOT found, so narrowing the sweep would be green: pointing it at
// one service still left the SQL half finding enough actions to clear a `>= 7` floor. The real floor is
// that the two sets MATCH — a label whose action nobody writes is dead vocabulary, and an action nobody
// labels is a raw key on a screen. Neither can hide behind a smaller sweep.
const labelled = Object.keys(ORDER_AUDIT_LABELS).sort();
const unwritten = labelled.filter((action) => !actions.includes(action));
const unlabelled = actions.filter((action) => !labelled.includes(action));
assert.deepEqual(unlabelled, [],
  'the code writes these actions and the shared map has no words for them:\n  ' + unlabelled.join('\n  '));
assert.deepEqual(unwritten, [],
  'these labels have no writer anywhere in src, api or the migrations — either the action was renamed and '
  + 'the label left behind, or this sweep can no longer see where it is written:\n  ' + unwritten.join('\n  '));

console.log(`auditActionIsReadable selfcheck OK (${actions.length} actions, ${renderers.length} screens, every one in words)`);
