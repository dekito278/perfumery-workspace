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
// The bare domain is the Indonesian shop, and its WhatsApp card says so (Dekito, 13 Nov 2026).
assert.match(block, /const shellTitle = MESSAGES\.id\[shellPage\.idTitleKey\]/, 'the shell title is the Indonesian home title');
assert.match(block, /const shellDescription = MESSAGES\.id\[shellPage\.idDescriptionKey\]/, 'and its description the Indonesian one');
assert.match(block, /'property="og:locale"', 'id_ID'/, 'with og:locale id_ID');
assert.doesNotMatch(block, /shellPage\.(title|description)\)/, 'the English literals no longer reach the shell');
const homeEntry = build.slice(build.indexOf("route: '/home'"), build.indexOf("route: '/home'") + 400);
assert.match(homeEntry, /idTitleKey: 'home\.tab'/, 'the /home entry names its Indonesian title key');
assert.doesNotMatch(block, /upsertCanonical|rel="canonical"/,
  'the shell answers /cart, /checkout and every unknown path — a canonical here would claim they are all '
  + 'the home page');

// The share image itself (Dekito, 13 Nov 2026): no portrait of him as the card for the whole site, and the
// 1200x630 shape WhatsApp draws, read from the JPEG header so a swapped file cannot pass by name alone.
const seoSource = readFileSync(join(webRoot, 'src', 'utils', 'seo.js'), 'utf8');
const sharePath = (seoSource.match(/export const DEFAULT_SHARE_IMAGE = '([^']+)'/) || [])[1] || '';
assert.ok(sharePath.startsWith('/'), 'DEFAULT_SHARE_IMAGE must be a site path');
assert.doesNotMatch(sharePath, /perfumer-/, 'the photos of Dekito at work are for the home page, never the link card');
const shareFile = join(webRoot, 'public', sharePath);
assert.ok(existsSync(shareFile), `the share image ${sharePath} must exist in public/`);
const jpeg = readFileSync(shareFile);
let at = 2;
let size = null;
while (at < jpeg.length) {
  const marker = jpeg[at + 1];
  const length = jpeg.readUInt16BE(at + 2);
  if (marker >= 0xc0 && marker <= 0xc3) { size = [jpeg.readUInt16BE(at + 7), jpeg.readUInt16BE(at + 5)]; break; }
  at += 2 + length;
}
assert.deepEqual(size, [1200, 630], `the share image must be 1200x630, is ${size}`);
assert.ok(jpeg.length < 300 * 1024, 'and small enough for WhatsApp to fetch it (its limit is about 300 KB)');
const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf8');
for (const tag of ['property="og:image"', 'name="twitter:image"']) {
  assert.ok(indexHtml.includes(`${tag} content="${sharePath}"`), `index.html ${tag} must name the same image`);
}

// /en is the English home, and its file says so (audit, 13 Nov 2026).
// Tenth audit, 13 Nov 2026: that file also answered /en/cart, /en/track-order and every English 404, each
// declaring itself /en/home. The English SHELL is now the English home without its canonical and twins,
// and the bare /en address is rewritten to the English home's own file.
assert.match(build, /const enShell = enHtml\s*\.replace\(\/\[\\t \]\*<link rel="canonical"/,
  'the English shell keeps the English home\'s canonical, so every English app page claims to be the home page');
// Vercel serves an existing file before any rewrite, so the shell cannot be /en/index.html — that file IS
// the bare /en address. The home keeps it; the shell is /en/app.html, reached only through the rewrite.
assert.match(build, /fs\.writeFileSync\(path\.join\(distRoot, EN_PREFIX\.slice\(1\), 'index\.html'\), enHtml\);/,
  'the bare /en address must get the English home page file');
assert.match(build, /fs\.writeFileSync\(path\.join\(distRoot, EN_PREFIX\.slice\(1\), 'app\.html'\), enShell\);/,
  'the English shell must not sit at /en/index.html, where it answers /en itself');
{
  const vercel = JSON.parse(readFileSync(join(webRoot, 'vercel.json'), 'utf8'));
  const rewrites = vercel.rewrites || [];
  const at = (source) => rewrites.findIndex((rule) => rule.source === source);
  assert.equal(rewrites[at('/en/:path*')]?.destination, '/en/app.html', 'English addresses without their own file get the English shell');
}

// If a build is present, hold the output to the same rule.
const dist = join(webRoot, 'dist');
if (existsSync(join(dist, 'index.html'))) {
  const shell = readFileSync(join(dist, 'index.html'), 'utf8');
  const image = (shell.match(/property="og:image"[^>]*content="([^"]*)"/) || [])[1] || '';
  assert.ok(image.startsWith('http'), `the built shell still has a relative og:image: ${image}`);
  assert.match(shell, /name="description"[^>]*content="[^"]{20,}"/, 'the built shell needs a real description');
  assert.match(shell, /property="og:description" content="SOLIVAGANT adalah/, 'the built shell previews in Indonesian');
  assert.doesNotMatch(shell, /rel="canonical"/, 'the built shell must not claim a canonical');
  const enIndex = join(dist, 'en', 'app.html');
  if (existsSync(enIndex)) {
    const en = readFileSync(enIndex, 'utf8');
    assert.match(en, /<html lang="en"/, 'dist/en/app.html is English');
    assert.match(en, /property="og:locale" content="en_US"/, 'and previews as English');
    assert.doesNotMatch(en, /rel="canonical"|rel="alternate"/, 'the English shell answers many addresses and must claim none of them');
  }

  // And the four static pages must still have theirs — they are single URLs, so they do.
  for (const route of ['home', 'catalog', 'journal', 'bespoke']) {
    const page = join(dist, route, 'index.html');
    if (!existsSync(page)) continue;
    assert.match(readFileSync(page, 'utf8'), new RegExp(`rel="canonical"[^>]*href="[^"]*/${route}"`),
      `/${route} is one URL and must keep declaring itself canonical`);
  }
}

console.log('shellShareMeta selfcheck OK (the bare domain shares properly; the shell claims no canonical)');
