// `node src/utils/everyPageDeclaresItsLanguage.selfcheck.mjs`
//
// public/offline.html — what the service worker serves when the network is gone — said `lang="en"`
// while every word in it is Indonesian:
//
//   "Solivagant sedang offline. Sambungkan internet, lalu coba lagi."
//
// A reader announcing that with English phonetics is the thing WCAG 3.1.1 exists to stop, and it is the
// one page in the shop a buyer meets when nothing else works.
//
// The app shell gets this right twice over: index.html ships lang="id" and useStorefrontRegion rewrites
// document.documentElement.lang when the shop switches. The offline page is static — the worker cannot
// know which shop the reader was in — so it declares the language it is actually written in.
//
// The rule is derived from the words rather than pinned to a value: whatever a static page SAYS decides
// what it must DECLARE. A page rewritten in English passes by being English.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// Words that exist in Indonesian and not in English, and the other way round. Function words only: a
// brand name or a loanword ("offline", "shell") says nothing about which language the page is in.
const INDONESIAN = /\b(sedang|tetapi|lalu|coba|untuk|yang|dengan|kembali|perlu|masih|sudah|tidak)\b/gi;
const ENGLISH = /\b(the|your|please|again|while|still|needs|cannot|try)\b/gi;

const staticPages = ['index.html', join('public', 'offline.html')]
  .filter((file) => readdirSync(dirname(join(web, file))).includes(file.split(/[/\\]/).pop()));
assert.ok(staticPages.length >= 2,
  `only ${staticPages.length} static pages found — the scan is broken, not the shop`);

for (const file of staticPages) {
  const source = readFileSync(join(web, file), 'utf8');
  const declared = source.match(/<html[^>]*\blang="([^"]+)"/);
  assert.ok(declared, `${file} declares no language at all`);

  // Read only what a reader reads: no scripts, no styles, no tags, no attributes.
  const prose = source
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  const indonesian = (prose.match(INDONESIAN) || []).length;
  const english = (prose.match(ENGLISH) || []).length;
  // Too little prose to judge, and judging it would be a guess. index.html lands here: its visible
  // words live inside the boot script, so this check has nothing to read and says so rather than
  // pretending. The offline page is the one with prose in the markup, and it is the one that was wrong.
  if (indonesian + english < 3) continue;

  const written = indonesian > english ? 'id' : 'en';
  assert.equal(declared[1], written,
    `${file} declares lang="${declared[1]}" and is written in ${written} (${indonesian} Indonesian `
    + `function words, ${english} English). A screen reader pronounces it with the wrong phonetics`);
}

// And the shell still hands the running app its language, which is what makes the offline page the only
// static one that has to say so for itself.
const region = readFileSync(join(web, 'src', 'hooks', 'useStorefrontRegion.js'), 'utf8');
assert.match(region, /document\.documentElement\.lang = region === REGION_EN \? 'en' : 'id'/,
  'the shop no longer rewrites the document language when it switches shops');

console.log(`everyPageDeclaresItsLanguage selfcheck OK (${staticPages.length} static pages, each declaring `
  + 'the language it is written in)');
