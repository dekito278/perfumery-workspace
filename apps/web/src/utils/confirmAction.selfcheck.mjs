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

console.log('confirmAction selfcheck OK (no host means ask the browser, never assume yes)');
