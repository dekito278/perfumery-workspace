// `node src/utils/heroStartsWithThePage.selfcheck.mjs`
//
// 16 Nov 2026: the home hero waited for the app bundle AND a storage listing before it was even requested
// (~6-7 s on a slow phone). The build now bakes the Studio photo list into the home files and preloads the
// hero with the exact image sets HomePage renders; useSiteImages starts from that list and still re-lists
// the bucket. Measured on the same server: hero requested ~1.3-1.7 s instead of ~3.4-4.3 s, shown ~2 s
// sooner, one request per image.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { siteImageEntries, PHONE_HERO_WIDTHS, PHONE_HERO_MEDIA, SITE_IMAGES_BUCKET } from './siteImageMap.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// The listing rule: newest upload per slot, extension dropped.
assert.deepEqual(siteImageEntries([
  { name: 'home-hero.jpg', updated_at: '2026-01-01' },
  { name: 'home-hero.webp', updated_at: '2026-09-01' },
  { name: 'mood-fresh.png', updated_at: '2026-02-01' },
], (name) => `u/${name}`), [['home-hero', 'u/home-hero.webp'], ['mood-fresh', 'u/mood-fresh.png']]);

// One rule, three readers.
assert.match(read('services', 'siteImageStorageService.js'), /siteImageEntries\(files,/);
assert.match(read('services', 'siteImageStorageService.js'), new RegExp(`SITE_IMAGES_BUCKET = '${SITE_IMAGES_BUCKET}'`), 'the service and the build list different buckets');
const home = read('pages', 'HomePage.jsx');
assert.equal(PHONE_HERO_MEDIA, '(max-width: 767px)', 'the preload\'s media is the <source> media below');
assert.match(home, /<source media="\(max-width: 767px\)" srcSet=\{srcSet\(siteImages\['home-hero'\], PHONE_HERO_WIDTHS\)\} sizes="100vw" \/>/);
assert.match(home, /srcSet=\{srcSet\(siteImages\['home-hero'\]\) \|\| FALLBACK_LIBRARY_SRCSET\} sizes="100vw"/, 'the desktop hero set is the default one the preload names');
assert.deepEqual(PHONE_HERO_WIDTHS, [480, 720, 900]);
const build = readFileSync(join(src, '..', 'tools', 'build.mjs'), 'utf8');
assert.match(build, /await bakeSiteImages\(env\);/);
assert.match(build, /getStorageImageSrcSet\(hero, PHONE_HERO_WIDTHS\)/);
assert.match(build, /getStorageImageSrcSet\(hero\) \}/);
assert.match(build, /\['\/','\/home','\/en','\/en\/home'\]\.indexOf\(p\)<0\)return;/, 'the preload is for the home addresses only');
const hook = read('hooks', 'useSiteImages.js');
assert.match(hook, /useState\(\(\) => bakedSiteImages\(\) \|\| \{\}\)/);
assert.match(hook, /useEffect\(\(\) => \{\s*refresh\(\);/, 'the live list is still fetched and wins');

const built = join(src, '..', 'dist', 'home', 'index.html');
if (existsSync(built) && readFileSync(built, 'utf8').includes('data-site-images')) {
  const script = readFileSync(built, 'utf8').match(/<script data-site-images>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(script), 'the baked script parses');
}
console.log('heroStartsWithThePage selfcheck OK (one listing rule, the hero preloaded with the sets it renders)');
