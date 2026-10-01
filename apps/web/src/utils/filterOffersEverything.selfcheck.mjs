// `node src/utils/filterOffersEverything.selfcheck.mjs`
//
// A filter built from the rows you already loaded can never ask about the rows you did not.
//
// The Studio audit panel loads the newest 200 entries and derived BOTH its dropdowns from them.
// Measured 2026-10-02 against the live log:
//
//   558 rows in the database, 200 loaded, 8 rendered
//   event filter offered 5 of the 7 event types — order_status_updated and payment_proof_uploaded
//     could not be selected at all, though the log holds 10 and 11 rows of them
//   admin filter offered 2 of the 4 actors
//   358 rows, everything before 2 August, invisible with nothing on screen saying so
//
// The event types have a canonical list — the CHECK constraint, reachable as ORDER_AUDIT_LABELS — so that
// filter can be complete for free. The admins exist only in the rows, so that one stays a sample and the
// panel says what it is looking at instead.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
const page = strip(readFileSync(join(src, 'pages', 'DashboardPage.jsx'), 'utf8'));

// --- 1. The event dropdown is the vocabulary, run rather than read -------------------------------------
const workflow = readFileSync(join(src, 'utils', 'orderWorkflow.js'), 'utf8')
  .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const { ORDER_AUDIT_LABELS } = await import(
  `data:text/javascript;base64,${Buffer.from(workflow, 'utf8').toString('base64')}`
);
const vocabulary = Object.keys(ORDER_AUDIT_LABELS);
assert.ok(vocabulary.length >= 10, `expected the full audit vocabulary; found ${vocabulary.length}`);

const events = /const auditEvents = useMemo\(([\s\S]*?)\);/.exec(page);
assert.ok(events, 'DashboardPage must still build the event dropdown');
assert.match(events[1], /ORDER_AUDIT_LABELS/,
  'the event dropdown must come from the canonical vocabulary. Built from orderAuditLogs it offers only '
  + 'the types that happened to fall inside the loaded window — five of seven, measured on the live log');
assert.doesNotMatch(events[1], /orderAuditLogs/,
  'and it must not depend on the loaded rows at all, or the dropdown shrinks as the window moves');

// --- 2. What cannot be made complete must be made VISIBLE ---------------------------------------------
//
// The admin dropdown can only come from the rows. That is allowed — but then the panel has to say what it
// is looking at, or eight rows out of 558 read as the whole history.
const admins = /const auditAdmins = useMemo\(([\s\S]*?)\), \[orderAuditLogs\]\);/.exec(page);
assert.ok(admins, 'DashboardPage must still build the admin dropdown');
assert.match(admins[1], /orderAuditLogs/, 'the admin list has no canonical source and comes from the rows');
assert.match(page, /ORDER_AUDIT_LOG_PAGE_SIZE/,
  'the panel must name the size of the window it loaded, not leave the other rows silent');
assert.match(page, /entri terakhir yang dimuat/,
  'and say so in words the owner reads, beside the feed');

// The rendered-row count is printed in that sentence, so it may exist exactly once.
const shown = [...page.matchAll(/AUDIT_ROWS_SHOWN/g)];
assert.ok(shown.length >= 3,
  `AUDIT_ROWS_SHOWN should be declared, used to slice, and printed; found ${shown.length} mentions`);
assert.doesNotMatch(page, /filteredAuditLogs\.slice\(0, \d+\)/,
  'the number of rows rendered must not be typed next to a sentence that reports it — two spellings and '
  + 'the sentence becomes a lie');

// --- 3. The window size has ONE spelling, and the service owns it -------------------------------------
const service = strip(readFileSync(join(src, 'services', 'orderService.js'), 'utf8'));
assert.match(service, /export const ORDER_AUDIT_LOG_PAGE_SIZE = \d+;/,
  'the page size belongs to the service that applies it, so the screen can say it without guessing');
assert.match(service, /\{ limit = ORDER_AUDIT_LOG_PAGE_SIZE \} = \{\}/,
  'and the fetcher must default to that constant rather than repeating the number');
const typedTwice = [...service.matchAll(/limit\s*=\s*200/g)];
assert.deepEqual(typedTwice, [],
  'the window size is typed as a literal 200 somewhere in orderService as well as in its constant');

console.log(`filterOffersEverything selfcheck OK (${vocabulary.length} event types always offerable, `
  + 'the window says its own size)');
