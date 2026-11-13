// `node src/utils/noAtelier.selfcheck.mjs`
//
// Dekito asked for the word "atelier" to go (brief, 14 Nov 2026, P1-4): the shop is one person's work,
// "dari formula sampai packing", and "atelier" made it sound like a studio with staff. It was in about
// ninety places — the page titles ("SOLIVAGANT - Atelier Parfum Artisan oleh Dekito"), the hero eyebrow,
// "Harga member, langsung dari atelier", "WhatsApp atelier", the prerendered page copy and the shell title.
//
// The rule: no buyer-facing text says it — not the message file, not the prerendered pages' copy, not the
// shell. Identifiers and comments may keep the word (why.atelier.body is a key, not a sentence).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const said = [];
for (const [language, table] of Object.entries(MESSAGES)) {
  for (const [key, value] of Object.entries(table)) {
    if (typeof value === 'string' && /atelier/i.test(value)) said.push(`${language}.${key}: ${value.slice(0, 90)}`);
  }
}
assert.deepEqual(said, [], `the shop still says "atelier":\n  ${said.join('\n  ')}`);

// Text written outside the message file: string literals only, comments removed.
const literalsWith = (file) => {
  const source = stripComments(readFileSync(join(webRoot, file), 'utf8'));
  return [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\n])*)\1/g)]
    .map((match) => match[2])
    .filter((text) => /atelier/i.test(text) && !/^[\w.]+$/.test(text) && !/^@?\/?[\w./-]+$/.test(text));
};
for (const file of ['index.html', 'tools/build.mjs', 'tools/seo-artifacts.mjs', 'src/utils/seo.js', 'src/data/publicStorefront.js', 'src/pages/CatalogPage.jsx']) {
  const found = file.endsWith('.html')
    ? [...stripComments(readFileSync(join(webRoot, file), 'utf8')).replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/>[^<]*atelier[^<]*</gi)].map((m) => m[0])
    : literalsWith(file);
  assert.deepEqual(found, [], `${file} still says "atelier":\n  ${found.join('\n  ')}`);
}

console.log('noAtelier selfcheck OK (no buyer-facing text says "atelier")');
