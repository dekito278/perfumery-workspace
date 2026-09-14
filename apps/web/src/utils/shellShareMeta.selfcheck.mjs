// `node src/utils/shellShareMeta.selfcheck.mjs`
//
// dist/index.html is what Vercel's catch-all returns, and that includes the bare domain: RootRedirect
// renders HomePage in place on desktop, so "/" is a real page rather than a redirect to /home.
//
// It shipped with a RELATIVE og:image — which the Open Graph spec does not allow and crawlers do not
// resolve — and no description at all. So solivagantscent.com, the URL most likely to be pasted into a
// chat or printed on a card, previewed as a bare title with no picture, while /home right next to it
// had everything.
//
// The line this guard walks: fill the META, never the canonical. The same file answers /cart, /checkout
// and every unknown path; a canonical here would declare all of them to be the home page.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const build = readFileSync(join(webRoot, 'tools', 'build.mjs'), 'utf8');

const block = build.slice(build.indexOf('const shellPage = staticPublicPages.find'), build.indexOf('[seo] Shell meta filled in'));
assert.ok(block, 'the build must fill in the shell share meta');
for (const tag of ['name="description"', 'property="og:title"', 'property="og:image"', 'name="twitter:image"']) {
  assert.ok(block.includes(tag), `the shell needs ${tag} or the bare domain shares without it`);
}
assert.match(block, /siteUrl \? `\$\{siteUrl\}\$\{SHARE_IMAGE_PATH\}` : SHARE_IMAGE_PATH/,
  'the share image must be absolute; a relative og:image is silently dropped by every crawler');
assert.doesNotMatch(block, /upsertCanonical|rel="canonical"/,
  'the shell answers /cart, /checkout and every unknown path — a canonical here would claim they are all '
  + 'the home page');

// If a build is present, hold the output to the same rule.
const dist = join(webRoot, 'dist');
if (existsSync(join(dist, 'index.html'))) {
  const shell = readFileSync(join(dist, 'index.html'), 'utf8');
  const image = (shell.match(/property="og:image"[^>]*content="([^"]*)"/) || [])[1] || '';
  assert.ok(image.startsWith('http'), `the built shell still has a relative og:image: ${image}`);
  assert.match(shell, /name="description"[^>]*content="[^"]{20,}"/, 'the built shell needs a real description');
  assert.doesNotMatch(shell, /rel="canonical"/, 'the built shell must not claim a canonical');

  // And the four static pages must still have theirs — they are single URLs, so they do.
  for (const route of ['home', 'catalog', 'journal', 'bespoke']) {
    const page = join(dist, route, 'index.html');
    if (!existsSync(page)) continue;
    assert.match(readFileSync(page, 'utf8'), new RegExp(`rel="canonical"[^>]*href="[^"]*/${route}"`),
      `/${route} is one URL and must keep declaring itself canonical`);
  }
}

console.log('shellShareMeta selfcheck OK (the bare domain shares properly; the shell claims no canonical)');
