// `node src/utils/confirmAction.selfcheck.mjs`
//
// Eighteen destructive actions used to ask through window.confirm. Replacing a synchronous browser
// dialog with an asynchronous one is the kind of change that looks cosmetic and is not: every one of
// these guards a delete or a discard, and the failure mode is silent — a promise that never settles, or
// a truthy Promise object read as "yes".
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { confirmAction, registerConfirmHost } from './confirmAction.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- with no host, it must ASK, not assume ----------------------------------------------------------
// This is the whole safety story. An error boundary, a bare test mount or a route outside the app tree
// leaves no host, and returning true there would delete an order on a single mis-tap.
const calls = [];
globalThis.window = { confirm: (message) => { calls.push(message); return false; } };
assert.equal(await confirmAction('Hapus order ini?'), false, 'with no host it must fall through to window.confirm');
assert.deepEqual(calls, ['Hapus order ini?'], 'and pass the message along');
globalThis.window = { confirm: () => true };
assert.equal(await confirmAction('Hapus order ini?'), true);

// Nowhere to ask at all (prerender) is a no, never a yes.
delete globalThis.window;
assert.equal(await confirmAction('Hapus order ini?'), false, 'no window means refuse, not proceed');

// --- with a host, the host answers ------------------------------------------------------------------
let seen = null;
const unregister = registerConfirmHost((options) => { seen = options; return Promise.resolve(true); });
assert.equal(await confirmAction({ message: 'Hapus voucher?', destructive: true }), true);
assert.deepEqual(seen, { message: 'Hapus voucher?', destructive: true });
assert.equal(await confirmAction('sebagai string'), true, 'a bare string is a message');
assert.equal(seen.message, 'sebagai string');

// Unregistering restores the floor rather than leaving a dead host.
unregister();
globalThis.window = { confirm: () => false };
assert.equal(await confirmAction('Hapus?'), false, 'after the host goes away it must ask the browser again');

// An older unregister must not unhook a newer host.
const stale = registerConfirmHost(() => Promise.resolve(false));
const fresh = registerConfirmHost(() => Promise.resolve(true));
stale();
assert.equal(await confirmAction('Hapus?'), true, 'a stale unsubscribe must not silence the live host');
fresh();
delete globalThis.window;

// --- the host settles every promise it takes ---------------------------------------------------------
const host = read('components', 'ConfirmHost.jsx');
assert.match(host, /current\?\.resolve\(false\)[\s\S]{0,200}return \{ options, resolve \}/,
  'a second question while one is open must settle the first, or its caller waits forever');
assert.match(host, /useEffect\(\(\) => \(\) => setRequest\(\(current\) => \{ current\?\.resolve\(false\)/,
  'unmounting with a question on screen must answer it');
assert.match(host, /onOpenChange=\{\(next\) => \{ if \(!next\) settle\(false\); \}\}/,
  'escape and clicking away are a no');
assert.match(read('..', 'src', 'App.jsx'), /<ConfirmHost \/>/, 'the host has to be mounted');
assert.equal((read('..', 'src', 'App.jsx').match(/<ConfirmHost \/>/g) || []).length, 1,
  'exactly one host — two would race for the same registration');

// --- nothing asks the browser directly any more -------------------------------------------------------
// Every remaining mention must live in confirmAction.js, which is the deliberate floor.
const sourceFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(join(dir, entry.name));
    else if (/\.(jsx?|mjs)$/.test(entry.name)) sourceFiles.push(join(dir, entry.name));
  }
};
walk(src);

// Comments are stripped first: a guard that explains what it replaced would otherwise report itself,
// which is exactly how orderWrites.selfcheck once tripped over the word `updateOrderStatus`.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const offenders = sourceFiles
  .filter((file) => !/confirmAction\./.test(file))
  .filter((file) => /window\.confirm/.test(stripComments(readFileSync(file, 'utf8'))))
  .map((file) => file.slice(src.length + 1));
assert.deepEqual(offenders, [],
  `these still open a browser dialog instead of the app's own: ${offenders.join(', ')}`);
assert.ok(sourceFiles.length > 200, 'the sweep must actually have walked the tree');

// Every site that asks must await the answer. Without the await the value is a Promise, which is truthy,
// which means `if (!confirmed) return;` never returns and the delete always happens.
const unawaited = sourceFiles
  .filter((file) => !/confirmAction\.(js|selfcheck\.mjs)$/.test(file) && !/ConfirmHost/.test(file))
  .map((file) => [file.slice(src.length + 1), stripComments(readFileSync(file, 'utf8'))])
  .filter(([, source]) => /(?<!await |\|\| )confirmAction\(/.test(source.replace(/^import .*$/gm, '')))
  .map(([name]) => name);
assert.deepEqual(unawaited, [],
  `confirmAction called without await — a Promise is truthy, so the guard never stops anything: ${unawaited.join(', ')}`);

// --- every destructive action actually ASKS ------------------------------------------------------------
// The checks above prove the dialog works and that nobody bypasses it. None of them notice a delete that
// simply never asks at all, and six did not:
//
//   - the phone's voucher screen deleted a voucher on one tap; its desktop twin asks, in those words
//   - the desktop's product-category screen deleted a category silently; its PHONE twin asks
//   - both site-image screens dropped an image and its file with no question
//   - the phone's bespoke settings deleted a form option from a row's trash icon
//
// Twice the two surfaces disagreed, in opposite directions, which is what this codebase keeps producing:
// a rule taught to one of a pair.
//
// The rule is not "every handler calls confirmAction" — that would be wrong in both directions. Asking
// can happen one level down (useOrders().deleteOne asks inside the hook, and OrdersPage rightly does
// not repeat it) or in a dialog component wired through onConfirm. So the chain is followed: a handler
// is satisfied if it asks, if what it calls asks, or if it is only reachable through a confirm dialog.
const DESTRUCTIVE = /\bawait\s+((?:delete|remove|purge|wipe)[A-Z]\w*)\(/g;
const uiFiles = sourceFiles.filter((file) => /\/(pages|components)\//.test(file) && file.endsWith('.jsx'));
assert.ok(uiFiles.length > 60, `expected the screens, found ${uiFiles.length} — the scan is broken`);

// Functions that ask, anywhere in the tree: name -> true. Read from every module, not just the screens,
// because the asking usually lives in the hook or service the screen calls.
const asks = new Set();
for (const file of sourceFiles) {
  const text = stripComments(readFileSync(file, 'utf8'));
  for (const match of text.matchAll(/(?:export const|const)\s+(\w+)\s*[:=]\s*(?:async\s*)?\(/g)) {
    const start = text.indexOf('{', match.index);
    if (start === -1) continue;
    let depth = 1;
    let index = start + 1;
    while (index < text.length && depth) {
      if (text[index] === '{') depth += 1;
      else if (text[index] === '}') depth -= 1;
      index += 1;
    }
    if (/confirmAction\(/.test(text.slice(start, index))) asks.add(match[1]);
  }
  for (const match of text.matchAll(/(\w+): async \([^)]*\) => \{/g)) {
    const start = match.index + match[0].length - 1;
    let depth = 1;
    let index = start + 1;
    while (index < text.length && depth) {
      if (text[index] === '{') depth += 1;
      else if (text[index] === '}') depth -= 1;
      index += 1;
    }
    if (/confirmAction\(/.test(text.slice(start, index))) asks.add(match[1]);
  }
}
assert.ok(asks.has('deleteOne'),
  'useOrders().deleteOne is the clearest example of asking one level down; if it is no longer found, '
  + 'this scan cannot tell a guarded delete from a silent one and would report every screen');

const silent = [];
for (const file of uiFiles) {
  const text = stripComments(readFileSync(file, 'utf8'));
  for (const match of text.matchAll(/const (\w+) = (?:async )?\([^)]*\) => \{/g)) {
    const start = match.index + match[0].length - 1;
    let depth = 1;
    let index = start + 1;
    while (index < text.length && depth) {
      if (text[index] === '{') depth += 1;
      else if (text[index] === '}') depth -= 1;
      index += 1;
    }
    const body = text.slice(start, index);
    const handler = match[1];
    // A capitalised name is the COMPONENT, whose body contains the handler we are already checking.
    // Reporting both said MobileDashboardPage() deletes without asking, which is true of no line in it.
    if (/^[A-Z]/.test(handler)) continue;
    const destructive = [...body.matchAll(DESTRUCTIVE)].map((found) => found[1]);
    if (!destructive.length) continue;
    if (/confirmAction\(/.test(body)) continue;
    if (destructive.every((callee) => asks.has(callee))) continue;
    // Reached only through a confirmation dialog: the dialog IS the question.
    if (new RegExp(`onConfirm=\\{${handler}\\}`).test(text)) continue;
    // Or this component IS the dialog — DeleteFormulaModal's whole body is the asking.
    if (/Delete\w*Modal|Confirm\w*(?:Dialog|Modal)/.test(file)) continue;
    silent.push(`${file.slice(src.length + 1)} — ${handler}() calls ${destructive.join(', ')}`);
  }
}

// ManualReferenceMatchModal's Remove unlinks a reference profile from inside the very dialog that can
// re-link it with two clicks. That is an undo away, not a deletion, and putting a confirm on it would be
// friction on the modal's own core action. Named here rather than pattern-matched away, so the exception
// is a decision on the record and not a hole.
const ALLOWED = ['components/ManualReferenceMatchModal.jsx — handleRemove() calls removePrimaryReferenceProfile'];
assert.deepEqual(silent.filter((entry) => !ALLOWED.includes(entry)), [],
  'a screen destroys something without asking first. Nothing in this file notices that on its own: the '
  + 'dialog works perfectly, it is simply never opened:\n  ' + silent.join('\n  '));

console.log(`confirmAction selfcheck OK (no host means ask the browser, never assume yes; ${asks.size} `
  + `functions ask, and no screen deletes without one of them)`);
