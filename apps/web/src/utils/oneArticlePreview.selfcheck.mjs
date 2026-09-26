// `node src/utils/oneArticlePreview.selfcheck.mjs`
//
// Four public surfaces show a line of a journal article: the desktop journal list, the phone journal
// list, the home page's editorial cards, and the article page's own meta description. They built that
// line four ways.
//
//   - the desktop journal stripped markdown from the CONTENT and returned a stored excerpt untouched
//   - the phone journal stripped both
//   - the home page stripped a smaller character set and left image and link syntax in place
//
// So `**Jason** and [the story](/journal/jason)` reads as itself on the phone, and on the desktop and
// the home page it keeps its asterisks and drags a URL along.
//
// Not currently visible: there is one published article and its excerpt is plain prose. It will be
// visible the first time an excerpt is written the way every article body in this shop is written, in
// markdown, which is why this is worth a helper rather than a note.
//
// This is the third instance this week of one small fix written repeatedly in place instead of once:
// formatDate resolved locally on three screens while three others used the unfixed shared one, and
// formatTotal guarded in fourteen copies and not in four.
//
// The rule: one preview, and the length is the only thing a surface gets to choose.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { articleExcerpt, stripMarkdown } from './articleExcerpt.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// --- 1. The preview, run ---------------------------------------------------------------------------------
assert.equal(stripMarkdown('**Jason** and [the story](/journal/jason)'), 'Jason and the story',
  'bold markers go, a link keeps its words and loses its URL');
assert.equal(stripMarkdown('![cover](/img/a.png) Haloween 2025'), 'Haloween 2025',
  'an image is not words at all');
assert.equal(stripMarkdown('# Judul\n\nIsi   dengan   spasi'), 'Judul Isi dengan spasi',
  'headings and runs of whitespace collapse');

// The half that was actually wrong: a STORED excerpt gets the same treatment as content.
assert.equal(articleExcerpt({ excerpt: '**Cerita** di balik' }), 'Cerita di balik',
  'an excerpt is written in the same markdown as the body and must be stripped too');
assert.equal(articleExcerpt({ excerpt: '', content: '**Isi** artikel' }), 'Isi artikel',
  'an empty excerpt falls through to the content');
assert.equal(articleExcerpt({}), '', 'no article text is an empty line, not a crash');
assert.equal(articleExcerpt(null), '', 'and a missing article must not throw in a list');

// Length is the surface's own decision, and only that.
assert.equal(articleExcerpt({ excerpt: 'abcdefghij' }, 4), 'abcd');
assert.equal(articleExcerpt({ excerpt: 'abc' }, 120), 'abc', 'a short line is not padded or truncated');
assert.equal(articleExcerpt({ excerpt: 'abcdefghij' }), 'abcdefghij', 'no limit means no limit');

// --- 2. No surface builds its own any more ---------------------------------------------------------------
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(src);

// The signature of a hand-rolled one: the link-stripping regex. Anyone writing this again is writing
// this helper again.
const LINK_STRIP = /\\\[\(\[\^\\\]\]\+\)\\\]\\\(\[\^\)\]\+\\\)/;
const rolled = files
  .filter((file) => !file.endsWith(join('utils', 'articleExcerpt.js')))
  .filter((file) => /replace\(\/\\\[\(\[\^\\\]\]\+\)\\\]\\\(\[\^\)\]\+\\\)\/g/.test(readFileSync(file, 'utf8')))
  .map((file) => file.slice(src.length + 1));
assert.deepEqual(rolled, [],
  'a screen strips markdown itself instead of asking articleExcerpt. Every copy of this has so far '
  + `differed from every other: ${rolled.join(', ')}`);

// --- 3. And the surfaces that show a preview do ask for one -----------------------------------------------
for (const name of [
  'pages/PublicJournalPage.jsx',
  'pages/HomePage.jsx',
  'pages/mobile/MobileArticlesPage.jsx',
]) {
  const text = readFileSync(join(src, name), 'utf8');
  assert.match(text, /articleExcerpt\(/,
    `${name} shows an article preview without going through the shared one`);
}

console.log(`oneArticlePreview selfcheck OK (${files.length} modules, one way to read an article's first line)`);
