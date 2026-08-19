// Runnable check for article prerendering. `node tools/journal-prerender.selfcheck.mjs`.
// Articles sat in the sitemap with no prerendered file, so every shared link previewed as the generic
// site card. This asserts the head a crawler actually receives.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeJournalPages } from './seo-artifacts.mjs';

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-prerender-'));
const baseHtml = '<!doctype html><html><head><title>SOLIVAGANT</title></head><body><div id="root"></div></body></html>';
const siteUrl = 'https://www.solivagantscent.com';

const posts = [
  {
    slug: 'hujan-di-batu-hangat',
    title: 'Hujan di Batu Hangat',
    seoTitle: '',
    excerpt: 'Catatan tentang petrichor dan ingatan.',
    image: '/covers/hujan.jpg',
    publishedAt: '2026-08-01T03:00:00Z',
    updatedAt: '2026-08-02T03:00:00Z',
  },
  { slug: 'tanpa-gambar', title: 'Tanpa Gambar', seoTitle: 'SEO Judul', excerpt: '', image: '', publishedAt: '', updatedAt: '' },
  { slug: 'tanpa-judul', title: '', excerpt: 'x', image: '', publishedAt: '', updatedAt: '' },
];

const written = writeJournalPages(dist, baseHtml, posts, siteUrl);
assert.equal(written, 2, 'a post with no title is skipped, not written with an empty headline');

const first = fs.readFileSync(path.join(dist, 'articles', 'hujan-di-batu-hangat', 'index.html'), 'utf8');
assert.match(first, /<title>Hujan di Batu Hangat - SOLIVAGANT<\/title>/);
assert.match(first, /rel="canonical"[^>]*https:\/\/www\.solivagantscent\.com\/articles\/hujan-di-batu-hangat/);
assert.match(first, /property="og:type"[^>]*content="article"/);
assert.match(first, /content="Catatan tentang petrichor dan ingatan\."/);
assert.match(first, /property="og:image"[^>]*https:\/\/www\.solivagantscent\.com\/covers\/hujan\.jpg/);
assert.match(first, /name="twitter:card"[^>]*content="summary_large_image"/);
assert.match(first, /"@type":\s*"Article"/);
assert.match(first, /"datePublished":\s*"2026-08-01T03:00:00Z"/);
assert.match(first, /"@type":\s*"BreadcrumbList"/);
// The canonical must be the production host, never a relative or preview URL
assert.ok(!/rel="canonical"[^>]*content="\//.test(first));

// No image means no large-image card promise, and seo_title wins over title
const second = fs.readFileSync(path.join(dist, 'articles', 'tanpa-gambar', 'index.html'), 'utf8');
assert.match(second, /<title>SEO Judul - SOLIVAGANT<\/title>/);
assert.match(second, /name="twitter:card"[^>]*content="summary"/);
assert.ok(!/og:image/.test(second), 'must not advertise an image it does not have');
// Empty excerpt falls back to the title rather than an empty description
assert.match(second, /name="description"[^>]*content="Tanpa Gambar"/);

assert.ok(!fs.existsSync(path.join(dist, 'articles', 'tanpa-judul')));

fs.rmSync(dist, { recursive: true, force: true });
console.log('journal-prerender selfcheck OK');
