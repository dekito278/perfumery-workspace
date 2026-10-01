// `node src/utils/columnShedIsChecked.selfcheck.mjs`
//
// A write may drop a column and retry ONLY when it has established that the column is missing.
//
// Three places did this, for three migrations that are applied by hand. One checked properly:
//
//   isMissingLineageColumn — error.code === '42703' || /schema cache/i, AND the column name
//
// The other two tested only whether the error MESSAGE happened to contain the column name:
//
//   String(error.message).includes('doku_response')        -> orderService, twice
//   /usage_limit_per_account/.test(String(error.message))  -> voucherService
//
// So any error that merely NAMED one of those columns — a constraint, a bad jsonb value, a value too
// long — dropped the field and reported the write as successful. The gateway's own record of a payment,
// or the per-account limit Dekito had just typed into Studio, gone with a green toast. The voucher one's
// comment even said it worked "exactly as the formula lineage write does"; it did not, it had dropped the
// one check that makes that shape safe (#371).
//
// Measured 2026-10-02, service-role read: doku_response (33/33 rows non-null), payment_url,
// payment_expires_at, payment_session_id, payment_response, usage_limit_per_account, parent_formula_id
// and revision_note ALL exist in production. Every one of these retries was dead; two of them were dead
// code that read like a safeguard while being a data-loss path.
//
// The survivor is kept rather than deleted: it cannot misfire, and it is the one correct spelling of the
// rule. This chain is what stops a fourth copy appearing without its check.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(webRoot, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx?$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('src');
walk('api');

// Established that the column is absent, as opposed to having read its name in a sentence. 42703 is
// Postgres's undefined_column; PostgREST answers an unknown relation with its schema-cache wording.
const CHECKS_THE_ERROR = /42703|PGRST20[45]|schema cache|undefined_column/i;

// THE SUBJECT IS A MESSAGE TEST THAT LICENSES A DROP, and it took two wrong detectors to land on that.
//
// Looking only for error messages tested against snake_case names flagged three constraint checks
// (`error.code === '23505'` plus a *_unique_*_per_user name) which drop nothing and only choose which
// message to show — a different question entirely. Looking only for the drop missed the real one, because
// isMissingLineageColumn matches its column names through a variable and the drop itself lives in a pure
// helper, with the error check 30 lines away at the call site.
//
// So both halves have to be present: a message tested against a column-shaped literal, in a function that
// then writes something SMALLER than it was asked to.
const MESSAGE_TESTS = [
  /(?:error|candidate|err)\??\.?(?:message)?[^\n]{0,40}\.includes\(\s*['"]([a-z]+(?:_[a-z]+)+)['"]\s*\)/g,
  /\/([a-z]+(?:_[a-z]+)+)\/[a-z]*\.test\(\s*String\(\s*(?:error|candidate|err)/g,
];
// Writing less than you were asked to: dropping a field, or rebuilding a reduced payload by hand.
const SHEDS = /delete\s+\w+(?:\.\w+|\[[^\]]+\])\s*;|without\w+Fields\(/;

// One spelling of "which files". Written as two — a filter here and a count for the floor below — the
// floor stayed at 42 while a sabotage narrowed this loop to a single file, and the chain passed. The
// defect class this repo keeps finding, in the guard written to catch it.
const swept = files.filter((rel) => /^(src\/services|api)\//.test(rel));

const found = [];
for (const rel of swept) {
  const source = readFileSync(join(webRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  for (const pattern of MESSAGE_TESTS) {
    for (const match of source.matchAll(pattern)) {
      // The branch the test GOVERNS, sliced by counting braces rather than by a character budget. A flat
      // 500-character window bled into the code after the block and read a neighbouring
      // withoutLineageFields() as if this test had licensed it — the 23505 duplicate-code branch, which
      // sheds nothing.
      const open = source.indexOf('{', match.index);
      let branch = '';
      if (open !== -1) {
        let depth = 0;
        for (let i = open; i < source.length; i += 1) {
          if (source[i] === '{') depth += 1;
          else if (source[i] === '}') {
            depth -= 1;
            if (depth === 0) { branch = source.slice(open, i + 1); break; }
          }
        }
      }
      if (!branch || !SHEDS.test(branch)) continue;
      const around = source.slice(Math.max(0, match.index - 300), match.index + 500);
      found.push({ file: rel, column: match[1], checked: CHECKS_THE_ERROR.test(around) });
    }
  }
}

// A floor under the sweep, because every assertion below is about what was NOT found: narrowing the
// sweep to one file would otherwise be green. #370 learned this the same way.
assert.ok(swept.length >= 30,
  `expected to sweep the app's services and endpoints; found ${swept.length} files. The sweep was narrowed, `
  + 'and everything below it is an assertion about an absence.');

// Printed, because a derived guard that cannot name what it found is a guard nobody can check.
console.log(`  swept ${swept.length} service and endpoint files`);
for (const entry of found) {
  console.log(`  ${entry.file}: ${entry.column} ${entry.checked ? '(checks the error code)' : '*** GUESSES ***'}`);
}
if (!found.length) console.log('  no drop is licensed by a message alone');

const guessing = found.filter((entry) => !entry.checked).map((entry) => `${entry.file}: ${entry.column}`);
assert.deepEqual(guessing, [],
  'these drop a column from a write because the error message happened to MENTION it, which turns any '
  + 'other failure naming that column into silent data loss reported as success. Check error.code for '
  + '42703, the way isMissingLineageColumn does:\n  ' + guessing.join('\n  '));

// Zero is the expectation here, not one: the safe spelling matches its columns through a variable and is
// therefore invisible to the detector above. So it is asserted directly — it is the one correct shape of
// this rule, and the two unsafe copies were written by someone reading it and recalling it imperfectly.
const formulas = readFileSync(join(webRoot, 'src/services/formulasSupabaseService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');
const lineage = formulas.slice(formulas.indexOf('const isMissingLineageColumn'), formulas.indexOf('const withoutLineageFields'));
assert.ok(lineage.length > 80, 'isMissingLineageColumn is gone — update this chain, not the rule');
assert.match(lineage, CHECKS_THE_ERROR,
  'the one retry that may shed a column must ESTABLISH the column is missing, by error code, not by '
  + 'reading its name in a sentence');

// And the two paths that were fixed must stay fixed, by their effect rather than their wording: the
// payment write hands its patch straight to updateOrderRow, with nothing between them to shed a column.
const orders = readFileSync(join(webRoot, 'src/services/orderService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');
assert.doesNotMatch(orders, /delete\s+\w+\.doku_response/,
  '"tandai lunas" must not drop the gateway response and report success — a failure there has to reach the owner');
assert.doesNotMatch(orders, /payment_session_id['"]\]\)/,
  'nor fall back to a four-field patch that silently discards the payment URL and its expiry');

console.log('columnShedIsChecked selfcheck OK (no write sheds a column on the strength of a message; '
  + 'the one that may sheds it on the error code)');
