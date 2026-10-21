// `node src/utils/revokeMustNamePublic.selfcheck.mjs`
//
// A revoke that does not name PUBLIC revokes nothing.
//
// Postgres grants EXECUTE on every newly created function to the PUBLIC role. `revoke execute on
// function f() from anon` removes anon's own grant and leaves PUBLIC's, and anon is a member of PUBLIC —
// so the function is still callable and the migration reads as if it were closed.
//
// This repo has already paid for that lesson twice:
//
//   2026-08-19  Four RPCs audited as "revoked from anon" were still callable, including two `_unchecked`
//               bodies written with no guard at all, which made the whole wrapper pattern decorative.
//               20260819123000_revoke_public_execute_on_guarded_rpcs.sql closed them and left a note:
//               "a `revoke … from anon` alone is never enough."
//   2026-10-22  20261021140000_invoice_numbers.sql shipped `revoke all … from anon` anyway. Measured with
//               the anon key against production, the invoice-number RPC answered P0001 "admin only" —
//               the raise inside its own body — proving anon had reached it.
//
// A note at the bottom of a migration nobody re-reads did not survive two months. This runs instead.
//
// THE SUBJECT IS DERIVED, NOT LISTED: every revoke-on-function in every migration is parsed. The rule is
// that a revoke naming a specific role must be backed by a revoke of the same signature from PUBLIC,
// anywhere in the migration history — the August fix lives in a later file than the holes it closed, so
// pairing them per-file would be wrong.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'supabase', 'migrations');

// SQL comments are stripped first: both of the files above DISCUSS the pattern in prose, and a guard that
// reads its own cautionary tale as a violation is a guard nobody keeps.
const sql = (name) => readFileSync(join(migrations, name), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*--.*$/gm, ' ')
  .replace(/\s+/g, ' ');

const REVOKE = /revoke\s+(?:execute|all)(?:\s+privileges)?\s+on\s+function\s+([^;]*?)\s+from\s+([^;]+);/gi;
const signature = (raw) => raw.toLowerCase().replace(/\s+/g, '').replace(/^public\./, '');

const revokedFromPublic = new Set();
const named = [];

for (const name of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
  for (const [, sig, roles] of sql(name).matchAll(REVOKE)) {
    const who = roles.toLowerCase().split(',').map((r) => r.trim());
    if (who.includes('public')) revokedFromPublic.add(signature(sig));
    if (who.some((r) => r === 'anon' || r === 'authenticated')) {
      named.push({ file: name, sig: signature(sig), roles: who.join(', ') });
    }
  }
}

// --- The guard proves it is looking at something ------------------------------------------------------
// Without this, a regex that silently stops matching — a new SQL dialect quirk, a reformat — turns the
// whole file into a test that always passes. The counts are floors, not fixtures: they may grow.
assert.ok(revokedFromPublic.size >= 5,
  `only ${revokedFromPublic.size} revoke-from-public statements found; the parser has stopped matching`);
assert.ok(named.length >= 5,
  `only ${named.length} role-named revokes found; the parser has stopped matching`);

// --- The rule -----------------------------------------------------------------------------------------
const unfenced = named.filter((r) => !revokedFromPublic.has(r.sig));
assert.deepEqual(unfenced, [],
  `these revoke a function from ${unfenced.map((r) => r.roles).join(' / ')} but never from PUBLIC, so the `
  + `function stays callable by exactly the role they claim to exclude:\n`
  + unfenced.map((r) => `  ${r.file}\n    ${r.sig}`).join('\n')
  + `\nAdd \`revoke execute on function <signature> from public;\` and then grant the roles that need it.`);

console.log(`revokeMustNamePublic selfcheck OK (${named.length} role-named revokes, all backed by a PUBLIC revoke)`);
