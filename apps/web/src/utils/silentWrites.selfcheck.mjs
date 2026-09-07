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
const servicesDir = join(here, '..', 'services');

// Every entry is a function that writes without observing rows ON PURPOSE. The reason must say why a
// refusal cannot pass as success there — "it seemed fine" is not a reason. Verified 2026-09-08 against
// the policies in supabase/migrations.
const ALLOWED = {
  // Deleting an already-absent row is the legitimate outcome, not a refusal: the promo is off either way.
  'shippingPromotionService.js:resetShippingPromotionSettings': 'reset semantics — zero rows is success',
  // Delete-then-insert on an is_admin() table. INSERT refusals ARE errors in PostgREST (42501), so a
  // session that cannot write fails loudly on the insert one line later.
  'bespokeSettingsService.js:resetBespokeSettings': 'the following insert throws on the same refusal',
  // The tables below are RLS'd on auth.uid() = user_id, not is_admin(). That holds for any signed-in
  // session at any assurance level, so a refusal would mean deleting a row belonging to someone else —
  // which cannot arise from a list the user is rendering from their own rows.
  'formulasSupabaseService.js:deleteFormula': 'user-scoped RLS (auth.uid() = user_id)',
  'journalPostsSupabaseService.js:deleteJournalPost': 'user-scoped RLS (auth.uid() = user_id)',
  'validationLogsSupabaseService.js:deleteValidationLog': 'user-scoped RLS (auth.uid() = user_id)',
  'rawMaterialsService.js:deleteRawMaterial': 'user-scoped RLS (auth.uid() = user_id)',
  'rawMaterialCategoriesService.js:deleteRawMaterialCategory': 'user-scoped RLS (auth.uid() = user_id)',
  'materialReferenceService.js:updateManualReferenceMetadataForRawMaterial': 'user-scoped RLS (auth.uid() = user_id)',
  'materialReferenceService.js:removePrimaryReferenceProfile': 'user-scoped RLS (auth.uid() = user_id)',
  'materialReferenceService.js:removeReferenceArtifactsForRawMaterial': 'user-scoped RLS (auth.uid() = user_id)',
};

// Comments are stripped before scanning. Every one of these writes carries a comment explaining the
// rule, and those comments say ".select()" — so a substring scan of the raw source finds the word in the
// prose and passes even when the call itself is gone. This guard was blind on its first run for exactly
// that reason.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

const offenders = [];
const seen = new Set();

for (const file of readdirSync(servicesDir).filter((name) => name.endsWith('.js'))) {
  const source = stripComments(readFileSync(join(servicesDir, file), 'utf8'));
  if (!source.includes('supabase')) continue;

  // Split on top-level const declarations: close enough to function boundaries for this, and it keeps the
  // `const query = ...update(); await query.select().single()` shape from reading as a violation.
  const starts = [...source.matchAll(/^(?:export )?const (\w+) = (?:async )?\(/gm)];
  for (let i = 0; i < starts.length; i += 1) {
    const body = source.slice(starts[i].index, starts[i + 1]?.index ?? source.length);
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
  'voucherService.js': ['deleteVoucher', 'applyVoucherToSubtotal'],
  'productStoryService.js': ['deleteStory', 'uploadStoryMedia'],
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
    /if \(![a-zA-Z]+\?\.length\)[\s\S]{0,400}throw new Error/,
    `${file}: ${fn} does not throw when zero rows changed — a refused write would still report success`,
  );
}

console.log(`silentWrites selfcheck OK (${seen.size} deliberate exceptions, 0 offenders)`);
