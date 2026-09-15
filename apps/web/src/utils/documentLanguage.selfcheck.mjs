// `node src/utils/documentLanguage.selfcheck.mjs`
//
// The document says what language it is in, and that has to stay true when the shop changes language.
//
// index.html ships `lang="id"`. That is correct for the prerendered HTML and correct until a visitor
// picks the English shop — after which every word on screen is English and the document still claims
// Indonesian. It shipped that way and stayed that way through the whole bilingual build.
//
// The cost is not SEO. A screen reader reads an English page with Indonesian phonetics, which is the
// entire page for a blind buyer, and Chrome offers to translate a page already in the reader's language.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hook = readFileSync(join(web, 'src', 'hooks', 'useStorefrontRegion.js'), 'utf8');
const shell = readFileSync(join(web, 'index.html'), 'utf8');

// --- 1. The shell still starts Indonesian -------------------------------------------------------------
// The 18 prerendered product pages are Indonesian until the effect runs. A shell that claimed `en` would
// be lying to every crawler instead of to every English reader.
assert.match(shell, /<html lang="id">/, 'the shell ships Indonesian, which is what the prerendered HTML says');

// --- 2. The attribute is written where the region changes, and only there -------------------------------
// publish() is the single point every region change passes through — the initial resolve and every tap
// of the switch. Writing it from a component instead would leave the attribute out of step with whichever
// component happened to render last.
assert.match(hook, /const publish = \(next\) => \{[\s\S]*?writeDocumentLanguage\(next\);/,
  'publish() writes the language, so the attribute cannot drift from the region being rendered');
assert.match(hook, /document\.documentElement\.lang = region === REGION_EN \? 'en' : 'id'/,
  'and maps the region to a real BCP-47 tag rather than passing the internal key through');

// The prerender runs in Node, where there is no document. Touching it unguarded crashes the build.
const writer = hook.match(/const writeDocumentLanguage = \(region\) => \{([\s\S]*?)\n\};/);
assert.ok(writer, 'writeDocumentLanguage is readable');
assert.match(writer[1], /typeof document === 'undefined'/,
  'guarded for the prerender, which has no document and would crash the build');
assert.ok(writer[1].indexOf("typeof document === 'undefined'") < writer[1].indexOf('documentElement'),
  'the guard comes before the access, or it guards nothing');

// --- 3. Nothing else writes it -------------------------------------------------------------------------
// Two writers is how the header ends up saying one language and the document another.
const region = readFileSync(join(web, 'src', 'utils', 'storefrontRegion.js'), 'utf8');
assert.doesNotMatch(region, /documentElement\.lang/,
  'the region util must not also write the attribute — one writer, or they disagree');

console.log('documentLanguage selfcheck OK (the document tells the truth about its language in both shops)');
