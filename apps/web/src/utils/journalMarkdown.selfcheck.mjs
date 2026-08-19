// Runnable check for the article markdown inline pattern. `node src/utils/journalMarkdown.selfcheck.mjs`.
// The image alternative must be tried before the link one, or ![alt](src) matches as a link and leaves a
// stray "!" in the published article. This mirrors the regex in components/journal/JournalMarkdownContent.
import assert from 'node:assert/strict';

const pattern = /(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
const tokenize = (text) => String(text).match(pattern) || [];

// An image is one token, bang included
assert.deepEqual(tokenize('lihat ![botol](/img/a.jpg) di sini'), ['![botol](/img/a.jpg)']);
// An empty alt still matches
assert.deepEqual(tokenize('![](/img/a.jpg)'), ['![](/img/a.jpg)']);
// A plain link is still a link
assert.deepEqual(tokenize('[toko](https://example.test)'), ['[toko](https://example.test)']);
// Both in one line, each whole
assert.deepEqual(
  tokenize('![a](/a.png) dan [b](https://b.test)'),
  ['![a](/a.png)', '[b](https://b.test)'],
);
// The other inline forms are unaffected
assert.deepEqual(tokenize('**tebal** dan *miring* dan `kode`'), ['**tebal**', '*miring*', '`kode`']);

// The href guard: only http(s), mailto and site-relative survive
const normalizeHref = (href) => {
  const value = String(href || '').trim();
  return /^(https?:|mailto:|\/)/i.test(value) ? value : '#';
};
assert.equal(normalizeHref('/img/a.jpg'), '/img/a.jpg');
assert.equal(normalizeHref('https://cdn.test/a.jpg'), 'https://cdn.test/a.jpg');
assert.equal(normalizeHref('javascript:alert(1)'), '#');
assert.equal(normalizeHref('data:image/svg+xml;base64,AAA'), '#');

console.log('journalMarkdown selfcheck OK');
