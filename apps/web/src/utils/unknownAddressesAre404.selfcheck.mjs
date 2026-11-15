// `node src/utils/unknownAddressesAre404.selfcheck.mjs`
//
// Until 15 Nov 2026 vercel.json sent every address it had no file for to the app shell with status 200, so
// /halaman-tidak-ada was "a page" to a crawler or a link checker (the app's noindex aside). The two shell
// rewrites now name the app's real route prefixes; anything else falls through to Vercel's 404, which
// serves dist/404.html — the same shell, so the app still boots and shows its "nyasar" page — with 404.
//
// The danger is the other direction: a new route whose first segment is not in the list. It would still
// render (404.html is the app), but answer 404 — a real page Google would drop. So the list is checked
// against App.jsx here, both shops.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const app = readFileSync(join(web, 'src', 'App.jsx'), 'utf8');
const vercel = JSON.parse(readFileSync(join(web, 'vercel.json'), 'utf8'));
const rewrites = vercel.rewrites || [];

assert.ok(!rewrites.some((rule) => rule.source === '/(.*)' || rule.source === '/en/:path*'), 'a catch-all answers every unknown address with 200 again');
const prefixesOf = (rule) => (rule?.source.match(/:first\(([^)]+)\)\/:rest\*$/) || [])[1]?.split('|') || [];
const idRule = rewrites.find((rule) => rule.destination === '/index.html');
const enRule = rewrites.find((rule) => rule.destination === '/en/app.html');
assert.match(idRule?.source || '', /^\/:first\([^)]+\)\/:rest\*$/);
assert.match(enRule?.source || '', /^\/en\/:first\([^)]+\)\/:rest\*$/);

const segments = [...new Set([...app.matchAll(/path="(\/[^"]*)"/g)].map((m) => m[1].split('/')[1]).filter((seg) => seg && !seg.startsWith(':')))];
assert.ok(segments.length > 20, `only ${segments.length} route prefixes found in App.jsx — the scan is broken`);
for (const [name, rule] of [['Indonesian', idRule], ['English', enRule]]) {
  const missing = segments.filter((seg) => !prefixesOf(rule).includes(seg));
  assert.deepEqual(missing, [], `${name} shell rewrite misses route prefixes, so those real pages would answer 404: ${missing.join(', ')}`);
}

const build = readFileSync(join(web, 'tools', 'build.mjs'), 'utf8');
assert.match(build, /fs\.writeFileSync\(path\.join\(distRoot, '404\.html'\), notFound\);/, 'the build writes the 404 page');
const built = join(web, 'dist', '404.html');
if (existsSync(built)) {
  const html = readFileSync(built, 'utf8');
  assert.match(html, /<meta name="robots" content="noindex"/, 'the 404 page asks not to be indexed');
  assert.doesNotMatch(html, /rel="canonical"/, 'and claims no canonical');
  assert.match(html, /<script type="module"[^>]*src="\/assets\//, 'and boots the app, so the visitor still sees the shop');
}
console.log(`unknownAddressesAre404 selfcheck OK (${segments.length} route prefixes in both shells; everything else is a real 404)`);
