// Guard against the failure mode that has now been found in five separate services.
// `node src/utils/silentWrites.selfcheck.mjs`
//
// An RLS refusal on UPDATE or DELETE is not an error. PostgREST answers 200 with zero rows and
// error === null, so `const { error } = await supabase.from(t).delete()...` runs its success path with
// nothing changed. The studio then clears its cache, shows a success toast, and the row lives on.
//
// This scans the SOURCE of every service, because these files import the supabase client and cannot be
// loaded outside a browser build. The rule: a function that writes must, somewhere, ask which rows it
// touched — .select(), .single(), or .maybeSingle().
//
// Unlike the per-function guards it replaces, this one catches the NEXT service to get it wrong.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const servicesDir = join(src, 'services');

// The subject used to be "every file in services/", while the header above promised to catch the NEXT
// place to get this wrong. Those are not the same set: a write that lands in a hook, a context or a
// component is a write this guard could not see. So the subject is now derived from what actually
// matters — a module that holds the supabase client — wherever it lives.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
));

// Every entry is a function that writes without observing rows ON PURPOSE. The reason must say why a
// refusal cannot pass as success there — "it seemed fine" is not a reason. Verified 2026-09-08 against
// the policies in supabase/migrations.
const ALLOWED = {
  // Deleting an already-absent row is the legitimate outcome, not a refusal: the promo is off either way.
  'services/shippingPromotionService.js:resetShippingPromotionSettings': 'reset semantics — zero rows is success',
  // Delete-then-insert on an is_admin() table. INSERT refusals ARE errors in PostgREST (42501), so a
  // session that cannot write fails loudly on the insert one line later.
  'services/bespokeSettingsService.js:resetBespokeSettings': 'the following insert throws on the same refusal',
  // The tables below are RLS'd on auth.uid() = user_id, not is_admin(). That holds for any signed-in
  // session at any assurance level, so a refusal would mean deleting a row belonging to someone else —
  // which cannot arise from a list the user is rendering from their own rows.
  'services/formulasSupabaseService.js:deleteFormula': 'user-scoped RLS (auth.uid() = user_id)',
  'services/journalPostsSupabaseService.js:deleteJournalPost': 'user-scoped RLS (auth.uid() = user_id)',
  'services/validationLogsSupabaseService.js:deleteValidationLog': 'user-scoped RLS (auth.uid() = user_id)',
  'services/rawMaterialsService.js:deleteRawMaterial': 'user-scoped RLS (auth.uid() = user_id)',
  'services/rawMaterialCategoriesService.js:deleteRawMaterialCategory': 'user-scoped RLS (auth.uid() = user_id)',
  'services/materialReferenceService.js:updateManualReferenceMetadataForRawMaterial': 'user-scoped RLS (auth.uid() = user_id)',
  'services/materialReferenceService.js:removePrimaryReferenceProfile': 'user-scoped RLS (auth.uid() = user_id)',
  'services/materialReferenceService.js:removeReferenceArtifactsForRawMaterial': 'user-scoped RLS (auth.uid() = user_id)',
};

// Comments are stripped before scanning. Every one of these writes carries a comment explaining the
// rule, and those comments say ".select()" — so a substring scan of the raw source finds the word in the
// prose and passes even when the call itself is gone. This guard was blind on its first run for exactly
// that reason.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

const offenders = [];
const seen = new Set();

const holdsTheClient = walk(src)
  .filter((path) => /\.(js|jsx)$/.test(path) && !path.includes('.selfcheck.'))
  .filter((path) => /from '@\/lib\/supabaseClient\.js'|from '\.\.?\/lib\/supabaseClient\.js'/.test(readFileSync(path, 'utf8')));
// The floor is the OLD subject: every service that talks to supabase must still be in the new set, or
// the widening quietly narrowed instead. (A handful of services reach the database only through other
// services and were never in scope.)
const previousSubject = readdirSync(servicesDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => join(servicesDir, name))
  .filter((path) => readFileSync(path, 'utf8').includes('supabaseClient.js'));
const covered = new Set(holdsTheClient);
const lost = previousSubject.filter((path) => !covered.has(path)).map((path) => path.slice(src.length + 1));
assert.deepEqual(lost, [], `the widened scan lost services it used to check: ${lost.join(', ')}`);
assert.ok(holdsTheClient.length >= previousSubject.length,
  `${holdsTheClient.length} modules hold the client but ${previousSubject.length} services do — impossible`);

for (const path of holdsTheClient) {
  const file = path.slice(src.length + 1);
  const source = stripComments(readFileSync(path, 'utf8'));

  // Split on top-level const declarations: close enough to function boundaries for this, and it keeps the
  // `const query = ...update(); await query.select().single()` shape from reading as a violation.
  const starts = [...source.matchAll(/^(?:export )?const (\w+) = (?:async )?\(/gm)];
  for (let i = 0; i < starts.length; i += 1) {
    const body = source.slice(starts[i].index, starts[i + 1]?.index ?? source.length);
    // `.delete(` alone is not a database write: a Set has that method too, and useStorefrontProducts
    // calls `listeners.delete(setState)` in its cleanup. Widening the scan past services/ surfaced both
    // of those as offenders on the first run. A PostgREST write always names its table first, so the
    // body has to contain a `.from('…')` with a literal table name as well.
    // A table name may be a literal or a constant (SHIPPING_PROMOTION_TABLE), but never a call — which
    // is what rules `Array.from(...)` out while keeping every real write in.
    if (!/\.from\(\s*(?:'[^']+'|[A-Z][A-Z0-9_]*)\s*\)/.test(body)) continue;
    if (!/\.(update|delete)\(/.test(body)) continue;
    if (/\.(select|single|maybeSingle)\(/.test(body)) continue;
    const key = `${file}:${starts[i][1]}`;
    seen.add(key);
    if (!ALLOWED[key]) offenders.push(key);
  }
}

assert.deepEqual(
  offenders,
  [],
  `these functions write to the database without ever asking which rows changed, so an RLS refusal reads as success:\n  ${offenders.join('\n  ')}\n`
  + 'Add .select() and throw on zero rows, or add the function to ALLOWED with a reason why a refusal cannot pass as success there.',
);

// A stale exception is its own bug: it keeps a real offender invisible if the function is ever renamed.
const stale = Object.keys(ALLOWED).filter((key) => !seen.has(key));
assert.deepEqual(stale, [], `ALLOWED lists functions that no longer write silently — delete these entries:\n  ${stale.join('\n  ')}`);

// Asking which rows changed and then ignoring the answer is the same bug wearing a .select(). These two
// deletes are the ones where a refusal is silent AND the surviving row keeps acting on customers: a
// voucher that still discounts, a story that still shows on the product page.
const mustThrowOnZeroRows = {
  'voucherService.js': ['deleteVoucher', 'getMyVoucherRedemptions'],
  'productStoryService.js': ['deleteStory', 'uploadStoryMedia'],
  'productCatalogService.js': ['saveProductWear', 'deleteCustomProduct'],
};

for (const [file, [fn, next]] of Object.entries(mustThrowOnZeroRows)) {
  const source = stripComments(readFileSync(join(servicesDir, file), 'utf8'));
  const from = source.indexOf(`export const ${fn}`);
  const to = source.indexOf(`export const ${next}`);
  assert.ok(from !== -1 && to > from, `${file}: could not find ${fn} — update this guard`);
  const body = source.slice(from, to);
  assert.ok(body.includes('.select('), `${file}: ${fn} no longer asks which rows it wrote`);
  assert.match(
    body,
    /if \(![a-zA-Z]+(\?\.length)?\)[\s\S]{0,400}throw new Error/,
    `${file}: ${fn} does not throw when zero rows changed — a refused write would still report success`,
  );
}

console.log(`silentWrites selfcheck OK (${seen.size} deliberate exceptions, 0 offenders)`);
