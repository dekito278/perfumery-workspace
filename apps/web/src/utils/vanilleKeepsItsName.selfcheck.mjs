// `node src/utils/vanilleKeepsItsName.selfcheck.mjs`
//
// Dekito's brief, 14 Nov 2026 (P1-5): J'adore la Vanille lived at soli-extended-j-adore-la-vanille — a leftover
// of how the row was first made — while every link a person types or shares says j-adore-la-vanille. The
// slug moves (supabase/manual/20261115100000_names_and_vanille_slug.sql) and the old address answers with a
// PERMANENT redirect in both shops, before any rewrite, so shared links and search results keep working.
// The same SQL writes the French series in Dekito's spelling: La rose, La tulipe, J'adore la Vetiver.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vercel = JSON.parse(readFileSync(join(webRoot, 'vercel.json'), 'utf8'));
const old = 'soli-extended-j-adore-la-vanille';
for (const prefix of ['', '/en']) {
  const rule = (vercel.redirects || []).find((r) => r.source === `${prefix}/catalog/${old}`);
  assert.ok(rule, `${prefix}/catalog/${old} has no redirect — every shared link to J'adore la Vanille would 404 after the slug moves`);
  assert.equal(rule.destination, `${prefix}/catalog/j-adore-la-vanille`);
  assert.equal(rule.permanent, true, 'a 301, so search engines move the page rather than drop it');
}

const sql = readFileSync(join(webRoot, '..', '..', 'supabase', 'manual', '20261115100000_names_and_vanille_slug.sql'), 'utf8');
assert.match(sql, /set slug = 'j-adore-la-vanille'\s*where slug = 'soli-extended-j-adore-la-vanille'/);
assert.match(sql, /related_slugs \? 'soli-extended-j-adore-la-vanille'/, 'other perfumes still point at the old slug');
for (const name of ['La rose', 'La tulipe', 'J’adore la Vetiver']) {
  assert.ok(sql.includes(`set name = '${name}'`), `${name} is not written in Dekito's spelling`);
  assert.ok(sql.includes(`to_jsonb('${name}'::text)`), `the free vial still lists ${name} under its old spelling — "already bought" matches by name`);
}

console.log('vanilleKeepsItsName selfcheck OK (old Vanille address 301s in both shops; the French series in Dekito\'s spelling)');
